from pathlib import Path
import re
import uuid

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.models.listing import Listing
from app.models.listing_sharing import ListingSharing
from app.models.hostel_member import HostelMember
from app.schemas.member import MemberCreate, MemberUpdate


ALLOWED_AADHAAR_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

MAX_AADHAAR_SIZE = 5 * 1024 * 1024


def normalize_phone(value: str | None) -> str:
    if not value:
        return ""

    return re.sub(r"\D", "", value)


def verify_listing_owner(
    db: Session,
    listing_id: str,
    owner_phone: str,
) -> Listing:
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

    requested_phone = normalize_phone(owner_phone)
    listing_phone = normalize_phone(listing.owner_phone)

    if not requested_phone or requested_phone != listing_phone:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to manage this listing.",
        )

    return listing


def get_sharing_for_listing(
    db: Session,
    listing_id: str,
    sharing_id: str,
) -> ListingSharing:
    sharing = (
        db.query(ListingSharing)
        .filter(
            ListingSharing.id == sharing_id,
            ListingSharing.listing_id == listing_id,
        )
        .first()
    )

    if not sharing:
        raise HTTPException(
            status_code=404,
            detail="Selected sharing option was not found for this listing.",
        )

    return sharing


def sync_sharing_counts(
    db: Session,
    sharing: ListingSharing,
) -> None:
    active_members = (
        db.query(HostelMember)
        .filter(
            HostelMember.sharing_id == sharing.id,
            HostelMember.status == "active",
        )
        .count()
    )

    if active_members > sharing.total_beds:
        raise HTTPException(
            status_code=400,
            detail="Active members cannot exceed total beds.",
        )

    sharing.filled_beds = active_members
    sharing.available_beds = sharing.total_beds - active_members


def validate_amounts(
    amount_to_pay: int,
    amount_paid: int,
) -> None:
    if amount_paid > amount_to_pay:
        raise HTTPException(
            status_code=400,
            detail="Amount paid cannot be greater than amount to pay.",
        )


def validate_dates(
    joining_date,
    leaving_date,
) -> None:
    if leaving_date and leaving_date < joining_date:
        raise HTTPException(
            status_code=400,
            detail="Leaving date cannot be before joining date.",
        )


def check_duplicate_active_member(
    db: Session,
    listing_id: str,
    phone: str,
    exclude_member_id: str | None = None,
) -> None:
    normalized_phone = normalize_phone(phone)

    query = (
        db.query(HostelMember)
        .filter(
            HostelMember.listing_id == listing_id,
            HostelMember.status == "active",
        )
    )

    members = query.all()

    for member in members:
        if exclude_member_id and member.id == exclude_member_id:
            continue

        if normalize_phone(member.phone) == normalized_phone:
            raise HTTPException(
                status_code=400,
                detail="An active member with this phone number already exists in this property.",
            )


async def save_aadhaar_photo(
    upload: UploadFile,
    private_directory: str,
) -> str:
    if upload.content_type not in ALLOWED_AADHAAR_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Aadhaar photo must be JPG, PNG, or WEBP.",
        )

    content = await upload.read()

    if len(content) > MAX_AADHAAR_SIZE:
        raise HTTPException(
            status_code=400,
            detail="Aadhaar photo must be smaller than 5 MB.",
        )

    directory = Path(private_directory)
    directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    extension = ALLOWED_AADHAAR_TYPES[upload.content_type]

    filename = f"{uuid.uuid4()}{extension}"

    file_path = directory / filename

    file_path.write_bytes(content)

    return str(file_path)


def calculate_pending(
    amount_to_pay: int,
    amount_paid: int,
) -> int:
    return max(amount_to_pay - amount_paid, 0)


def create_member(
    db: Session,
    listing_id: str,
    data: MemberCreate,
    aadhaar_photo_path: str | None = None,
):
    listing = verify_listing_owner(
        db=db,
        listing_id=listing_id,
        owner_phone=data.owner_phone,
    )

    sharing = get_sharing_for_listing(
        db=db,
        listing_id=listing.id,
        sharing_id=data.sharing_id,
    )

    validate_amounts(
        amount_to_pay=data.amount_to_pay,
        amount_paid=data.amount_paid,
    )

    validate_dates(
        joining_date=data.joining_date,
        leaving_date=data.leaving_date,
    )

    check_duplicate_active_member(
        db=db,
        listing_id=listing.id,
        phone=data.phone,
    )

    if sharing.available_beds <= 0:
        raise HTTPException(
            status_code=400,
            detail=f"No available beds in {sharing.sharing_type} sharing.",
        )

    member = HostelMember(
        id=str(uuid.uuid4()),
        listing_id=listing.id,
        sharing_id=sharing.id,
        name=data.name,
        phone=data.phone,
        aadhaar_photo_path=aadhaar_photo_path,
        room_number=data.room_number,
        amount_to_pay=data.amount_to_pay,
        amount_paid=data.amount_paid,
        amount_pending=calculate_pending(
            data.amount_to_pay,
            data.amount_paid,
        ),
        food_preference=data.food_preference,
        joining_date=data.joining_date,
        leaving_date=data.leaving_date,
        status="active",
    )

    db.add(member)

    sharing.filled_beds += 1
    sharing.available_beds -= 1

    db.commit()
    db.refresh(member)

    return member


