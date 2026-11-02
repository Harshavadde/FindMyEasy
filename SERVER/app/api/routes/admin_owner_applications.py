import hashlib
import logging
import secrets
import smtplib
from datetime import date, datetime, time, timedelta, timezone
from math import ceil
from typing import Literal
from urllib.parse import quote, urlsplit, urlunsplit

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.routes.admin import get_current_admin
from app.core.config import settings
from app.db.database import get_db
from app.models.owner_application import OwnerApplication
from app.models.owner_application_workflow import (
    OwnerApplicationHistory,
    OwnerInvitation,
)
from app.models.user import User
from app.schemas.admin_owner_application import (
    AdminOwnerApplicationDetail,
    AdminOwnerApplicationPage,
    AdminOwnerApplicationStats,
    OwnerApplicationRelationshipValue,
    OwnerApplicationStatusValue,
)
from app.schemas.owner_application_workflow import (
    ApplicationDecisionResult,
    OwnerApplicationHistoryItem,
    OwnerInvitationCreated,
    OwnerInvitationPage,
    OwnerInvitationSummary,
    RejectOwnerApplicationInput,
    RequestApplicationInformationInput,
)
from app.services.owner_invitation_email import (
    send_owner_registration_invitation,
)


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/admin/owner-applications",
    tags=["Admin - Owner Applications"],
)

STATUS_COUNTS = {
    "SUBMITTED": "submitted",
    "UNDER_REVIEW": "under_review",
    "ADDITIONAL_INFORMATION_REQUIRED": "additional_information_required",
    "APPROVED": "approved",
    "REJECTED": "rejected",
    "INVITATION_SENT": "invitations_sent",
    "INVITATION_ACCEPTED": "invitations_accepted",
    "EXPIRED": "expired",
}

DECISION_ELIGIBLE_STATUSES = {"SUBMITTED", "UNDER_REVIEW"}


def _owner_registration_url(token: str) -> str:
    base_url = settings.PUBLIC_BASE_URL.strip()
    parsed = urlsplit(base_url)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.netloc
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
    ):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Owner registration web URL is not configured correctly.",
        )
    if (
        settings.ENVIRONMENT.strip().lower() in {"prod", "production"}
        and parsed.scheme != "https"
    ):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Owner registration requires an HTTPS public URL.",
        )

    path = f"{parsed.path.rstrip('/')}/api/v1/owner-invitations/register"
    return urlunsplit(
        (parsed.scheme, parsed.netloc, path, "", f"token={quote(token, safe='')}")
    )


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Owner application not found.",
    )


def _record_history(
    db: Session,
    *,
    application: OwnerApplication,
    admin: User,
    action: str,
    previous_status: str | None,
    message: str | None = None,
    internal_note: str | None = None,
) -> None:
    db.add(
        OwnerApplicationHistory(
            application_id=application.id,
            previous_status=previous_status,
            new_status=application.status,
            action=action,
            message=message,
            internal_note=internal_note,
            performed_by_admin_id=admin.id,
        )
    )


def _commit_workflow_change(db: Session) -> None:
    try:
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        logger.error(
            "Owner application workflow persistence failed (error_type=%s).",
            type(error).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "The review workflow could not be saved. Check database "
                "availability and apply the owner_application_review_workflow "
                "migration if it has not been applied."
            ),
        ) from error


def _application_for_update(db: Session, application_id: str) -> OwnerApplication:
    application = (
        db.query(OwnerApplication)
        .filter(OwnerApplication.id == application_id)
        .with_for_update()
        .first()
    )
    if application is None:
        raise _not_found()
    return application


def _decision_result(application: OwnerApplication) -> ApplicationDecisionResult:
    return ApplicationDecisionResult(
        application_id=application.id,
        status=application.status,
        updated_at=datetime.now(timezone.utc),
    )


def _invitation_status(invitation: OwnerInvitation, now: datetime) -> str:
    if invitation.accepted_at is not None:
        return "USED"
    if invitation.revoked_at is not None:
        return "REVOKED"
    expires_at = invitation.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= now:
        return "EXPIRED"
    return "ACTIVE"


