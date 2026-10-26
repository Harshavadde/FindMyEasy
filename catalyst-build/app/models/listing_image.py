import uuid

from sqlalchemy import Column, DateTime, String
from sqlalchemy.sql import func

from app.db.database import Base


class ListingImage(Base):
    __tablename__ = "listing_images"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    listing_id = Column(
        String(36),
        nullable=False,
        index=True,
    )

    image_url = Column(
        String(500),
        nullable=False,
    )

    image_type = Column(
        String(30),
        nullable=False,
        index=True,
    )

    original_filename = Column(
        String(255),
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )