from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session
from datetime import date

from app.db.database import get_db
from app.schemas.member import (
    MemberCreate,
    MemberResponse,
    MemberStatsResponse,
    MemberUpdate,
)
from app.services.member_service import (
    create_member,
    delete_member,
    get_member,
    get_member_stats,
    get_members,
    save_aadhaar_photo,
    update_member,
)


router = APIRouter(
    prefix="/api/v1/owner/listings",
    tags=["Owner Members"],
)


PRIVATE_MEMBER_DOCUMENT_DIR = "private/member_documents"


def member_to_response(member) -> MemberResponse:
    return MemberResponse(
        id=member.id,
        listing_id=member.listing_id,
        sharing_id=member.sharing_id,
        sharing_type=member.sharing.sharing_type,
        name=member.name,
        phone=member.phone,
        aadhaar_photo_available=bool(member.aadhaar_photo_path),
        room_number=member.room_number,
        amount_to_pay=member.amount_to_pay,
        amount_paid=member.amount_paid,
        amount_pending=member.amount_pending,
        food_preference=member.food_preference,
        joining_date=member.joining_date,
        leaving_date=member.leaving_date,
        status=member.status,
    )


@router.get(
    "/{listing_id}/members",
    response_model=list[MemberResponse],
)
def list_members(
    listing_id: str,
    owner_phone: str,
    db: Session = Depends(get_db),
):
    members = get_members(
        db=db,
        listing_id=listing_id,
        owner_phone=owner_phone,
    )

    return [
        member_to_response(member)
        for member in members
    ]


@router.get(
    "/{listing_id}/members/stats",
    response_model=MemberStatsResponse,
)
def member_stats(
    listing_id: str,
    owner_phone: str,
    db: Session = Depends(get_db),
):
    return get_member_stats(
        db=db,
        listing_id=listing_id,
        owner_phone=owner_phone,
    )


@router.post(
    "/{listing_id}/members",
    response_model=MemberResponse,
)
async def add_member(
    listing_id: str,

    owner_phone: str = Form(...),

    name: str = Form(...),
    phone: str = Form(...),

    sharing_id: str = Form(...),
    room_number: str = Form(...),

    amount_to_pay: int = Form(...),
    amount_paid: int = Form(...),

    food_preference: str = Form("veg"),

    joining_date: str = Form(...),
    leaving_date: str | None = Form(None),

    aadhaar_photo: UploadFile | None = File(None),

    db: Session = Depends(get_db),
):
    from datetime import date

    try:
        parsed_joining_date = date.fromisoformat(
            joining_date
        )

        parsed_leaving_date = (
            date.fromisoformat(leaving_date)
            if leaving_date
            else None
        )

    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid date format. Use YYYY-MM-DD.",
        )

    data = MemberCreate(
        owner_phone=owner_phone,
        name=name,
        phone=phone,
        sharing_id=sharing_id,
        room_number=room_number,
        amount_to_pay=amount_to_pay,
        amount_paid=amount_paid,
        food_preference=food_preference,
        joining_date=parsed_joining_date,
        leaving_date=parsed_leaving_date,
    )

    aadhaar_photo_path = None

    if aadhaar_photo:
        aadhaar_photo_path = await save_aadhaar_photo(
            upload=aadhaar_photo,
            private_directory=PRIVATE_MEMBER_DOCUMENT_DIR,
        )

    try:
        member = create_member(
            db=db,
            listing_id=listing_id,
            data=data,
            aadhaar_photo_path=aadhaar_photo_path,
        )

    except Exception:
        if aadhaar_photo_path:
            try:
                path = Path(aadhaar_photo_path)

                if path.exists():
                    path.unlink()

            except OSError:
                pass

        raise

    return member_to_response(member)


@router.get(
    "/{listing_id}/members/{member_id}",
    response_model=MemberResponse,
)
def get_single_member(
    listing_id: str,
    member_id: str,
    owner_phone: str,
    db: Session = Depends(get_db),
):
    member = get_member(
        db=db,
        listing_id=listing_id,
        member_id=member_id,
        owner_phone=owner_phone,
    )

    return member_to_response(member)



@router.put(
    "/{listing_id}/members/{member_id}",
    response_model=MemberResponse,
)
async def edit_member(
    listing_id: str,
    member_id: str,

    owner_phone: str = Form(...),

    name: str = Form(...),
    phone: str = Form(...),

    sharing_id: str = Form(...),
    room_number: str = Form(...),

    amount_to_pay: int = Form(...),
    amount_paid: int = Form(...),

    food_preference: str = Form("veg"),

    joining_date: str = Form(...),
    leaving_date: str | None = Form(None),

    aadhaar_photo: UploadFile | None = File(None),

    db: Session = Depends(get_db),
):
    try:
        parsed_joining_date = date.fromisoformat(joining_date)

        parsed_leaving_date = (
            date.fromisoformat(leaving_date)
            if leaving_date
            else None
        )
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid date format. Use YYYY-MM-DD.",
        )

    # Build the update data expected by the service.
    data = MemberUpdate(
        owner_phone=owner_phone,
        name=name,
        phone=phone,
        sharing_id=sharing_id,
        room_number=room_number,
        amount_to_pay=amount_to_pay,
        amount_paid=amount_paid,
        food_preference=food_preference,
        joining_date=parsed_joining_date,
        leaving_date=parsed_leaving_date,
    )

    aadhaar_photo_path = None

    if aadhaar_photo:
        aadhaar_photo_path = await save_aadhaar_photo(
            upload=aadhaar_photo,
            private_directory=PRIVATE_MEMBER_DOCUMENT_DIR,
        )

    try:
        member = update_member(
        db=db,
        listing_id=listing_id,
        member_id=member_id,
        data=data,
    )
    except Exception:
        if aadhaar_photo_path:
            try:
                path = Path(aadhaar_photo_path)
                if path.exists():
                    path.unlink()
            except OSError:
                pass
        raise

    return member_to_response(member)



@router.delete(
    "/{listing_id}/members/{member_id}",
)
def remove_member(
    listing_id: str,
    member_id: str,
    owner_phone: str,
    db: Session = Depends(get_db),
):
    return delete_member(
        db=db,
        listing_id=listing_id,
        member_id=member_id,
        owner_phone=owner_phone,
    )