def _invitation_summary(
    invitation: OwnerInvitation,
    now: datetime,
) -> OwnerInvitationSummary:
    return OwnerInvitationSummary(
        id=invitation.id,
        application_id=invitation.application_id,
        status=_invitation_status(invitation, now),
        invited_phone=invitation.invited_phone,
        expires_at=invitation.expires_at,
        created_at=invitation.created_at,
        created_by_admin_id=invitation.created_by_admin_id,
        revoked_at=invitation.revoked_at,
        accepted_at=invitation.accepted_at,
        delivery_channel=invitation.delivery_channel,
        delivery_status=invitation.delivery_status,
    )


@router.get(
    "/stats",
    response_model=AdminOwnerApplicationStats,
)
def get_owner_application_stats(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    grouped_counts = (
        db.query(OwnerApplication.status, func.count(OwnerApplication.id))
        .group_by(OwnerApplication.status)
        .all()
    )
    counts = {field: 0 for field in STATUS_COUNTS.values()}
    for application_status, count in grouped_counts:
        field = STATUS_COUNTS.get(application_status)
        if field:
            counts[field] = count

    return AdminOwnerApplicationStats(
        total_applications=db.query(func.count(OwnerApplication.id)).scalar() or 0,
        **counts,
    )


@router.get(
    "",
    response_model=AdminOwnerApplicationPage,
)
def list_owner_applications(
    search: str | None = Query(default=None, max_length=200),
    application_status: OwnerApplicationStatusValue | None = Query(
        default=None,
        alias="status",
    ),
    city: str | None = Query(default=None, max_length=100),
    relationship_type: OwnerApplicationRelationshipValue | None = None,
    submitted_from: date | None = None,
    submitted_to: date | None = None,
    sort_by: Literal[
        "submitted_at",
        "applicant_name",
        "status",
        "application_reference",
    ] = "submitted_at",
    sort_order: Literal["asc", "desc"] = "desc",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    if submitted_from and submitted_to and submitted_from > submitted_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The submitted-from date must not be after the submitted-to date.",
        )

    query = db.query(OwnerApplication)
    if search and search.strip():
        escaped = (
            search.strip()
            .replace("\\", "\\\\")
            .replace("%", "\\%")
            .replace("_", "\\_")
        )
        search_pattern = f"%{escaped}%"
        query = query.filter(
            or_(
                OwnerApplication.applicant_name.ilike(search_pattern, escape="\\"),
                OwnerApplication.applicant_phone.ilike(search_pattern, escape="\\"),
                OwnerApplication.application_reference.ilike(
                    search_pattern,
                    escape="\\",
                ),
                OwnerApplication.pg_name.ilike(search_pattern, escape="\\"),
            )
        )
    if application_status:
        query = query.filter(OwnerApplication.status == application_status)
    if city and city.strip():
        query = query.filter(
            func.lower(OwnerApplication.city) == city.strip().lower()
        )
    if relationship_type:
        query = query.filter(
            OwnerApplication.relationship_type == relationship_type
        )
    if submitted_from:
        start = datetime.combine(
            submitted_from,
            time.min,
            tzinfo=timezone.utc,
        )
        query = query.filter(OwnerApplication.submitted_at >= start)
    if submitted_to:
        end_exclusive = datetime.combine(
            submitted_to + timedelta(days=1),
            time.min,
            tzinfo=timezone.utc,
        )
        query = query.filter(OwnerApplication.submitted_at < end_exclusive)

    total = query.count()
    sort_column = {
        "submitted_at": OwnerApplication.submitted_at,
        "applicant_name": OwnerApplication.applicant_name,
        "status": OwnerApplication.status,
        "application_reference": OwnerApplication.application_reference,
    }[sort_by]
    ordering = sort_column.asc() if sort_order == "asc" else sort_column.desc()
    applications = (
        query.order_by(ordering, OwnerApplication.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    cities = [
        value
        for (value,) in db.query(OwnerApplication.city)
        .group_by(OwnerApplication.city)
        .order_by(func.lower(OwnerApplication.city))
        .all()
    ]

    return AdminOwnerApplicationPage(
        items=applications,
        cities=cities,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, ceil(total / page_size)),
    )


@router.get(
    "/{application_id}",
    response_model=AdminOwnerApplicationDetail,
)
def get_owner_application_detail(
    application_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    application = (
        db.query(OwnerApplication)
        .filter(OwnerApplication.id == application_id)
        .first()
    )
    if application is None:
        raise _not_found()

    try:
        history = (
            db.query(OwnerApplicationHistory)
            .filter(OwnerApplicationHistory.application_id == application.id)
            .order_by(OwnerApplicationHistory.created_at.asc())
            .all()
        )
        owner_account = (
            db.query(User)
            .filter(User.id == application.owner_user_id)
            .first()
            if application.owner_user_id
            else None
        )
    except SQLAlchemyError as error:
        logger.error(
            "Owner application history retrieval failed (error_type=%s).",
            type(error).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Review history is unavailable. Check database availability "
                "and apply the owner_application_review_workflow migration."
            ),
        ) from error

    return AdminOwnerApplicationDetail(
        id=application.id,
        application_reference=application.application_reference,
        applicant_name=application.applicant_name,
        applicant_phone=application.applicant_phone,
        applicant_email=application.applicant_email,
        relationship_type=application.relationship_type,
        pg_name=application.pg_name,
        city=application.city,
        area=application.area,
        submitted_at=application.submitted_at,
        status=application.status,
        phone_verified=application.phone_verified,
        address=application.address,
        formatted_address=application.formatted_address,
        latitude=float(application.latitude),
        longitude=float(application.longitude),
        google_place_id=application.google_place_id,
        google_maps_url=application.google_maps_url,
        owner_user_id=application.owner_user_id,
        owner_account_created_at=(
            owner_account.created_at if owner_account else None
        ),
        registration_completed_at=application.registration_completed_at,
        last_updated_at=history[-1].created_at if history else None,
        status_history=[
            OwnerApplicationHistoryItem(
                action=item.action,
                previous_status=item.previous_status,
                status=item.new_status,
                changed_at=item.created_at,
                message=item.message,
                internal_note=item.internal_note,
                performed_by_admin_id=item.performed_by_admin_id,
            )
            for item in history
        ],
        history_available=True,
    )


@router.post(
    "/{application_id}/approve",
    response_model=ApplicationDecisionResult,
)
def approve_owner_application(
    application_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    application = _application_for_update(db, application_id)
    if application.status not in DECISION_ELIGIBLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only submitted or under-review applications can be approved.",
        )

    previous_status = application.status
    application.status = "APPROVED"
    _record_history(
        db,
        application=application,
        admin=admin,
        action="APPROVED",
        previous_status=previous_status,
    )
    _commit_workflow_change(db)
    return _decision_result(application)


@router.post(
    "/{application_id}/reject",
    response_model=ApplicationDecisionResult,
)
def reject_owner_application(
    application_id: str,
    data: RejectOwnerApplicationInput,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    application = _application_for_update(db, application_id)
    if application.status not in DECISION_ELIGIBLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only submitted or under-review applications can be rejected.",
        )

    previous_status = application.status
    application.status = "REJECTED"
    _record_history(
        db,
        application=application,
        admin=admin,
        action="REJECTED",
        previous_status=previous_status,
        message=data.reason,
        internal_note=data.internal_note,
    )
    _commit_workflow_change(db)
    return _decision_result(application)


@router.post(
    "/{application_id}/request-information",
    response_model=ApplicationDecisionResult,
)
def request_owner_application_information(
    application_id: str,
    data: RequestApplicationInformationInput,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    application = _application_for_update(db, application_id)
    if application.status not in DECISION_ELIGIBLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Additional information can only be requested for submitted "
                "or under-review applications."
            ),
        )

    previous_status = application.status
    application.status = "ADDITIONAL_INFORMATION_REQUIRED"
    _record_history(
        db,
        application=application,
        admin=admin,
        action="INFORMATION_REQUESTED",
        previous_status=previous_status,
        message=data.message,
    )
    _commit_workflow_change(db)
    return _decision_result(application)


@router.post(
    "/{application_id}/invitations",
    response_model=OwnerInvitationCreated,
    status_code=status.HTTP_201_CREATED,
)
def create_owner_invitation(
    application_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    application = _application_for_update(db, application_id)
    if application.status != "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only approved applications are eligible for an invitation.",
        )
    if not application.applicant_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This approved application has no registered email address. "
                "Update the application through the approved support process "
                "before sending an invitation."
            ),
        )

    token = secrets.token_urlsafe(32)
    invitation_url = _owner_registration_url(token)
    now = datetime.now(timezone.utc)
    existing = (
        db.query(OwnerInvitation)
        .filter(
            OwnerInvitation.application_id == application.id,
            OwnerInvitation.revoked_at.is_(None),
            OwnerInvitation.accepted_at.is_(None),
            OwnerInvitation.expires_at > now,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "An active invitation already exists. Revoke it before "
                "generating another invitation."
            ),
        )

    invitation = OwnerInvitation(
        application_id=application.id,
        invited_phone=application.applicant_phone,
        token_hash=hashlib.sha256(token.encode("utf-8")).hexdigest(),
        expires_at=now + timedelta(hours=settings.OWNER_INVITATION_TTL_HOURS),
        created_by_admin_id=admin.id,
        delivery_channel="EMAIL",
        delivery_status="PENDING",
    )
    db.add(invitation)
    _record_history(
        db,
        application=application,
        admin=admin,
        action="INVITATION_CREATED",
        previous_status=application.status,
    )
    _commit_workflow_change(db)
    db.refresh(invitation)

    try:
        send_owner_registration_invitation(
            recipient=application.applicant_email,
            applicant_name=application.applicant_name,
            property_name=application.pg_name,
            invitation_url=invitation_url,
            expires_at=invitation.expires_at,
        )
        invitation.delivery_status = "DELIVERED"
    except (RuntimeError, OSError, smtplib.SMTPException, ValueError) as error:
        logger.warning(
            "Owner invitation email delivery failed (error_type=%s).",
            type(error).__name__,
        )
        invitation.delivery_status = "FAILED"
    _commit_workflow_change(db)
    db.refresh(invitation)
    return OwnerInvitationCreated(
        **_invitation_summary(invitation, now).model_dump(),
        invitation_url=invitation_url,
    )


