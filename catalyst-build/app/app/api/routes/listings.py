from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user
from app.db.database import get_db
from app.models.listing import Listing
from app.models.listing_sharing import ListingSharing
from app.models.user import User
from app.schemas.listing import ListingCreate, ListingResponse
from app.services.listing_service import (create_listing, update_listing)
from app.models.listing_image import ListingImage


router = APIRouter(
    prefix="/api/v1/owner/listings",
    tags=["Owner - Listings"],
)


def listing_to_response(
    listing: Listing,
    db: Session,
) -> ListingResponse:
    
    listing_images = (
    db.query(ListingImage)
    .filter(ListingImage.listing_id == listing.id)
    .order_by(ListingImage.created_at.desc())
    .all()
)
    
    return ListingResponse(
        id=listing.id,

        owner_phone=listing.owner_phone,

        name=listing.name,

        property_type=listing.property_type,

        gender=listing.gender,

        description=listing.description,

        security_deposit=listing.security_deposit,

        
        sharing=[
            {
                "id": str(item.id),
                "sharing_type": item.sharing_type,
                "ac_type": item.ac_type,
                "floor": item.floor,
                "monthly_price": item.monthly_price,
                "total_beds": item.total_beds,
                "available_beds": item.available_beds,
                "filled_beds": item.filled_beds,
            }
            for item in listing.sharing
        ],


        images=[
            {
                "id": image.id,
                "image_url": image.image_url,
                "image_type": image.image_type,
                "original_filename": image.original_filename,
            }
            for image in listing_images
        ],

        ac_type=listing.ac_type,

        facilities=listing.facilities or [],

        food_available=listing.food_available,

        food_type=listing.food_type,

        breakfast_start_time=listing.breakfast_start_time,
        breakfast_end_time=listing.breakfast_end_time,

        lunch_start_time=listing.lunch_start_time,
        lunch_end_time=listing.lunch_end_time,

        dinner_start_time=listing.dinner_start_time,
        dinner_end_time=listing.dinner_end_time,

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
    current_user: User = Depends(get_current_user),
):
    listing, is_duplicate = create_listing(
        db=db,
        data=data,
        owner_id=current_user.id,
        owner_phone=current_user.phone or data.owner_phone,
    )

    if is_duplicate:
        raise HTTPException(
            status_code=409,
            detail=(
                "A hostel/PG already exists for this owner "
                "at the same location and address."
            ),
        )

    return listing_to_response(listing, db)


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
    current_user: User = Depends(get_current_user),
):
    listings = (
        db.query(Listing)
        .filter(Listing.owner_id == current_user.id)
        .order_by(Listing.created_at.desc())
        .all()
    )

    return [
        listing_to_response(listing, db)
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
    current_user: User = Depends(get_current_user),
):
    listing = (
        db.query(Listing)
        .filter(
            Listing.id == listing_id,
            Listing.owner_id == current_user.id,
        )
        .first()
    )

    if not listing:
        raise HTTPException(
            status_code=404,
            detail="Listing not found.",
        )

    return listing_to_response(listing, db)




# ============================================================
# UPDATE LISTING
# PUT /api/v1/owner/listings/{listing_id}
# ============================================================

@router.put(
    "/{listing_id}",
    response_model=ListingResponse,
)
def update_owner_listing(
    listing_id: str,
    data: ListingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        listing, is_duplicate = update_listing(
            db=db,
            listing_id=listing_id,
            data=data,
            owner_id=current_user.id,
            owner_phone=current_user.phone or data.owner_phone,
        )

        if is_duplicate:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Another hostel/PG already exists for "
                    "this owner at the same location and address."
                ),
            )

        if listing is None:
            raise HTTPException(
                status_code=404,
                detail="Listing not found.",
            )

        return listing_to_response(listing, db)

    except PermissionError as exc:
        raise HTTPException(
            status_code=403,
            detail=str(exc),
        ) from exc

    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc



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
    current_user: User = Depends(get_current_user),
):
    listing = (
        db.query(Listing)
        .filter(
            Listing.id == listing_id,
            Listing.owner_id == current_user.id,
        )
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