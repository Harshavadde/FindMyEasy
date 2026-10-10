import uuid

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Index,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base


class Listing(Base):
    __tablename__ = "listings"

    __table_args__ = (
        # Bed counts must always be consistent, even if a client sends bad data.
        CheckConstraint("total_beds > 0", name="ck_listings_total_beds_positive"),
        CheckConstraint("available_beds >= 0", name="ck_listings_available_beds_nonneg"),
        CheckConstraint("filled_beds >= 0", name="ck_listings_filled_beds_nonneg"),
        CheckConstraint(
            "available_beds + filled_beds = total_beds",
            name="ck_listings_beds_sum",
        ),
        CheckConstraint("monthly_price > 0", name="ck_listings_monthly_price_positive"),
        CheckConstraint(
            "security_deposit IS NULL OR security_deposit >= 0",
            name="ck_listings_security_deposit_nonneg",
        ),
        # Common tenant search: by city + area, only published listings.
        Index("ix_listings_city_area", "city", "area"),
        Index("ix_listings_status_city", "status", "city"),
    )

    # ------------------------------------------------------------------
    # IDENTITY & OWNER
    # ------------------------------------------------------------------

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    owner_id = Column(
        String(36),
        nullable=True,
        index=True,
    )

    # NOTE: nullable for now because the mobile app does not send this yet.
    # Change to nullable=False once the app (or your auth layer) supplies it.
    owner_phone = Column(
        String(20),
        nullable=True,
        index=True,
    )

    # ------------------------------------------------------------------
    # BASIC DETAILS
    # ------------------------------------------------------------------

    name = Column(String(200), nullable=False)

    property_type = Column(String(30), nullable=False)  # "PG" | "Hostel"

    gender = Column(String(30), nullable=False)  # "Boy's" | "Girl's" | "Co-living"

    description = Column(Text, nullable=True)

    # ------------------------------------------------------------------
    # PRICING (INR)
    # ------------------------------------------------------------------

    monthly_price = Column(Integer, nullable=False)

    security_deposit = Column(
        Integer,
        nullable=True,
        default=0,
        server_default="0",
    )

    # ------------------------------------------------------------------
    # BEDS & ROOM
    # ------------------------------------------------------------------

    total_beds = Column(Integer, nullable=False)

    available_beds = Column(Integer, nullable=False)

    filled_beds = Column(Integer, nullable=False)

    ac_type = Column(String(20), nullable=False)  # "AC" | "Non-AC"

    # ------------------------------------------------------------------
    # FACILITIES & FOOD
    # ------------------------------------------------------------------

    facilities = Column(JSON, nullable=False, default=list)

    food_available = Column(
        String(10),
        nullable=False,
        default="No",
        server_default="No",
    )

    food_type = Column(
    String(20),
    nullable=True,
)

    breakfast_start_time = Column(String(20), nullable=True)
    breakfast_end_time = Column(String(20), nullable=True)

    lunch_start_time = Column(String(20), nullable=True)
    lunch_end_time = Column(String(20), nullable=True)

    dinner_start_time = Column(String(20), nullable=True)
    dinner_end_time = Column(String(20), nullable=True)

    # ------------------------------------------------------------------
    # LOCATION
    # ------------------------------------------------------------------

    city = Column(String(100), nullable=False)

    area = Column(String(150), nullable=False)

    address = Column(Text, nullable=False)

    # Stored as strings, matching what the mobile app sends.
    latitude = Column(String(30), nullable=True)

    longitude = Column(String(30), nullable=True)

    # ------------------------------------------------------------------
    # RULES & STATUS
    # ------------------------------------------------------------------

    restrictions = Column(Text, nullable=True)

    status = Column(
        String(30),
        nullable=False,
        default="draft",
        server_default="draft",
        index=True,
    )

    # ------------------------------------------------------------------
    # TIMESTAMPS
    # ------------------------------------------------------------------

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # ------------------------------------------------------------------
    # RELATIONSHIPS
    # ------------------------------------------------------------------

    sharing = relationship(
        "ListingSharing",
        back_populates="listing",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    members = relationship(
    "HostelMember",
    back_populates="listing",
    cascade="all, delete-orphan",
)

    def __repr__(self) -> str:
        return (
            f"<Listing id={self.id!r} name={self.name!r} "
            f"city={self.city!r} status={self.status!r}>"
        )