
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.admin_setup import admin_setup_is_complete
from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    AdminSetupStatus,
    LoginRequest,
    ProfileUpdateRequest,
    RegisterRequest,
    UserResponse,
)



router = APIRouter(
    prefix="/api/v1/auth",
    tags=["Authentication"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

ALGORITHM = "HS256"


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


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    data: RegisterRequest,
    db: Session = Depends(get_db),
):
    email = str(data.email).strip().lower() if data.email else None
    identifiers = []
    if email:
        identifiers.append(User.email == email)
    if data.phone_number:
        identifiers.append(User.phone_number == data.phone_number)

    existing_user = db.query(User).filter(*identifiers).first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        email=email,
        phone_number=data.phone_number,
        phone=data.phone_number.removeprefix("+91") if data.phone_number else None,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        user_role="SEEKER",
        is_phone_verified=False,
    )

    db.add(user)

    try:
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unable to create account. Please try again.",
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
    if data.email is not None:
        email = str(data.email).strip().lower()
        user = db.query(User).filter(User.email == email).first()
    else:
        user = (
            db.query(User)
            .filter(User.phone_number == data.phone_number)
            .first()
        )

    if not user or not verify_password(
        data.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is disabled.",
        )

    return AuthResponse(
        access_token=create_access_token(user),
        user=UserResponse.model_validate(user),
    )


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
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to update your profile. Please try again.",
        )

    return UserResponse.model_validate(current_user)
