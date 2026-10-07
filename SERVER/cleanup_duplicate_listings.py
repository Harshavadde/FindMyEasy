import re

from app.db.database import SessionLocal
from app.models.listing import Listing
from app.models.listing_sharing import ListingSharing
from app.models.listing_image import ListingImage


def normalize_text(value):
    if not value:
        return ""

    value = value.strip().lower()
    value = re.sub(r"\s+", " ", value)
    value = re.sub(r"\s*,\s*", ",", value)

    return value


db = SessionLocal()

try:
    listings = (
        db.query(Listing)
        .order_by(Listing.created_at.desc())
        .all()
    )

    unique = {}
    duplicates = []

    for listing in listings:

        key = (
            normalize_text(listing.city),
            normalize_text(listing.area),
            normalize_text(listing.address),
        )

        if key not in unique:
            # Keep the newest listing
            unique[key] = listing

        else:
            duplicates.append(listing)

    print()
    print("========================================")
    print("DUPLICATE LISTING CLEANUP")
    print("========================================")
    print(
        "Total listings:",
        len(listings),
    )
    print(
        "Unique listings:",
        len(unique),
    )
    print(
        "Duplicates:",
        len(duplicates),
    )
    print("========================================")

    for listing in duplicates:
        print(
            "Deleting duplicate:",
            listing.id,
            "|",
            listing.name,
            "|",
            listing.address,
        )

        # Delete associated image database records
        db.query(ListingImage).filter(
            ListingImage.listing_id
            == listing.id
        ).delete(
            synchronize_session=False
        )

        # Delete listing
        db.delete(listing)

    db.commit()

    print()
    print(
        "Duplicate cleanup completed successfully."
    )

finally:
    db.close()