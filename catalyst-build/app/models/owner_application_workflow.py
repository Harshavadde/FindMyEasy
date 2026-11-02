import uuid

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    func,
)

from app.db.database import Base


class OwnerApplicationHistory(Base):
    __tablename__ = "owner_application_history"
    __table_args__ = (
        Index(
            "ix_owner_application_history_application_created",
            "application_id",
            "created_at",
        ),
    )

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    application_id = Column(
        String(36),
        ForeignKey("owner_applications.id", ondelete="RESTRICT"),
        nullable=False,
    )
    previous_status = Column(String(40), nullable=True)
    new_status = Column(String(40), nullable=False)
    action = Column(String(40), nullable=False)
    message = Column(Text, nullable=True)
    internal_note = Column(Text, nullable=True)
    performed_by_admin_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class OwnerInvitation(Base):
    __tablename__ = "owner_invitations"
    __table_args__ = (
        CheckConstraint(
            "delivery_status IN ('NOT_CONFIGURED', 'PENDING', 'DELIVERED', 'FAILED')",
            name="ck_owner_invitations_delivery_status",
        ),
        Index(
            "ix_owner_invitations_application_created",
            "application_id",
            "created_at",
        ),
        Index("ix_owner_invitations_expires_at", "expires_at"),
    )

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    application_id = Column(
        String(36),
        ForeignKey("owner_applications.id", ondelete="RESTRICT"),
        nullable=False,
    )
    invited_phone = Column(String(15), nullable=False)
    token_hash = Column(String(64), nullable=False, unique=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    created_by_admin_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    delivery_channel = Column(String(20), nullable=True)
    delivery_status = Column(
        String(24),
        nullable=False,
        default="NOT_CONFIGURED",
        server_default="NOT_CONFIGURED",
    )
