import re

from sqlalchemy.orm import Session

from app.models.listing import Listing
from app.models.listing_sharing import ListingSharing
from app.schemas.listing import ListingCreate


def normalize_text(value: str | None) -> str:
    if not value:
        return ""

    value = value.lower().strip()
    value = re.sub(r"\s+", " ", value)
    value = re.sub(r"[,\.\-/#]+", " ", value)
    value = re.sub(r"\s+", " ", value)

    return value


def normalize_phone(value: str | None) -> str:
    if not value:
        return ""

    return re.sub(r"\D", "", value)



def find_duplicate_listing(
    db: Session,
    data: ListingCreate,
    exclude_listing_id: str | None = None,
) -> Listing | None:
    """Find another listing with the same owner and location/address."""

    owner_phone = normalize_phone(data.owner_phone)
    city = normalize_text(data.city)
    area = normalize_text(data.area)
    address = normalize_text(data.address)

    query = db.query(Listing)

    if exclude_listing_id:
        query = query.filter(Listing.id != exclude_listing_id)

    listings = query.all()

    for listing in listings:
        existing_phone = normalize_phone(listing.owner_phone)

        if (
            owner_phone
            and existing_phone
            and owner_phone == existing_phone
            and city == normalize_text(listing.city)
            and area == normalize_text(listing.area)
            and address == normalize_text(listing.address)
        ):
            return listing

    return None



def create_listing(
    db: Session,
    data: ListingCreate,
):
    existing_listing = find_duplicate_listing(
        db=db,
        data=data,
    )

    if existing_listing:
        return existing_listing, True

    
    # Calculate main listing bed counts from all sharing types
    total_beds = sum(
        int(sharing.total_beds or 0)
        for sharing in data.sharing
    )

    available_beds = sum(
        int(sharing.available_beds or 0)
        for sharing in data.sharing
    )

    filled_beds = sum(
        int(sharing.filled_beds or 0)
        for sharing in data.sharing
    )

    # Main listing price: use the lowest sharing price as the legacy value
    prices = [
        float(sharing.monthly_price or 0)
        for sharing in data.sharing
        if float(sharing.monthly_price or 0) > 0
    ]
    monthly_price = min(prices) if prices else 0

    # Do not allow an empty or invalid bed capacity
    if total_beds <= 0:
        raise ValueError(
            "Total beds must be greater than zero across all sharing types."
        )

    if available_beds < 0 or filled_beds < 0:
        raise ValueError("Bed counts cannot be negative.")

    if available_beds + filled_beds != total_beds:
        raise ValueError(
            "Available beds + filled beds must equal total beds."
        )


    # -------------------------------------------------------------------------
    # CREATE MAIN LISTING
    # -------------------------------------------------------------------------

    listing = Listing(
        owner_phone=data.owner_phone,
        name=data.name,
        property_type=data.property_type,
        gender=data.gender,
        description=data.description,
        security_deposit=data.security_deposit,

        # ---------------------------------------------------------------------
        # OLD GLOBAL FIELDS
        # ---------------------------------------------------------------------
        # These are kept temporarily because the existing SQLite database
        # still has these columns as NOT NULL.
        #
        # Actual pricing and bed capacity are stored in listing_sharing.
        # ---------------------------------------------------------------------
        monthly_price=monthly_price,
        total_beds=total_beds,
        available_beds=available_beds,
        filled_beds=filled_beds,

        ac_type=data.ac_type,
        facilities=data.facilities,

        food_available=data.food_available,
        food_type=data.food_type,

        breakfast_start_time=data.breakfast_start_time,
        breakfast_end_time=data.breakfast_end_time,

        lunch_start_time=data.lunch_start_time,
        lunch_end_time=data.lunch_end_time,

        dinner_start_time=data.dinner_start_time,
        dinner_end_time=data.dinner_end_time,

        city=data.city,
        area=data.area,
        address=data.address,

        latitude=data.latitude,
        longitude=data.longitude,

        restrictions=data.restrictions,
    )

    db.add(listing)

    # Flush first so listing.id is available for listing_sharing rows.
    db.flush()

    # -------------------------------------------------------------------------
    # CREATE SHARING ROWS
    # -------------------------------------------------------------------------

    for sharing in data.sharing:
        sharing_row = ListingSharing(
            listing_id=listing.id,
            sharing_type=sharing.sharing_type,
            monthly_price=sharing.monthly_price,
            total_beds=sharing.total_beds,
            available_beds=sharing.available_beds,
            filled_beds=sharing.filled_beds,
        )

        db.add(sharing_row)

    # -------------------------------------------------------------------------
    # SAVE
    # -------------------------------------------------------------------------

    db.commit()
    db.refresh(listing)

    return listing, False



