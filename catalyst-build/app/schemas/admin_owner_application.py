from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.owner_application_workflow import OwnerApplicationHistoryItem


OwnerApplicationStatusValue = Literal[
    "SUBMITTED",
    "UNDER_REVIEW",
    "ADDITIONAL_INFORMATION_REQUIRED",
    "APPROVED",
    "REJECTED",
    "INVITATION_SENT",
    "INVITATION_ACCEPTED",
    "EXPIRED",
]

OwnerApplicationRelationshipValue = Literal[
    "PROPERTY_OWNER",
    "PROPERTY_MANAGER",
    "AUTHORIZED_REPRESENTATIVE",
]


class AdminOwnerApplicationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    application_reference: str
    applicant_name: str
    applicant_phone: str
    applicant_email: str | None
    relationship_type: OwnerApplicationRelationshipValue
    pg_name: str
    city: str
    area: str
    submitted_at: datetime
    status: OwnerApplicationStatusValue
    phone_verified: bool


class AdminOwnerApplicationPage(BaseModel):
    items: list[AdminOwnerApplicationSummary]
    cities: list[str]
    total: int
    page: int
    page_size: int
    total_pages: int


class AdminOwnerApplicationStats(BaseModel):
    total_applications: int
    submitted: int
    under_review: int
    additional_information_required: int
    approved: int
    rejected: int
    invitations_sent: int
    invitations_accepted: int
    expired: int


class AdminOwnerApplicationDetail(AdminOwnerApplicationSummary):
    address: str
    formatted_address: str | None
    latitude: float
    longitude: float
    google_place_id: str | None
    google_maps_url: str | None
    owner_user_id: str | None = None
    owner_account_created_at: datetime | None = None
    registration_completed_at: datetime | None = None
    last_updated_at: datetime | None = None
    status_history: list[OwnerApplicationHistoryItem] = Field(default_factory=list)
    history_available: bool = False
