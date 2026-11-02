import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    func,
    text,
)

from app.db.database import Base


class OwnerApplication(Base):
    __tablename__ = "owner_applications"
    __table_args__ = (
        CheckConstraint(
            "relationship_type IN "
            "('PROPERTY_OWNER', 'PROPERTY_MANAGER', 'AUTHORIZED_REPRESENTATIVE')",
            name="ck_owner_applications_relationship_type",
        ),
        CheckConstraint(
            "status IN ('SUBMITTED', 'UNDER_REVIEW', "
            "'ADDITIONAL_INFORMATION_REQUIRED', 'APPROVED', 'REJECTED', "
            "'INVITATION_SENT', 'INVITATION_ACCEPTED', 'EXPIRED')",
            name="ck_owner_applications_status",
        ),
        CheckConstraint(
            "latitude >= -90 AND latitude <= 90",
            name="ck_owner_applications_latitude",
        ),
        CheckConstraint(
            "longitude >= -180 AND longitude <= 180",
            name="ck_owner_applications_longitude",
        ),
        Index("ix_owner_applications_status_submitted_at", "status", "submitted_at"),
    )

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    application_reference = Column(String(24), nullable=False, unique=True)
    applicant_name = Column(String(150), nullable=False)
    applicant_phone = Column(String(15), nullable=False)
    applicant_email = Column(String(255), nullable=True)
    relationship_type = Column(String(40), nullable=False)
    pg_name = Column(String(200), nullable=False)
    city = Column(String(100), nullable=False)
    area = Column(String(150), nullable=False)
    address = Column(Text, nullable=False)
    formatted_address = Column(Text, nullable=True)
    latitude = Column(Numeric(10, 7), nullable=False)
    longitude = Column(Numeric(10, 7), nullable=False)
    google_place_id = Column(String(255), nullable=True)
    google_maps_url = Column(String(2048), nullable=True)
    owner_user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
        unique=True,
    )
    registration_completed_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(
        String(40),
        nullable=False,
        default="SUBMITTED",
        server_default="SUBMITTED",
    )
    phone_verified = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    declaration_version = Column(
        String(32),
        nullable=False,
        default="owner-partnership-v1",
        server_default="owner-partnership-v1",
    )
    declaration_accepted_at = Column(DateTime(timezone=True), nullable=False)
    status_access_hash = Column(String(64), nullable=False, unique=True)
    submitted_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


Index(
    "uq_owner_applications_active_duplicate",
    func.lower(OwnerApplication.applicant_phone),
    func.lower(OwnerApplication.pg_name),
    func.lower(OwnerApplication.city),
    func.lower(OwnerApplication.area),
    func.lower(OwnerApplication.address),
    unique=True,
    postgresql_where=text("status = 'SUBMITTED'"),
    sqlite_where=text("status = 'SUBMITTED'"),
)
