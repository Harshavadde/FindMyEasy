
import re

from pydantic import field_validator, BaseModel, EmailStr, Field, ConfigDict


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=150)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Full name cannot be empty.")
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator


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
    email: EmailStr
    full_name: str | None = None
    phone: str | None = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"
