import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

UserRoleValue = Literal["SEEKER", "OWNER"]


def normalize_phone_number(value: str) -> str:
    normalized = value.strip()
    if re.fullmatch(r"[6-9]\d{9}", normalized):
        normalized = f"+91{normalized}"
    if not re.fullmatch(r"\+91[6-9]\d{9}", normalized):
        raise ValueError(
            "Enter a valid Indian mobile number in +91XXXXXXXXXX format."
        )
    return normalized


class PhonePasswordRegisterRequest(BaseModel):
    phone_number: str
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=150)
    user_role: UserRoleValue = "SEEKER"

    @field_validator("phone_number")
    @classmethod
    def validate_phone_number(cls, value: str) -> str:
        return normalize_phone_number(value)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Password cannot be empty.")
        return value

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Full name cannot be empty.")
        return value


class PhonePasswordLoginRequest(BaseModel):
    phone_number: str
    password: str = Field(min_length=1, max_length=128)

    @field_validator("phone_number")
    @classmethod
    def validate_phone_number(cls, value: str) -> str:
        return normalize_phone_number(value)


class RequestOtpRequest(BaseModel):
    phone_number: str

    @field_validator("phone_number")
    @classmethod
    def validate_phone_number(cls, value: str) -> str:
        return normalize_phone_number(value)


class VerifyOtpRequest(RequestOtpRequest):
    otp: str = Field(pattern=r"^\d{6}$")
    full_name: str | None = Field(default=None, min_length=1, max_length=150)
    user_role: UserRoleValue | None = None

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("Full name cannot be empty.")
        return normalized


class ProfileUpdateRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=150)
    phone: str | None = Field(default=None, max_length=10)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Full name cannot be empty.")
        return value

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        value = value.strip()
        if not re.fullmatch(r"[6-9]\d{9}", value):
            raise ValueError(
                "Enter a valid 10-digit Indian mobile number starting with 6-9."
            )
        return value


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str | None = None
    phone_number: str | None = None
    user_role: UserRoleValue
    phone: str | None = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
