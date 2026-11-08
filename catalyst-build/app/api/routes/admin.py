import logging
from typing import Literal
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from sqlalchemy import case, func, or_
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, raiseload

from app.api.routes.auth import get_current_user
from app.api.routes.listings import listing_to_response
from app.core.security import hash_password
from app.db.database import get_db
from app.models.admin_account_audit_log import AdminAccountAuditLog
from app.models.admin_setup_state import AdminSetupState
from app.models.listing import Listing
from app.models.listing_image import ListingImage
from app.models.user import User
from app.schemas.auth import UserResponse, normalize_phone_number
from app.schemas.listing import (
    AdminListingPage,
    AdminListingResponse,
    AdminListingSummary,
)


router = APIRouter(
    prefix="/api/v1/admin",
    tags=["Admin"],
)
logger = logging.getLogger(__name__)


class ListingStatusUpdate(BaseModel):
    status: Literal["published", "rejected"]
    rejection_reason: str | None = Field(default=None, max_length=2000)

    @field_validator("rejection_reason")
    @classmethod
    def normalize_rejection_reason(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @model_validator(mode="after")
    def require_rejection_reason(self):
        if self.status == "rejected" and not self.rejection_reason:
            raise ValueError("A rejection reason is required.")
        return self


class AdminAccountCreateInput(BaseModel):
    full_name: str = Field(min_length=1, max_length=150)
    phone_number: str
    email: EmailStr | None = None
    password: str = Field(min_length=8, max_length=128)

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Full name cannot be empty.")
        return normalized

    @field_validator("phone_number")
    @classmethod
    def normalize_phone(cls, value: str) -> str:
        return normalize_phone_number(value)


def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.user_role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access is required.",
        )
    return current_user


@router.get("/administrators", response_model=list[UserResponse])
def list_administrators(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    return (
        db.query(User)
        .filter(User.user_role == "ADMIN")
        .order_by(User.created_at.asc(), User.id.asc())
        .all()
    )


@router.post(
    "/administrators",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_administrator(
    data: AdminAccountCreateInput,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    normalized_email = str(data.email).strip().lower() if data.email else None
    national_phone = data.phone_number.removeprefix("+91")
    duplicate_phone = (
        db.query(User.id)
        .filter(
            or_(
                User.phone_number == data.phone_number,
                User.phone == national_phone,
            )
        )
        .first()
    )
    duplicate_email = (
        db.query(User.id)
        .filter(func.lower(User.email) == normalized_email)
        .first()
        if normalized_email
        else None
    )
    if duplicate_phone or duplicate_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with that phone number or email already exists.",
        )

    new_admin = User(
        full_name=data.full_name,
        phone_number=data.phone_number,
        phone=national_phone,
        email=normalized_email,
        password_hash=hash_password(data.password),
        user_role="ADMIN",
        is_phone_verified=False,
        is_active=True,
    )
    db.add(new_admin)
    try:
        db.flush()
        db.add(
            AdminAccountAuditLog(
                actor_admin_id=admin.id,
                target_admin_id=new_admin.id,
                action="ADMIN_CREATED",
            )
        )
        db.commit()
        db.refresh(new_admin)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with that phone number or email already exists.",
        ) from error
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception(
            "Administrator creation failed (exception_type=%s).",
            type(error).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to create the administrator account.",
        ) from error
    return new_admin


@router.post(
    "/administrators/{admin_id}/disable",
    response_model=UserResponse,
)
def disable_administrator(
    admin_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    # Lock admin rows in a stable order so concurrent disables cannot remove
    # the final active administrator.
    (
        db.query(User.id)
        .filter(User.user_role == "ADMIN")
        .order_by(User.id)
        .with_for_update()
        .all()
    )
    target = (
        db.query(User)
        .filter(User.id == admin_id, User.user_role == "ADMIN")
        .first()
    )
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Administrator not found.",
        )
    if target.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You cannot disable your own administrator account.",
        )
    primary_admin = (
        db.query(AdminSetupState.admin_user_id)
        .filter(AdminSetupState.setup_key == "initial-admin")
        .scalar()
    )
    if not primary_admin:
        primary_admin = (
            db.query(User.id)
            .filter(User.user_role == "ADMIN")
            .order_by(User.created_at.asc(), User.id.asc())
            .scalar()
        )
    if target.id == primary_admin:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The primary administrator account cannot be disabled.",
        )

    if target.is_active:
        target.is_active = False
        db.add(
            AdminAccountAuditLog(
                actor_admin_id=admin.id,
                target_admin_id=target.id,
                action="ADMIN_DISABLED",
            )
        )
        try:
            db.commit()
            db.refresh(target)
        except SQLAlchemyError as error:
            db.rollback()
            logger.exception(
                "Administrator disable failed (exception_type=%s).",
                type(error).__name__,
            )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Unable to disable the administrator account.",
            ) from error
    return target


