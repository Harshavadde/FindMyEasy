from datetime import date

from pydantic import BaseModel, Field


class MemberCreate(BaseModel):
    owner_phone: str = Field(min_length=10, max_length=20)

    name: str = Field(min_length=2, max_length=200)
    phone: str = Field(min_length=10, max_length=20)

    sharing_id: str
    room_number: str = Field(min_length=1, max_length=50)

    amount_to_pay: int = Field(ge=0)
    amount_paid: int = Field(ge=0)

    food_preference: str = "veg"

    joining_date: date
    leaving_date: date | None = None


class MemberUpdate(BaseModel):
    owner_phone: str = Field(min_length=10, max_length=20)

    name: str | None = Field(default=None, min_length=2, max_length=200)
    phone: str | None = Field(default=None, min_length=10, max_length=20)

    sharing_id: str | None = None
    room_number: str | None = Field(default=None, max_length=50)

    amount_to_pay: int | None = Field(default=None, ge=0)
    amount_paid: int | None = Field(default=None, ge=0)

    food_preference: str | None = None

    joining_date: date | None = None
    leaving_date: date | None = None

    status: str | None = None


class MemberResponse(BaseModel):
    id: str
    listing_id: str
    sharing_id: str
    sharing_type: str

    name: str
    phone: str

    aadhaar_photo_available: bool

    room_number: str

    amount_to_pay: int
    amount_paid: int
    amount_pending: int

    food_preference: str

    joining_date: date
    leaving_date: date | None

    status: str


class MemberStatsResponse(BaseModel):
    total_members: int

    veg_members: int
    non_veg_members: int

    total_beds: int
    occupied_beds: int
    available_beds: int

    total_amount: int
    paid_amount: int
    pending_amount: int