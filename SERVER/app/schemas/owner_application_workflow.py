from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class ApplicationDecisionResult(BaseModel):
    application_id: str
    status: str
    updated_at: datetime


class RejectOwnerApplicationInput(BaseModel):
    reason: str = Field(min_length=1, max_length=2000)
    internal_note: str | None = Field(default=None, max_length=5000)

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("A rejection reason is required.")
        return normalized

    @field_validator("internal_note")
    @classmethod
    def normalize_internal_note(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class RequestApplicationInformationInput(BaseModel):
    message: str = Field(min_length=1, max_length=2000)

    @field_validator("message")
    @classmethod
    def validate_message(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError(
                "A message describing the missing information is required."
            )
        return normalized


class OwnerApplicationHistoryItem(BaseModel):
    action: str
    previous_status: str | None
    status: str
    changed_at: datetime
    message: str | None
    internal_note: str | None
    performed_by_admin_id: str


class OwnerInvitationSummary(BaseModel):
    id: str
    application_id: str
    status: Literal["ACTIVE", "EXPIRED", "REVOKED", "USED"]
    invited_phone: str
    expires_at: datetime
    created_at: datetime
    created_by_admin_id: str
    revoked_at: datetime | None
    accepted_at: datetime | None
    delivery_channel: str | None
    delivery_status: Literal["NOT_CONFIGURED", "PENDING", "DELIVERED", "FAILED"]


class OwnerInvitationPage(BaseModel):
    items: list[OwnerInvitationSummary]


class OwnerInvitationCreated(OwnerInvitationSummary):
    invitation_url: str


class OwnerInvitationValidationInput(BaseModel):
    token: str = Field(min_length=32, max_length=256)


class OwnerInvitationValidationResult(BaseModel):
    valid: bool
    status: Literal[
        "VALID",
        "INVALID",
        "APPLICATION_NOT_APPROVED",
        "EXPIRED",
        "REVOKED",
        "USED",
        "PHONE_MISMATCH",
        "EMAIL_MISSING",
    ]
    message: str
    expires_at: datetime | None = None
    applicant_name: str | None = None
    applicant_phone: str | None = None
    applicant_email: str | None = None
    pg_name: str | None = None
    city: str | None = None
    area: str | None = None


class OwnerRegistrationInput(BaseModel):
    token: str = Field(min_length=32, max_length=256)
    password: str = Field(min_length=8, max_length=128)
    terms_accepted: bool

    @field_validator("terms_accepted")
    @classmethod
    def require_terms_acceptance(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Accept the Terms and Conditions to continue.")
        return value


class OwnerRegistrationResult(BaseModel):
    success: bool
    full_name: str
    phone_number: str
    registered_at: datetime