def update_listing(
    db: Session,
    listing_id: str,
    data: ListingCreate,
):
    listing = (
        db.query(Listing)
        .filter(Listing.id == listing_id)
        .first()
    )

    if not listing:
        return None, False

    # Verify that the listing belongs to this owner.
    if (
        normalize_phone(listing.owner_phone)
        != normalize_phone(data.owner_phone)
    ):
        raise PermissionError("You cannot update this property.")

    # Check for another property at the submitted location.
    duplicate = find_duplicate_listing(
        db=db,
        data=data,
        exclude_listing_id=listing_id,
    )

    if duplicate:
        return None, True

    # Validate sharing bed counts.
    total_beds = sum(
        int(item.total_beds or 0) for item in data.sharing
    )
    available_beds = sum(
        int(item.available_beds or 0) for item in data.sharing
    )
    filled_beds = sum(
        int(item.filled_beds or 0) for item in data.sharing
    )

    if total_beds <= 0:
        raise ValueError(
            "Total beds must be greater than zero."
        )

    if (
        available_beds < 0
        or filled_beds < 0
        or available_beds + filled_beds != total_beds
    ):
        raise ValueError(
            "Available beds + filled beds must equal total beds."
        )

    prices = [
        float(item.monthly_price or 0)
        for item in data.sharing
        if float(item.monthly_price or 0) > 0
    ]
    monthly_price = min(prices) if prices else 0

    # Update the existing property. Do not create a new Listing.
    listing.name = data.name
    listing.property_type = data.property_type
    listing.gender = data.gender
    listing.description = data.description
    listing.security_deposit = data.security_deposit

    listing.monthly_price = monthly_price
    listing.total_beds = total_beds
    listing.available_beds = available_beds
    listing.filled_beds = filled_beds

    listing.ac_type = data.ac_type
    listing.facilities = data.facilities

    listing.food_available = data.food_available
    listing.food_type = data.food_type

    listing.breakfast_start_time = data.breakfast_start_time
    listing.breakfast_end_time = data.breakfast_end_time
    listing.lunch_start_time = data.lunch_start_time
    listing.lunch_end_time = data.lunch_end_time
    listing.dinner_start_time = data.dinner_start_time
    listing.dinner_end_time = data.dinner_end_time

    # Location is editable, but does not have to change.
    listing.city = data.city
    listing.area = data.area
    listing.address = data.address
    listing.latitude = data.latitude
    listing.longitude = data.longitude

    listing.restrictions = data.restrictions

    # Keep the existing property status unchanged.
    # Update sharing rows belonging to this listing only.
    db.query(ListingSharing).filter(
        ListingSharing.listing_id == listing_id
    ).delete(synchronize_session=False)

    for item in data.sharing:
        db.add(
            ListingSharing(
                listing_id=listing_id,
                sharing_type=item.sharing_type,
                monthly_price=item.monthly_price,
                total_beds=item.total_beds,
                available_beds=item.available_beds,
                filled_beds=item.filled_beds,
            )
        )

    try:
        db.commit()
        db.refresh(listing)
    except Exception:
        db.rollback()
        raise

    return listing, False
