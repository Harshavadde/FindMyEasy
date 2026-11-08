import logging
from datetime import datetime, timedelta, timezone

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.admin_setup import admin_setup_is_complete
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
    AdminSetupStatus,
    LoginRequest,
    ProfileUpdateRequest,
    RegisterRequest,
    RequestOtpRequest,
    UserResponse,
    VerifyOtpRequest,
    normalize_phone_number,
)
from app.services.sms_service import send_otp_sms



logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/auth",
    tags=["Authentication"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

ALGORITHM = "HS256"
OTP_TTL_MINUTES = 5
OTP_RESEND_COOLDOWN_SECONDS = 60
OTP_MAX_ATTEMPTS = 3


def create_access_token(user: User) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.AUTH_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": user.id,
        "exp": expires_at,
    }

    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=ALGORITHM,
    )


def get_current_user(
    token: str = Depends(oauth2_scheme),
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
            settings.JWT_SECRET_KEY,
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


def get_current_owner(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.user_role != "OWNER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Owner access is required.",
        )
    return current_user


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _ensure_otp_enabled() -> None:
    if not settings.PHONE_OTP_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Phone verification is temporarily unavailable.",
        )


def _authenticated_response(user: User) -> AuthResponse:
    return AuthResponse(
        access_token=create_access_token(user),
        user=UserResponse.model_validate(user),
    )


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


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    data: RegisterRequest,
    db: Session = Depends(get_db),
):
    try:
        email = str(data.email).strip().lower() if data.email else None
        normalized_phone = data.phone_number
        phone_matches = []
        if data.phone_number:
            normalized_phone = normalize_phone_number(data.phone_number)
            national_phone = normalized_phone.removeprefix("+91")
            phone_matches = (
                db.query(User)
                .filter(
                    or_(
                        User.phone_number == normalized_phone,
                        User.phone_number == national_phone,
                        User.phone == national_phone,
                    )
                )
                .limit(2)
                .all()
            )

        existing_user = None
        if email:
            existing_user = (
                db.query(User)
                .filter(User.email == email)
                .first()
            )
        if phone_matches:
            existing_user = phone_matches[0]

        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with that phone number or email already exists.",
            )

        user = User(
            email=email,
            phone_number=normalized_phone,
            phone=normalized_phone.removeprefix("+91") if normalized_phone else None,
            password_hash=hash_password(data.password),
            full_name=data.full_name,
            user_role="SEEKER",
            is_phone_verified=False,
        )

        db.add(user)
        db.commit()
        db.refresh(user)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("User registration failed.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create your account. Please try again.",
        ) from exc
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create your account. Please try again.",
        )

    return AuthResponse(
        access_token=create_access_token(user),
        user=UserResponse.model_validate(user),
    )


@router.post(
    "/login",
    response_model=AuthResponse,
)
def login(
    data: LoginRequest,
    db: Session = Depends(get_db),
):
    try:
        if data.email is not None:
            email = str(data.email).strip().lower()
            user = db.query(User).filter(User.email == email).first()
        else:
            normalized_phone = normalize_phone_number(data.phone_number)
            national_phone = normalized_phone.removeprefix("+91")
            matches = (
                db.query(User)
                .filter(
                    or_(
                        User.phone_number == normalized_phone,
                        User.phone_number == national_phone,
                        User.phone == national_phone,
                    )
                )
                .limit(2)
                .all()
            )
            if not isinstance(matches, list):
                matches = [matches] if matches else []
            if len(matches) > 1:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid phone number or password.",
                )
            user = matches[0] if matches else None

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password." if data.email else "Invalid phone number or password.",
            )

        verified = verify_password(data.password, user.password_hash)
        if not verified:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password." if data.email else "Invalid phone number or password.",
            )

        if not user.is_active:
            if user.user_role == "ADMIN":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="This administrator account is disabled and cannot sign in.",
                )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password." if data.email else "Invalid phone number or password.",
            )

        return AuthResponse(
            access_token=create_access_token(user),
            user=UserResponse.model_validate(user),
        )
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Login database lookup failed.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to log you in. Please try again.",
        ) from exc
    except HTTPException:
        raise


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
            int((_as_utc(verification.resend_available_at) - now).total_seconds()),
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


@router.get(
    "/admin-setup/status",
    response_model=AdminSetupStatus,
)
def get_admin_setup_status(
    db: Session = Depends(get_db),
) -> AdminSetupStatus:
    return AdminSetupStatus(available=not admin_setup_is_complete(db))


@router.get(
    "/me",
    response_model=UserResponse,
)
def get_me(
    current_user: User = Depends(get_current_user),
):
    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse)
def update_me(
    data: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.full_name = data.full_name
    current_user.phone = data.phone

    try:
        db.commit()
        db.refresh(current_user)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to update your profile. Please try again.",
        )

    return UserResponse.model_validate(current_user)
