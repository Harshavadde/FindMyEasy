from datetime import datetime

from pydantic import BaseModel, Field, model_validator


# ============================================================
# SHARING CREATE
# ============================================================


class ListingImageResponse(BaseModel):
    id: str
    image_url: str
    thumbnail_url: str | None = None
    image_type: str
    original_filename: str | None = None

class ListingSharingCreate(BaseModel):
    id: str | None = None

    sharing_type: str = Field(min_length=1, max_length=50)
    ac_type: str = Field(default="Non-AC", max_length=20)
    floor: str | None = Field(default=None, max_length=50)

    monthly_price: int = Field(gt=0)
    total_beds: int = Field(gt=0)
    available_beds: int = Field(ge=0)
    filled_beds: int = Field(ge=0)

    @model_validator(mode="after")
    def validate_beds(self):
        if self.available_beds + self.filled_beds != self.total_beds:
            raise ValueError(
                "Available beds + filled beds must equal total beds."
            )
        return self


# ============================================================
# LISTING CREATE
# ============================================================

class ListingCreate(BaseModel):
    owner_phone: str = Field(
        min_length=10,
        max_length=20,
    )

    name: str = Field(
        min_length=2,
        max_length=200,
    )

    property_type: str

    gender: str

    description: str | None = None

    security_deposit: int | None = Field(
        default=0,
        ge=0,
    )

    # --------------------------------------------------------
    # SHARING
    # Each selected sharing has its own:
    # - monthly price
    # - total beds
    # - available beds
    # - filled beds
    # --------------------------------------------------------

    sharing: list[ListingSharingCreate] = Field(
        min_length=1,
    )

    # --------------------------------------------------------
    # PROPERTY
    # --------------------------------------------------------

    ac_type: str

    facilities: list[str] = []

    # --------------------------------------------------------
    # FOOD
    # --------------------------------------------------------

    food_available: str = "No"

    food_type: str | None = None

    breakfast_start_time: str | None = None
    breakfast_end_time: str | None = None

    lunch_start_time: str | None = None
    lunch_end_time: str | None = None

    dinner_start_time: str | None = None
    dinner_end_time: str | None = None

    # --------------------------------------------------------
    # LOCATION
    # --------------------------------------------------------

    city: str

    area: str

    address: str

    latitude: str | None = None

    longitude: str | None = None

    restrictions: str | None = None


# ============================================================
# SHARING RESPONSE
# ============================================================

class ListingSharingResponse(BaseModel):
    id: str
    sharing_type: str
    ac_type: str = "Non-AC"
    floor: str | None = None
    monthly_price: int
    total_beds: int
    available_beds: int
    filled_beds: int


# ============================================================
# LISTING RESPONSE
# ============================================================

class ListingResponse(BaseModel):
    id: str

    owner_phone: str | None

    name: str

    property_type: str

    gender: str

    description: str | None

    monthly_price: int

    security_deposit: int | None

    total_beds: int

    available_beds: int

    filled_beds: int

    # Each listing can have multiple sharing types.
    sharing: list[ListingSharingResponse]

    images: list[ListingImageResponse] = Field(
    default_factory=list
)


    ac_type: str

    facilities: list[str]

    # --------------------------------------------------------
    # FOOD
    # --------------------------------------------------------

    food_available: str

    food_type: str | None = None

    breakfast_start_time: str | None = None
    breakfast_end_time: str | None = None

    lunch_start_time: str | None = None
    lunch_end_time: str | None = None

    dinner_start_time: str | None = None
    dinner_end_time: str | None = None

    # --------------------------------------------------------
    # LOCATION
    # --------------------------------------------------------

    city: str | None = None
    area: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None

    restrictions: str | None = None

    status: str


class AdminListingResponse(ListingResponse):
    owner_name: str | None = None
    owner_email: str | None = None
    owner_user_role: str | None = None
    owner_is_active: bool | None = None
    created_at: datetime
    updated_at: datetime
    rejection_reason: str | None = None


class AdminListingSummary(BaseModel):
    id: str
    name: str
    property_type: str
    gender: str
    monthly_price: int
    total_beds: int
    available_beds: int
    filled_beds: int
    city: str | None = None
    area: str | None = None
    owner_phone: str | None = None
    status: str
    preview_image_url: str | None = None
    owner_name: str | None = None
    owner_email: str | None = None
    created_at: datetime
    updated_at: datetime
    rejection_reason: str | None = None


class AdminListingPage(BaseModel):
    items: list[AdminListingSummary]
    cities: list[str]
    total: int
    total_listings: int
    review_count: int
    published_count: int
    rejected_count: int
    page: int
    page_size: int
    total_pages: int