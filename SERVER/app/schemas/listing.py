from pydantic import BaseModel, Field, model_validator


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

    monthly_price: int = Field(
        ge=0,
    )

    security_deposit: int | None = Field(
        default=0,
        ge=0,
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

    sharing: list[str] = []

    ac_type: str

    facilities: list[str] = []

    food_available: str = "No"

    breakfast_time: str | None = None
    lunch_time: str | None = None
    dinner_time: str | None = None

    city: str
    area: str
    address: str

    latitude: str | None = None
    longitude: str | None = None

    restrictions: str | None = None

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

    sharing: list[str]

    ac_type: str

    facilities: list[str]

    food_available: str

    breakfast_time: str | None
    lunch_time: str | None
    dinner_time: str | None

    city: str
    area: str
    address: str

    latitude: str | None
    longitude: str | None

    restrictions: str | None

    status: str