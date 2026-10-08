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
) -> Listing | None:
    """
    Find a likely duplicate using owner phone + location/address.

    Phone is used as a strong verification signal.
    We do NOT treat the same area alone as a duplicate because
    multiple different hostels can exist in the same area.
    """

    owner_phone = normalize_phone(data.owner_phone)
    city = normalize_text(data.city)
    area = normalize_text(data.area)
    address = normalize_text(data.address)

    listings = db.query(Listing).all()

    for listing in listings:
        existing_phone = normalize_phone(listing.owner_phone)

        # Strong duplicate signal:
        # same owner phone + same city + same area + same address
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
        monthly_price=0,
        total_beds=0,
        available_beds=0,
        filled_beds=0,

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