def get_members(
    db: Session,
    listing_id: str,
    owner_phone: str,
):
    listing = verify_listing_owner(
        db=db,
        listing_id=listing_id,
        owner_phone=owner_phone,
    )

    return (
        db.query(HostelMember)
        .filter(HostelMember.listing_id == listing.id)
        .order_by(HostelMember.created_at.desc())
        .all()
    )


def get_member(
    db: Session,
    listing_id: str,
    member_id: str,
    owner_phone: str,
):
    listing = verify_listing_owner(
        db=db,
        listing_id=listing_id,
        owner_phone=owner_phone,
    )

    member = (
        db.query(HostelMember)
        .filter(
            HostelMember.id == member_id,
            HostelMember.listing_id == listing.id,
        )
        .first()
    )

    if not member:
        raise HTTPException(
            status_code=404,
            detail="Member not found.",
        )

    return member


def update_member(
    db: Session,
    listing_id: str,
    member_id: str,
    data: MemberUpdate,
):
    member = get_member(
        db=db,
        listing_id=listing_id,
        member_id=member_id,
        owner_phone=data.owner_phone,
    )

    old_sharing_id = member.sharing_id

    if data.sharing_id and data.sharing_id != member.sharing_id:
        new_sharing = get_sharing_for_listing(
            db=db,
            listing_id=listing_id,
            sharing_id=data.sharing_id,
        )

        if new_sharing.available_beds <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"No available beds in {new_sharing.sharing_type} sharing.",
            )

        member.sharing_id = new_sharing.id

    if data.name is not None:
        member.name = data.name

    if data.phone is not None:
        check_duplicate_active_member(
            db=db,
            listing_id=listing_id,
            phone=data.phone,
            exclude_member_id=member.id,
        )
        member.phone = data.phone

    if data.room_number is not None:
        member.room_number = data.room_number

    if data.amount_to_pay is not None:
        member.amount_to_pay = data.amount_to_pay

    if data.amount_paid is not None:
        member.amount_paid = data.amount_paid

    validate_amounts(
        amount_to_pay=member.amount_to_pay,
        amount_paid=member.amount_paid,
    )

    if data.food_preference is not None:
        member.food_preference = data.food_preference

    if data.joining_date is not None:
        member.joining_date = data.joining_date

    if data.leaving_date is not None:
        member.leaving_date = data.leaving_date

    validate_dates(
        joining_date=member.joining_date,
        leaving_date=member.leaving_date,
    )

    if data.status is not None:
        if data.status not in {"active", "left"}:
            raise HTTPException(
                status_code=400,
                detail="Status must be 'active' or 'left'.",
            )

        member.status = data.status

    if member.leaving_date and member.status == "active":
        member.status = "left"

    member.amount_pending = calculate_pending(
        member.amount_to_pay,
        member.amount_paid,
    )

    old_sharing = (
        db.query(ListingSharing)
        .filter(ListingSharing.id == old_sharing_id)
        .first()
    )

    new_sharing = (
        db.query(ListingSharing)
        .filter(ListingSharing.id == member.sharing_id)
        .first()
    )

    if old_sharing:
        sync_sharing_counts(
            db=db,
            sharing=old_sharing,
        )

    if new_sharing and new_sharing.id != old_sharing_id:
        sync_sharing_counts(
            db=db,
            sharing=new_sharing,
        )

    db.commit()
    db.refresh(member)

    return member


def delete_member(
    db: Session,
    listing_id: str,
    member_id: str,
    owner_phone: str,
):
    member = get_member(
        db=db,
        listing_id=listing_id,
        member_id=member_id,
        owner_phone=owner_phone,
    )

    sharing = (
        db.query(ListingSharing)
        .filter(ListingSharing.id == member.sharing_id)
        .first()
    )

    aadhaar_path = member.aadhaar_photo_path

    db.delete(member)

    if sharing:
        db.flush()

        sync_sharing_counts(
            db=db,
            sharing=sharing,
        )

    db.commit()

    if aadhaar_path:
        try:
            path = Path(aadhaar_path)

            if path.exists():
                path.unlink()
        except OSError:
            pass

    return {
        "message": "Member deleted successfully.",
    }


def get_member_stats(
    db: Session,
    listing_id: str,
    owner_phone: str,
):
    listing = verify_listing_owner(
        db=db,
        listing_id=listing_id,
        owner_phone=owner_phone,
    )

    members = (
        db.query(HostelMember)
        .filter(
            HostelMember.listing_id == listing.id,
            HostelMember.status == "active",
        )
        .all()
    )

    sharing_options = (
        db.query(ListingSharing)
        .filter(ListingSharing.listing_id == listing.id)
        .all()
    )

    total_members = len(members)

    veg_members = sum(
        1
        for member in members
        if member.food_preference == "veg"
    )

    non_veg_members = sum(
        1
        for member in members
        if member.food_preference == "non_veg"
    )

    total_beds = sum(
        sharing.total_beds
        for sharing in sharing_options
    )

    occupied_beds = total_members

    available_beds = max(
        total_beds - occupied_beds,
        0,
    )

    total_amount = sum(
        member.amount_to_pay
        for member in members
    )

    paid_amount = sum(
        member.amount_paid
        for member in members
    )

    pending_amount = sum(
        member.amount_pending
        for member in members
    )

    return {
        "total_members": total_members,
        "veg_members": veg_members,
        "non_veg_members": non_veg_members,
        "total_beds": total_beds,
        "occupied_beds": occupied_beds,
        "available_beds": available_beds,
        "total_amount": total_amount,
        "paid_amount": paid_amount,
        "pending_amount": pending_amount,
    }