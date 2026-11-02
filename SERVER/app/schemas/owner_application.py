from datetime import datetime
from typing import Literal

from pydantic import (
    BaseModel,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)

from app.schemas.auth import normalize_phone_number


RelationshipType = Literal[
    "PROPERTY_OWNER",
    "PROPERTY_MANAGER",
    "AUTHORIZED_REPRESENTATIVE",
]


def _normalize_text(value: str) -> str:
    return " ".join(value.split())


class OwnerApplicationCreate(BaseModel):
    applicant_name: str = Field(min_length=1, max_length=150)
    applicant_phone: str
    applicant_email: EmailStr | None = None
    relationship_type: RelationshipType
    pg_name: str = Field(min_length=2, max_length=200)
    city: str = Field(min_length=1, max_length=100)
    area: str = Field(min_length=1, max_length=150)
    address: str = Field(min_length=5, max_length=2000)
    formatted_address: str | None = Field(default=None, max_length=2000)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    google_place_id: str | None = Field(default=None, max_length=255)
    google_maps_url: str | None = Field(default=None, max_length=2048)
    declaration_accepted: bool

    @field_validator(
        "applicant_name",
        "pg_name",
        "city",
        "area",
        "address",
        "formatted_address",
        "google_place_id",
        mode="before",
    )
    @classmethod
    def normalize_fields(cls, value: object) -> object:
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError("This field must be text.")
        return _normalize_text(value)

    @field_validator("applicant_name", "pg_name", "city", "area", "address")
    @classmethod
    def require_nonempty_text(cls, value: str) -> str:
        if not value:
            raise ValueError("This field cannot be empty.")
        return value

    @field_validator("applicant_phone")
    @classmethod
    def validate_applicant_phone(cls, value: str) -> str:
        if not isinstance(value, str):
            raise ValueError("Enter a valid Indian mobile number.")
        return normalize_phone_number(value)

    @field_validator("applicant_email", mode="before")
    @classmethod
    def normalize_email(cls, value: object) -> object:
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError("Enter a valid email address.")
        return value.strip().lower()

    @field_validator("google_maps_url")
    @classmethod
    def validate_google_maps_url(cls, value: str | None) -> str | None:
        if value is not None and not value.startswith(
            ("https://www.google.com/maps/", "https://maps.google.com/")
        ):
            raise ValueError("Enter a valid Google Maps URL.")
        return value

    @model_validator(mode="after")
    def validate_application(self):
        if self.declaration_accepted is not True:
            raise ValueError("Accept the partnership declaration to continue.")
        return self


class OwnerApplicationCreateResponse(BaseModel):
    application_reference: str
    status: Literal["SUBMITTED"]
    submitted_at: datetime
    status_access_key: str
    phone_verification_required: bool = False


class OwnerApplicationStatusRequest(BaseModel):
    status_access_key: str = Field(min_length=32, max_length=128)

    @field_validator("status_access_key")
    @classmethod
    def trim_status_access_key(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 32:
            raise ValueError("A valid status access key is required.")
        return value


class OwnerApplicationStatusResponse(BaseModel):
    application_reference: str
    status: str
    submitted_at: datetime
    message: str
