from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user
from app.api.routes.listings import listing_to_response
from app.db.database import get_db
from app.models.listing import Listing
from app.models.user import User
from app.schemas.listing import ListingResponse


router = APIRouter(
    prefix="/api/v1/admin",
    tags=["Admin"],
)


class ListingStatusUpdate(BaseModel):
    status: Literal["published", "rejected"]


def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.user_role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access is required.",
        )
    return current_user


@router.get(
    "/listings",
    response_model=list[ListingResponse],
)
def get_all_listings_for_review(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    listings = (
        db.query(Listing)
        .order_by(Listing.created_at.desc())
        .all()
    )
    return [listing_to_response(listing, db) for listing in listings]


@router.patch(
    "/listings/{listing_id}/status",
    response_model=ListingResponse,
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
    try:
        db.commit()
        db.refresh(listing)
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to update the listing status. Please try again.",
        ) from error

    return listing_to_response(listing, db)