@router.get(
    "/{application_id}/invitations",
    response_model=OwnerInvitationPage,
)
def list_owner_invitations(
    application_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    if db.query(OwnerApplication.id).filter(
        OwnerApplication.id == application_id
    ).first() is None:
        raise _not_found()
    try:
        invitations = (
            db.query(OwnerInvitation)
            .filter(OwnerInvitation.application_id == application_id)
            .order_by(OwnerInvitation.created_at.desc())
            .all()
        )
    except SQLAlchemyError as error:
        logger.error(
            "Owner invitation retrieval failed (error_type=%s).",
            type(error).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Invitation records are unavailable. Check database "
                "availability and apply the owner_application_review_workflow "
                "migration."
            ),
        ) from error

    now = datetime.now(timezone.utc)
    return OwnerInvitationPage(
        items=[_invitation_summary(item, now) for item in invitations]
    )


@router.post(
    "/invitations/{invitation_id}/revoke",
    response_model=OwnerInvitationSummary,
)
def revoke_owner_invitation(
    invitation_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    invitation_identity = (
        db.query(OwnerInvitation.application_id)
        .filter(OwnerInvitation.id == invitation_id)
        .first()
    )
    if invitation_identity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Owner invitation not found.",
        )
    application = _application_for_update(db, invitation_identity.application_id)
    invitation = (
        db.query(OwnerInvitation)
        .filter(OwnerInvitation.id == invitation_id)
        .with_for_update()
        .first()
    )
    if invitation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Owner invitation not found.",
        )

    now = datetime.now(timezone.utc)
    invitation_status = _invitation_status(invitation, now)
    if invitation_status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Only active invitations can be revoked; this one is {invitation_status.lower()}.",
        )

    invitation.revoked_at = now
    _record_history(
        db,
        application=application,
        admin=admin,
        action="INVITATION_REVOKED",
        previous_status=application.status,
    )
    _commit_workflow_change(db)
    return _invitation_summary(invitation, now)
