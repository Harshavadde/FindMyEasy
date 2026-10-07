import uuid

from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship

from app.db.database import Base


class ListingSharing(Base):
    __tablename__ = "listing_sharing"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    listing_id = Column(
        String(36),
        ForeignKey(
            "listings.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    sharing_type = Column(
        String(30),
        nullable=False,
    )

    listing = relationship(
        "Listing",
        back_populates="sharing",
    )