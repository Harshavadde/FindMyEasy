from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db
from app.models.listing import Listing
from app.models.listing_image import ListingImage


router = APIRouter(
    prefix="/api/v1/listings",
    tags=["Public - Listings"],
)


def build_image_url(value: Any) -> str | None:
    """
    Convert the stored image path into a complete URL
    that the mobile app can access.

    Example:
        /uploads/listings/abc/image.jpg

    becomes:

        http://192.168.0.10:8000/uploads/listings/abc/image.jpg
    """

    if value is None:
        return None

    value = str(value).strip()

    if not value:
        return None

    # Already a complete URL.
    if value.startswith("http://") or value.startswith("https://"):
        return value

    # Make sure the path starts with "/".
    if not value.startswith("/"):
        value = f"/{value}"

    return (
        f"{settings.PUBLIC_BASE_URL.rstrip('/')}"
        f"{value}"
    )


def image_to_dict(image: ListingImage) -> dict:
    """
    Convert ListingImage into the format required
    by the mobile application.
    """

    image_type = (
        getattr(image, "image_type", None)
        or getattr(image, "type", None)
        or getattr(image, "category", None)
        or "PROPERTY"
    )

    image_url = (
        getattr(image, "image_url", None)
        or getattr(image, "url", None)
        or getattr(image, "file_url", None)
        or getattr(image, "path", None)
        or getattr(image, "file_path", None)
        or getattr(image, "filename", None)
    )

    return {
        "id": str(getattr(image, "id", "")),
        "image_type": str(image_type),
        "url": build_image_url(image_url),
    }


def listing_to_public_response(
    listing: Listing,
    db: Session,
) -> dict:

    images = (
        db.query(ListingImage)
        .filter(
            ListingImage.listing_id == listing.id
        )
        .all()
    )

    image_data = [
        image_to_dict(image)
        for image in images
    ]

    # COVER images should appear first.
    cover_images = [
        image
        for image in image_data
        if image["image_type"].upper() == "COVER"
    ]

    # PROPERTY images should appear after COVER.
    property_images = [
        image
        for image in image_data
        if image["image_type"].upper() == "PROPERTY"
    ]

    remaining_images = [
        image
        for image in image_data
        if image not in cover_images
        and image not in property_images
    ]

    ordered_images = (
        cover_images
        + property_images
        + remaining_images
    )

    return {
        "id": listing.id,
        "owner_phone": listing.owner_phone,

        "name": listing.name,
        "property_type": listing.property_type,
        "gender": listing.gender,

        "description": listing.description,

        "monthly_price": listing.monthly_price,
        "security_deposit": listing.security_deposit,

        "total_beds": listing.total_beds,
        "available_beds": listing.available_beds,
        "filled_beds": listing.filled_beds,

        "sharing": [
            item.sharing_type
            for item in listing.sharing
        ],

        "ac_type": listing.ac_type,

        "facilities": listing.facilities or [],

        "food_available": listing.food_available,
        "food_type": listing.food_type,

        "breakfast_start_time": listing.breakfast_start_time,
        "breakfast_end_time": listing.breakfast_end_time,

        "lunch_start_time": listing.lunch_start_time,
        "lunch_end_time": listing.lunch_end_time,

        "dinner_start_time": listing.dinner_start_time,
        "dinner_end_time": listing.dinner_end_time,

        "city": listing.city,
        "area": listing.area,
        "address": listing.address,

        "latitude": listing.latitude,
        "longitude": listing.longitude,

        "restrictions": listing.restrictions,

        "status": listing.status,

        "images": ordered_images,
    }


@router.get("")
def get_public_listings(
    city: str | None = Query(default=None),
    area: str | None = Query(default=None),
    property_type: str | None = Query(default=None),
    gender: str | None = Query(default=None),
    min_price: int | None = Query(
        default=None,
        ge=0,
    ),
    max_price: int | None = Query(
        default=None,
        ge=0,
    ),
    db: Session = Depends(get_db),
):
    """
    Return listings from ALL owners.

    This endpoint is for the user marketplace,
    not the owner dashboard.
    """

    query = db.query(Listing)

    # Development stage:
    # Show all listings except explicitly inactive/deleted ones.
    query = query.filter(
        Listing.status.notin_(
            ["inactive", "deleted"]
        )
    )

    if city:
        query = query.filter(
            Listing.city.ilike(
                f"%{city.strip()}%"
            )
        )

    if area:
        query = query.filter(
            Listing.area.ilike(
                f"%{area.strip()}%"
            )
        )

    if property_type:
        query = query.filter(
            Listing.property_type == property_type
        )

    if gender:
        query = query.filter(
            Listing.gender == gender
        )

    if min_price is not None:
        query = query.filter(
            Listing.monthly_price >= min_price
        )

    if max_price is not None:
        query = query.filter(
            Listing.monthly_price <= max_price
        )

    listings = (
        query
        .order_by(Listing.created_at.desc())
        .all()
    )

    return {
        "success": True,
        "count": len(listings),
        "listings": [
            listing_to_public_response(
                listing,
                db,
            )
            for listing in listings
        ],
    }


@router.get("/{listing_id}")
def get_public_listing(
    listing_id: str,
    db: Session = Depends(get_db),
):
    """
    Return one listing for the user-side
    listing details screen.
    """

    listing = (
        db.query(Listing)
        .filter(
            Listing.id == listing_id
        )
        .first()
    )

    if not listing:
        raise HTTPException(
            status_code=404,
            detail="Listing not found.",
        )

    if listing.status in [
        "inactive",
        "deleted",
    ]:
        raise HTTPException(
            status_code=404,
            detail="Listing is not available.",
        )

    return listing_to_public_response(
        listing,
        db,
    )