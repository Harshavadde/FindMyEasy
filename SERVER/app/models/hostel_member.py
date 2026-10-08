import uuid
from datetime import date, datetime

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


class HostelMember(Base):
    __tablename__ = "hostel_members"

    id = Column(
        String,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        nullable=False,
    )

    listing_id = Column(
        String,
        ForeignKey(
            "listings.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    sharing_id = Column(
        String,
        ForeignKey(
            "listing_sharing.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    name = Column(
        String(200),
        nullable=False,
    )

    phone = Column(
        String(20),
        nullable=False,
        index=True,
    )

    aadhaar_photo_path = Column(
        String(500),
        nullable=True,
    )

    room_number = Column(
        String(50),
        nullable=False,
    )

    amount_to_pay = Column(
        Integer,
        nullable=False,
        default=0,
    )

    amount_paid = Column(
        Integer,
        nullable=False,
        default=0,
    )

    amount_pending = Column(
        Integer,
        nullable=False,
        default=0,
    )

    food_preference = Column(
        String(20),
        nullable=False,
        default="veg",
    )

    joining_date = Column(
        Date,
        nullable=False,
        default=date.today,
    )

    leaving_date = Column(
        Date,
        nullable=True,
    )

    status = Column(
        String(20),
        nullable=False,
        default="active",
        index=True,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    listing = relationship(
        "Listing",
        back_populates="members",
    )

    sharing = relationship(
        "ListingSharing",
        back_populates="members",
    )