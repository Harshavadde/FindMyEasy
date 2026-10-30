
import uuid

from sqlalchemy import Boolean, Column, DateTime, String, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    email = Column(
        String(255),
        nullable=True,
        unique=True,
        index=True,
    )

    password_hash = Column(
        String(255),
        nullable=False,
    )

    full_name = Column(
        String(150),
        nullable=True,
    )

    phone = Column(
        String(10),
        nullable=True,
    )

    phone_number = Column(
        String(15),
        nullable=True,
        unique=True,
        index=True,
    )

    is_phone_verified = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    user_role = Column(
        String(10),
        nullable=False,
        default="SEEKER",
        server_default="SEEKER",
    )

    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="1",
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    listings = relationship(
        "Listing",
        back_populates="owner",
    )

    def __repr__(self) -> str:
        return f"<User id={self.id!r} phone_number={self.phone_number!r}>"