@router.get(
    "/listings",
    response_model=AdminListingPage,
)
def get_all_listings_for_review(
    search: str | None = Query(default=None, max_length=200),
    status_filter: Literal["review", "published", "rejected"] | None = Query(
        default=None,
        alias="status",
    ),
    city: str | None = Query(default=None, max_length=100),
    sort_by: Literal["created_at", "name", "city", "monthly_price", "status"] = (
        "created_at"
    ),
    sort_order: Literal["asc", "desc"] = "desc",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=10),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    try:
        filters = []
        if search and search.strip():
            search_pattern = f"%{search.strip()}%"
            filters.append(
                or_(
                    Listing.name.ilike(search_pattern),
                    Listing.city.ilike(search_pattern),
                    Listing.area.ilike(search_pattern),
                    Listing.address.ilike(search_pattern),
                    Listing.owner_phone.ilike(search_pattern),
                    User.full_name.ilike(search_pattern),
                    User.email.ilike(search_pattern),
                )
            )
        if status_filter == "review":
            filters.append(Listing.status.in_(("draft", "pending")))
        elif status_filter:
            filters.append(Listing.status == status_filter)
        if city and city.strip():
            filters.append(func.lower(Listing.city) == city.strip().lower())

        count_query = db.query(func.count(Listing.id)).select_from(Listing)
        if search and search.strip():
            count_query = count_query.outerjoin(User, Listing.owner_id == User.id)
        total = count_query.filter(*filters).scalar() or 0
        status_counts = dict(
            db.query(Listing.status, func.count(Listing.id))
            .group_by(Listing.status)
            .all()
        )
        total_listings = sum(status_counts.values())
        review_count = status_counts.get("draft", 0) + status_counts.get("pending", 0)
        preview_image = (
            db.query(func.coalesce(ListingImage.thumbnail_url, ListingImage.image_url))
            .filter(ListingImage.listing_id == Listing.id)
            .order_by(
                case(
                    (func.upper(ListingImage.image_type) == "COVER", 0),
                    else_=1,
                ),
                ListingImage.created_at.desc(),
                ListingImage.id.asc(),
            )
            .limit(1)
            .correlate(Listing)
            .scalar_subquery()
        )
        sort_column = {
            "created_at": Listing.created_at,
            "name": Listing.name,
            "city": Listing.city,
            "monthly_price": Listing.monthly_price,
            "status": Listing.status,
        }[sort_by]
        ordering = sort_column.asc() if sort_order == "asc" else sort_column.desc()
        rows = (
            db.query(
                Listing,
                User.full_name,
                User.email,
                preview_image.label("preview_image_url"),
            )
            .outerjoin(User, Listing.owner_id == User.id)
            .options(raiseload(Listing.sharing))
            .filter(*filters)
            .order_by(ordering, Listing.id.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        cities = [
            value
            for (value,) in db.query(Listing.city)
            .distinct()
            .order_by(Listing.city)
            .all()
        ]
        return AdminListingPage(
            items=[
                AdminListingSummary(
                    id=listing.id,
                    name=listing.name,
                    property_type=listing.property_type,
                    gender=listing.gender,
                    monthly_price=listing.monthly_price,
                    total_beds=listing.total_beds,
                    available_beds=listing.available_beds,
                    filled_beds=listing.filled_beds,
                    city=listing.city,
                    area=listing.area,
                    owner_phone=listing.owner_phone,
                    status=listing.status,
                    preview_image_url=preview_image_url,
                    owner_name=owner_name,
                    owner_email=owner_email,
                    created_at=listing.created_at,
                    updated_at=listing.updated_at,
                    rejection_reason=listing.rejection_reason,
                )
                for listing, owner_name, owner_email, preview_image_url in rows
            ],
            cities=cities,
            total=total,
            total_listings=total_listings,
            review_count=review_count,
            published_count=status_counts.get("published", 0),
            rejected_count=status_counts.get("rejected", 0),
            page=page,
            page_size=page_size,
            total_pages=max(1, ceil(total / page_size)),
        )
    except Exception as error:
        logger.exception(
            "Admin listings query failed (exception_type=%s).",
            type(error).__name__,
        )
        raise


def _admin_listing_to_response(
    listing: Listing,
    db: Session,
) -> AdminListingResponse:
    response = listing_to_response(listing, db).model_dump()
    owner = listing.owner
    return AdminListingResponse(
        **response,
        owner_name=owner.full_name if owner else None,
        owner_email=owner.email if owner else None,
        owner_user_role=owner.user_role if owner else None,
        owner_is_active=owner.is_active if owner else None,
        created_at=listing.created_at,
        updated_at=listing.updated_at,
        rejection_reason=listing.rejection_reason,
    )


@router.get(
    "/listings/{listing_id}",
    response_model=AdminListingResponse,
)
def get_admin_listing_detail(
    listing_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if listing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found.",
        )
    return _admin_listing_to_response(listing, db)


@router.patch(
    "/listings/{listing_id}/status",
    response_model=AdminListingResponse,
)
def update_listing_status(
    listing_id: str,
    data: ListingStatusUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if listing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found.",
        )

    listing.status = data.status
    listing.rejection_reason = (
        data.rejection_reason if data.status == "rejected" else None
    )
    try:
        db.commit()
        db.refresh(listing)
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to update the listing status. Please try again.",
        ) from error

    return _admin_listing_to_response(listing, db)
