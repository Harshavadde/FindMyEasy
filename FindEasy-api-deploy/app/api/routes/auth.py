import logging
from datetime import datetime, timedelta, timezone

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    generate_otp,
    hash_otp,
    hash_password,
    verify_otp,
    verify_password,
)
from app.db.database import get_db
from app.models.otp_verification import OtpVerification
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    ProfileUpdateRequest,
    PhonePasswordLoginRequest,
    PhonePasswordRegisterRequest,
    RequestOtpRequest,
    UserResponse,
    VerifyOtpRequest,
)
from app.services.sms_service import send_otp_sms

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])
bearer_scheme = HTTPBearer(auto_error=False)
ALGORITHM = "HS256"
OTP_TTL_MINUTES = 5
OTP_RESEND_COOLDOWN_SECONDS = 60
OTP_MAX_ATTEMPTS = 3


def create_access_token(user: User) -> str:
    secret_key = _get_jwt_secret_key()
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.AUTH_TOKEN_EXPIRE_MINUTES
    )
    return jwt.encode(
        {"sub": user.id, "exp": expires_at},
        secret_key,
        algorithm=ALGORITHM,
    )


def _get_jwt_secret_key() -> str:
    if len(settings.JWT_SECRET_KEY.encode("utf-8")) < 32:
        raise RuntimeError("JWT_SECRET_KEY must be at least 32 bytes.")
    return settings.JWT_SECRET_KEY


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def get_bearer_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials.credentials


def get_current_user(
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired access token.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token,
            _get_jwt_secret_key(),
            algorithms=[ALGORITHM],
        )
        user_id = payload.get("sub")
        if not user_id:
            raise credentials_error
    except jwt.InvalidTokenError:
        raise credentials_error

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise credentials_error
    return user


def _authenticated_response(user: User) -> AuthResponse:
    return AuthResponse(
        access_token=create_access_token(user),
        user=UserResponse.model_validate(user),
    )


def _ensure_otp_enabled() -> None:
    if not settings.PHONE_OTP_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Phone verification is temporarily unavailable.",
        )


@router.post("/register", response_model=AuthResponse, status_code=201)
def register_with_phone_password(
    data: PhonePasswordRegisterRequest,
    db: Session = Depends(get_db),
) -> AuthResponse:
    try:
        existing_user = (
            db.query(User.id)
            .filter(User.phone_number == data.phone_number)
            .first()
        )
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error(
            "Unable to look up phone number during registration (%s).",
            type(exc).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create your account. Please try again.",
        ) from exc

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this phone number already exists. Please log in.",
        )

    user = User(
        phone_number=data.phone_number,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        user_role=data.user_role,
        is_phone_verified=False,
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError as exc:
        db.rollback()
        if db.query(User.id).filter(User.phone_number == data.phone_number).first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this phone number already exists. Please log in.",
            ) from exc
        logger.error(
            "Unable to create phone/password account (%s).",
            type(exc).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create your account. Please try again.",
        ) from exc

    return _authenticated_response(user)


@router.post("/login", response_model=AuthResponse)
def login_with_phone_password(
    data: PhonePasswordLoginRequest,
    db: Session = Depends(get_db),
) -> AuthResponse:
    try:
        user = (
            db.query(User)
            .filter(User.phone_number == data.phone_number)
            .first()
        )
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error(
            "Unable to look up phone number during login (%s).",
            type(exc).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to log you in. Please try again.",
        ) from exc

    password_is_valid = verify_password(
        data.password,
        user.password_hash if user else None,
    )
    if not user or not user.is_active or not password_is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid phone number or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return _authenticated_response(user)


def _get_or_create_verified_user(
    db: Session,
    phone_number: str,
    full_name: str | None,
    user_role: str | None,
) -> User:
    user = db.query(User).filter(User.phone_number == phone_number).first()
    if user is None:
        user = User(
            phone_number=phone_number,
            is_phone_verified=True,
            full_name=full_name,
            user_role=user_role or "SEEKER",
        )
        db.add(user)
    else:
        user.is_phone_verified = True
        if full_name is not None:
            user.full_name = full_name
        if user_role is not None:
            user.user_role = user_role

    db.commit()
    db.refresh(user)
    return user


@router.post("/request-otp")
async def request_otp(
    data: RequestOtpRequest,
    db: Session = Depends(get_db),
) -> dict[str, str | int]:
    _ensure_otp_enabled()
    now = datetime.now(timezone.utc)
    verification = (
        db.query(OtpVerification)
        .filter(OtpVerification.phone_number == data.phone_number)
        .with_for_update()
        .first()
    )
    if verification and _as_utc(verification.resend_available_at) > now:
        retry_after = max(
            1,
            int(
                (_as_utc(verification.resend_available_at) - now).total_seconds()
            ),
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Please wait {retry_after} seconds before requesting another code.",
            headers={"Retry-After": str(retry_after)},
        )

    otp = generate_otp()
    if verification is None:
        verification = OtpVerification(phone_number=data.phone_number)
        db.add(verification)
    verification.otp_hash = hash_otp(otp)
    verification.attempts = 0
    verification.expires_at = now + timedelta(minutes=OTP_TTL_MINUTES)
    verification.resend_available_at = now + timedelta(
        seconds=OTP_RESEND_COOLDOWN_SECONDS
    )
    db.commit()

    try:
        await send_otp_sms(data.phone_number, otp)
    except (httpx.HTTPError, RuntimeError, ValueError) as exc:
        logger.error(
            "SMS provider failed to send OTP (%s).",
            type(exc).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to send the verification code right now. Please try again later.",
        ) from exc

    return {
        "message": "Verification code sent.",
        "resend_after_seconds": OTP_RESEND_COOLDOWN_SECONDS,
    }


@router.post("/verify-otp", response_model=AuthResponse)
def verify_otp_code(
    data: VerifyOtpRequest,
    db: Session = Depends(get_db),
) -> AuthResponse:
    _ensure_otp_enabled()

    verification = (
        db.query(OtpVerification)
        .filter(OtpVerification.phone_number == data.phone_number)
        .with_for_update()
        .first()
    )
    if verification is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request a verification code before continuing.",
        )
    if verification.attempts >= OTP_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many incorrect codes. Request a new code to try again.",
        )
    if _as_utc(verification.expires_at) <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification code has expired. Request a new code.",
        )
    if not verify_otp(data.otp, verification.otp_hash):
        verification.attempts += 1
        db.commit()
        remaining = OTP_MAX_ATTEMPTS - verification.attempts
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Incorrect verification code. {remaining} attempt(s) remaining.",
        )

    db.delete(verification)
    user = _get_or_create_verified_user(
        db,
        data.phone_number,
        data.full_name,
        data.user_role,
    )
    return _authenticated_response(user)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse)
def update_me(
    data: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserResponse:
    current_user.full_name = data.full_name
    if "phone" in data.model_fields_set:
        current_user.phone = data.phone
    try:
        db.commit()
        db.refresh(current_user)
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Unable to update user profile.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to update your profile. Please try again.",
        )
    return UserResponse.model_validate(current_user)
