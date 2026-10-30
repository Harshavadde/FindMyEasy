import uuid

from sqlalchemy import Column, DateTime, Index, Integer, String, Uuid, func

from app.db.database import Base


class OtpVerification(Base):
    __tablename__ = "otp_verifications"
    __table_args__ = (
        Index(
            "ix_otp_verifications_phone_number",
            "phone_number",
            unique=True,
        ),
    )

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone_number = Column(String(15), nullable=False)
    otp_hash = Column(String(64), nullable=False)
    attempts = Column(Integer, nullable=False, default=0, server_default="0")
    expires_at = Column(DateTime(timezone=True), nullable=False)
    resend_available_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
