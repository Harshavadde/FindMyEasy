import uuid

from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.database import Base


class ListingSharing(Base):
    __tablename__ = "listing_sharing"

    id = Column(
        String,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        nullable=False,
    )

    listing_id = Column(
        String,
        ForeignKey("listings.id", ondelete="CASCADE"),
        nullable=False,
    )

    sharing_type = Column(
        String(50),
        nullable=False,
    )

    monthly_price = Column(
        Integer,
        nullable=False,
        default=0,
    )

    total_beds = Column(
        Integer,
        nullable=False,
        default=0,
    )

    available_beds = Column(
        Integer,
        nullable=False,
        default=0,
    )

    filled_beds = Column(
        Integer,
        nullable=False,
        default=0,
    )

    listing = relationship(
        "Listing",
        back_populates="sharing",
    )

    members = relationship(
        "HostelMember",
        back_populates="sharing",
    )