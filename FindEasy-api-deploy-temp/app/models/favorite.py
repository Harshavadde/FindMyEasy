
import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class Favorite(Base):
    __tablename__ = "favorites"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "listing_id",
            name="uq_favorites_user_listing",
        ),
    )

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    listing_id = Column(
        String(36),
        ForeignKey("listings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    user = relationship("User")
    listing = relationship("Listing")

    def __repr__(self) -> str:
        return (
            f"<Favorite user_id={self.user_id!r} "
            f"listing_id={self.listing_id!r}>"
        )
