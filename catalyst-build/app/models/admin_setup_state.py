from sqlalchemy import Column, DateTime, String, func

from app.db.database import Base


class AdminSetupState(Base):
    __tablename__ = "admin_setup_state"

    setup_key = Column(String(32), primary_key=True)
    admin_user_id = Column(String(36), nullable=True)
    completed_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
