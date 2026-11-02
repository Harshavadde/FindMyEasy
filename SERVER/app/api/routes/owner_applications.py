import hashlib
import hmac
import logging
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.owner_application import OwnerApplication
from app.schemas.owner_application import (
    OwnerApplicationCreate,
    OwnerApplicationCreateResponse,
    OwnerApplicationStatusRequest,
    OwnerApplicationStatusResponse,
)


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/owner-applications",
    tags=["Owner Partnership Applications"],
)

STATUS_MESSAGES = {
    "SUBMITTED": "Your application is awaiting FindEasy Admin review.",
    "UNDER_REVIEW": "Your application is being reviewed by FindEasy.",
    "ADDITIONAL_INFORMATION_REQUIRED": (
        "FindEasy needs additional information about your application."
    ),
    "APPROVED": "Your partnership application has been approved.",
    "REJECTED": "Your partnership application was not approved.",
}


def _status_access_hash(access_key: str) -> str:
    return hashlib.sha256(access_key.encode("utf-8")).hexdigest()


def _duplicate_application_query(
    db: Session,
    data: OwnerApplicationCreate,
):
    return db.query(OwnerApplication.id).filter(
        OwnerApplication.status == "SUBMITTED",
        func.lower(OwnerApplication.applicant_phone)
        == data.applicant_phone.lower(),
        func.lower(OwnerApplication.pg_name) == data.pg_name.lower(),
        func.lower(OwnerApplication.city) == data.city.lower(),
        func.lower(OwnerApplication.area) == data.area.lower(),
        func.lower(OwnerApplication.address) == data.address.lower(),
    )


@router.post(
    "",
    response_model=OwnerApplicationCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_owner_application(
    data: OwnerApplicationCreate,
    db: Session = Depends(get_db),
):
    try:
        if _duplicate_application_query(db, data).first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "An application for this applicant and property is already "
                    "awaiting review."
                ),
            )

        status_access_key = secrets.token_urlsafe(32)
        application = OwnerApplication(
            application_reference=f"FE-{secrets.token_hex(8).upper()}",
            applicant_name=data.applicant_name,
            applicant_phone=data.applicant_phone,
            applicant_email=(
                str(data.applicant_email) if data.applicant_email else None
            ),
            relationship_type=data.relationship_type,
            pg_name=data.pg_name,
            city=data.city,
            area=data.area,
            address=data.address,
            formatted_address=data.formatted_address,
            latitude=data.latitude,
            longitude=data.longitude,
            google_place_id=data.google_place_id,
            google_maps_url=data.google_maps_url,
            status="SUBMITTED",
            phone_verified=False,
            declaration_version="owner-partnership-v1",
            declaration_accepted_at=datetime.now(timezone.utc),
            status_access_hash=_status_access_hash(status_access_key),
        )
        db.add(application)
        db.commit()
        db.refresh(application)
    except HTTPException:
        raise
    except IntegrityError as error:
        db.rollback()
        if _duplicate_application_query(db, data).first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "An application for this applicant and property is already "
                    "awaiting review."
                ),
            ) from error
        logger.exception(
            "Could not save an Owner partnership application (error_type=%s).",
            type(error).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to submit your application. Please try again.",
        ) from error
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception(
            "Could not save an Owner partnership application (error_type=%s).",
            type(error).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to submit your application. Please try again.",
        ) from error

    return OwnerApplicationCreateResponse(
        application_reference=application.application_reference,
        status="SUBMITTED",
        submitted_at=application.submitted_at,
        status_access_key=status_access_key,
        phone_verification_required=False,
    )


@router.post(
    "/{application_reference}/status",
    response_model=OwnerApplicationStatusResponse,
)
def get_owner_application_status(
    application_reference: str,
    data: OwnerApplicationStatusRequest,
    db: Session = Depends(get_db),
):
    application = (
        db.query(OwnerApplication)
        .filter(
            OwnerApplication.application_reference == application_reference.upper()
        )
        .first()
    )
    candidate_hash = _status_access_hash(data.status_access_key)
    stored_hash = application.status_access_hash if application else (
        "0" * len(candidate_hash)
    )
    if not hmac.compare_digest(candidate_hash, stored_hash) or application is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application reference or status access key is invalid.",
        )

    return OwnerApplicationStatusResponse(
        application_reference=application.application_reference,
        status=application.status,
        submitted_at=application.submitted_at,
        message=STATUS_MESSAGES.get(
            application.status,
            "Your application status is being updated.",
        ),
    )
