from pydantic import BaseModel, Field, model_validator


# ============================================================
# SHARING CREATE
# ============================================================

class ListingSharingCreate(BaseModel):
    sharing_type: str = Field(
        min_length=1,
        max_length=50,
    )

    monthly_price: int = Field(
        gt=0,
    )

    total_beds: int = Field(
        gt=0,
    )

    available_beds: int = Field(
        ge=0,
    )

    filled_beds: int = Field(
        ge=0,
    )

    @model_validator(mode="after")
    def validate_beds(self):
        if self.available_beds + self.filled_beds != self.total_beds:
            raise ValueError(
                "Available beds + filled beds must equal total beds."
            )

        if self.available_beds > self.total_beds:
            raise ValueError(
                "Available beds cannot exceed total beds."
            )

        if self.filled_beds > self.total_beds:
            raise ValueError(
                "Filled beds cannot exceed total beds."
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

    security_deposit: int | None

    # Each listing can have multiple sharing types.
    sharing: list[ListingSharingResponse]

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

    status: str