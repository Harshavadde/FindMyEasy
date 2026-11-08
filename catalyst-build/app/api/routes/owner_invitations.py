import hashlib
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.database import get_db
from app.models.owner_application import OwnerApplication
from app.models.owner_application_workflow import OwnerInvitation
from app.models.user import User
from app.schemas.owner_application_workflow import (
    OwnerInvitationValidationInput,
    OwnerInvitationValidationResult,
    OwnerRegistrationInput,
    OwnerRegistrationResult,
)
from app.services.owner_registration_page import owner_registration_fallback_page


logger = logging.getLogger(__name__)
router = APIRouter(
    prefix="/api/v1/owner-invitations",
    tags=["Owner Invitations"],
)


@router.get("/register", include_in_schema=False)
def owner_registration_fallback():
    return owner_registration_fallback_page()


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def _invitation_result(
    invitation: OwnerInvitation | None,
    application: OwnerApplication | None,
    now: datetime,
) -> OwnerInvitationValidationResult:
    if invitation is None or application is None:
        return OwnerInvitationValidationResult(
            valid=False,
            status="INVALID",
            message="This registration link is invalid.",
        )
    if invitation.accepted_at is not None or application.owner_user_id is not None:
        return OwnerInvitationValidationResult(
            valid=False,
            status="USED",
            message="This registration link has already been used.",
        )
    if invitation.revoked_at is not None:
        return OwnerInvitationValidationResult(
            valid=False,
            status="REVOKED",
            message="This registration link has been revoked.",
        )
    if _as_utc(invitation.expires_at) <= now:
        return OwnerInvitationValidationResult(
            valid=False,
            status="EXPIRED",
            message="This registration link has expired.",
        )
    if invitation.invited_phone != application.applicant_phone:
        return OwnerInvitationValidationResult(
            valid=False,
            status="PHONE_MISMATCH",
            message="The registered mobile number does not match this application.",
        )
    if application.status != "APPROVED":
        return OwnerInvitationValidationResult(
            valid=False,
            status="APPLICATION_NOT_APPROVED",
            message="This partnership application has not been approved.",
        )
    if not application.applicant_email:
        return OwnerInvitationValidationResult(
            valid=False,
            status="EMAIL_MISSING",
            message="This application does not have a registered email address.",
        )

    return OwnerInvitationValidationResult(
        valid=True,
        status="VALID",
        message="Your application is approved. Create your Owner password to continue.",
        expires_at=_as_utc(invitation.expires_at),
        applicant_name=application.applicant_name,
        applicant_phone=application.applicant_phone,
        applicant_email=application.applicant_email,
        pg_name=application.pg_name,
        city=application.city,
        area=application.area,
    )


@router.post(
    "/validate",
    response_model=OwnerInvitationValidationResult,
)
def validate_owner_invitation(
    data: OwnerInvitationValidationInput,
    db: Session = Depends(get_db),
):
    token_hash = hashlib.sha256(data.token.encode("utf-8")).hexdigest()
    try:
        invitation = (
            db.query(OwnerInvitation)
            .filter(OwnerInvitation.token_hash == token_hash)
            .first()
        )
        application = (
            db.query(OwnerApplication)
            .filter(OwnerApplication.id == invitation.application_id)
            .first()
            if invitation
            else None
        )
    except SQLAlchemyError as error:
        logger.error(
            "Owner invitation validation failed (error_type=%s).",
            type(error).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Invitation validation is unavailable. Check database "
                "availability and apply the owner_application_review_workflow "
                "migration if it has not been applied."
            ),
        ) from error

    return _invitation_result(invitation, application, datetime.now(timezone.utc))


@router.post(
    "/register",
    response_model=OwnerRegistrationResult,
    status_code=status.HTTP_201_CREATED,
)
def register_owner_from_invitation(
    data: OwnerRegistrationInput,
    db: Session = Depends(get_db),
):
    token_hash = hashlib.sha256(data.token.encode("utf-8")).hexdigest()
    now = datetime.now(timezone.utc)

    try:
        invitation = (
            db.query(OwnerInvitation)
            .filter(OwnerInvitation.token_hash == token_hash)
            .with_for_update()
            .first()
        )
        application = (
            db.query(OwnerApplication)
            .filter(OwnerApplication.id == invitation.application_id)
            .with_for_update()
            .first()
            if invitation
            else None
        )
        invitation_state = _invitation_result(invitation, application, now)
        if not invitation_state.valid:
            db.rollback()
            if invitation_state.status == "INVALID":
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=invitation_state.message,
                )
            raise HTTPException(
                status_code=(
                    status.HTTP_410_GONE
                    if invitation_state.status in {"EXPIRED", "REVOKED"}
                    else status.HTTP_409_CONFLICT
                ),
                detail=invitation_state.message,
            )

        if invitation is None or application is None:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="This registration link is invalid.",
            )

        phone_number = application.applicant_phone
        if not application.applicant_email:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "This application has no registered email address. "
                    "Contact FindEasy support for assistance."
                ),
            )
        national_number = phone_number.removeprefix("+91")
        existing_account_query = db.query(User.id).filter(
            or_(
                func.lower(User.phone_number) == phone_number.lower(),
                func.lower(User.phone_number) == national_number.lower(),
                func.lower(User.phone) == national_number.lower(),
            )
        )
        if application.applicant_email:
            existing_account_query = existing_account_query.union(
                db.query(User.id).filter(
                    func.lower(User.email)
                    == application.applicant_email.lower()
                )
            )
        if existing_account_query.first():
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "An account already uses this mobile number or email. "
                    "Contact FindEasy support for assistance."
                ),
            )

        user = User(
            email=application.applicant_email,
            phone_number=phone_number,
            phone=phone_number.removeprefix("+91"),
            password_hash=hash_password(data.password),
            full_name=application.applicant_name,
            user_role="OWNER",
            is_phone_verified=False,
            is_active=True,
        )
        db.add(user)
        db.flush()

        invitation.accepted_at = now
        application.owner_user_id = user.id
        application.registration_completed_at = now
        application.status = "INVITATION_ACCEPTED"
        db.commit()
        db.refresh(user)
        return OwnerRegistrationResult(
            success=True,
            full_name=user.full_name or application.applicant_name,
            phone_number=phone_number,
            registered_at=now,
        )
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as error:
        db.rollback()
        logger.info(
            "Owner invitation redemption conflict (error_type=%s).",
            type(error).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This invitation or account was already used. Request a new "
                "invitation if you still need access."
            ),
        ) from error
    except SQLAlchemyError as error:
        db.rollback()
        logger.error(
            "Owner registration persistence failed (error_type=%s).",
            type(error).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Owner registration is unavailable. Confirm the owner "
                "registration migration has been reviewed and applied."
            ),
        ) from error
