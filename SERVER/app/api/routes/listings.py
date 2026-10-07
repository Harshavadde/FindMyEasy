from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.listing import Listing
from app.models.listing_sharing import ListingSharing
from app.schemas.listing import ListingCreate, ListingResponse
from app.services.listing_service import create_listing


router = APIRouter(
    prefix="/api/v1/owner/listings",
    tags=["Owner - Listings"],
)


def listing_to_response(
    listing: Listing,
) -> ListingResponse:
    return ListingResponse(
        id=listing.id,
        owner_phone=listing.owner_phone,
        name=listing.name,
        property_type=listing.property_type,
        gender=listing.gender,
        description=listing.description,
        monthly_price=listing.monthly_price,
        security_deposit=listing.security_deposit,
        total_beds=listing.total_beds,
        available_beds=listing.available_beds,
        filled_beds=listing.filled_beds,
        sharing=[
            item.sharing_type
            for item in listing.sharing
        ],
        ac_type=listing.ac_type,
        facilities=listing.facilities or [],
        food_available=listing.food_available,
        breakfast_time=listing.breakfast_time,
        lunch_time=listing.lunch_time,
        dinner_time=listing.dinner_time,
        city=listing.city,
        area=listing.area,
        address=listing.address,
        latitude=listing.latitude,
        longitude=listing.longitude,
        restrictions=listing.restrictions,
        status=listing.status,
    )


# ============================================================
# CREATE LISTING
# POST /api/v1/owner/listings
# ============================================================

@router.post(
    "",
    response_model=ListingResponse,
)
def create_owner_listing(
    data: ListingCreate,
    db: Session = Depends(get_db),
):
    listing, is_duplicate = create_listing(
        db=db,
        data=data,
    )

    if is_duplicate:
        raise HTTPException(
            status_code=409,
            detail=(
                "A hostel/PG already exists for this owner "
                "at the same location and address."
            ),
        )

    return listing_to_response(listing)


# ============================================================
# GET ALL LISTINGS
# GET /api/v1/owner/listings
# ============================================================

@router.get(
    "",
    response_model=list[ListingResponse],
)
def get_owner_listings(
    db: Session = Depends(get_db),
):
    listings = (
        db.query(Listing)
        .order_by(Listing.created_at.desc())
        .all()
    )

    return [
        listing_to_response(listing)
        for listing in listings
    ]


# ============================================================
# GET ONE LISTING
# GET /api/v1/owner/listings/{listing_id}
# ============================================================

@router.get(
    "/{listing_id}",
    response_model=ListingResponse,
)
def get_owner_listing(
    listing_id: str,
    db: Session = Depends(get_db),
):
    listing = (
        db.query(Listing)
        .filter(Listing.id == listing_id)
        .first()
    )

    if not listing:
        raise HTTPException(
            status_code=404,
            detail="Listing not found.",
        )

    return listing_to_response(listing)


# ============================================================
# DELETE LISTING
# DELETE /api/v1/owner/listings/{listing_id}
# ============================================================

@router.delete(
    "/{listing_id}",
    status_code=status.HTTP_200_OK,
)
def delete_owner_listing(
    listing_id: str,
    db: Session = Depends(get_db),
):
    listing = (
        db.query(Listing)
        .filter(Listing.id == listing_id)
        .first()
    )

    if not listing:
        raise HTTPException(
            status_code=404,
            detail="Listing not found.",
        )

    listing_name = listing.name

    # Delete sharing records explicitly.
    # This keeps the database clean even if
    # database-level cascade is not enabled.
    db.query(ListingSharing).filter(
        ListingSharing.listing_id == listing_id
    ).delete(
        synchronize_session=False
    )

    # Delete the listing itself.
    db.delete(listing)

    db.commit()

    return {
        "success": True,
        "message": "Listing deleted successfully.",
        "listing_id": listing_id,
        "listing_name": listing_name,
    }