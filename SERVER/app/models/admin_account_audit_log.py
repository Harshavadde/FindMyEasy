import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, func

from app.db.database import Base


class AdminAccountAuditLog(Base):
    __tablename__ = "admin_account_audit_log"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    actor_admin_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    target_admin_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    action = Column(String(32), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
