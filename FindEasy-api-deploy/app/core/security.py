
import base64
import binascii
import hashlib
import hmac
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import (
    InvalidHashError,
    VerificationError,
    VerifyMismatchError,
)

from app.core.config import settings

PASSWORD_SCRYPT_N = 2**14
PASSWORD_SCRYPT_R = 8
PASSWORD_SCRYPT_P = 1
PASSWORD_HASH_LENGTH = 64

_DUMMY_PASSWORD_SALT = b"FindEasy password verification dummy salt"
_ARGON2_HASher = PasswordHasher()


def generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp(otp: str) -> str:
    if len(settings.OTP_SECRET_SALT.encode("utf-8")) < 32:
        raise RuntimeError("OTP_SECRET_SALT must be at least 32 bytes.")

    return hmac.new(
        settings.OTP_SECRET_SALT.encode("utf-8"),
        otp.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_otp(otp: str, otp_hash: str) -> bool:
    return hmac.compare_digest(hash_otp(otp), otp_hash)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)

    password_hash = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=PASSWORD_SCRYPT_N,
        r=PASSWORD_SCRYPT_R,
        p=PASSWORD_SCRYPT_P,
        dklen=PASSWORD_HASH_LENGTH,
        maxmem=64 * 1024 * 1024,
    )

    return "$".join(
        (
            "scrypt",
            str(PASSWORD_SCRYPT_N),
            str(PASSWORD_SCRYPT_R),
            str(PASSWORD_SCRYPT_P),
            base64.urlsafe_b64encode(salt).decode("ascii"),
            base64.urlsafe_b64encode(password_hash).decode("ascii"),
        )
    )


def verify_password(password: str, encoded_hash: str | None) -> bool:
    if encoded_hash is None:
        # Perform a dummy scrypt operation when no hash exists.
        candidate = hashlib.scrypt(
            password.encode("utf-8"),
            salt=_DUMMY_PASSWORD_SALT,
            n=PASSWORD_SCRYPT_N,
            r=PASSWORD_SCRYPT_R,
            p=PASSWORD_SCRYPT_P,
            dklen=PASSWORD_HASH_LENGTH,
            maxmem=64 * 1024 * 1024,
        )
        return hmac.compare_digest(
            candidate, bytes(PASSWORD_HASH_LENGTH)
        )

    # Support existing Argon2 password hashes.
    if encoded_hash.startswith("$argon2"):
        try:
            return _ARGON2_HASher.verify(encoded_hash, password)
        except (
            VerifyMismatchError,
            VerificationError,
            InvalidHashError,
            TypeError,
        ):
            return False

    # Support scrypt hashes used by current registrations.
    try:
        algorithm, n, r, p, salt_value, hash_value = (
            encoded_hash.split("$")
        )

        if (
            algorithm != "scrypt"
            or int(n) != PASSWORD_SCRYPT_N
            or int(r) != PASSWORD_SCRYPT_R
            or int(p) != PASSWORD_SCRYPT_P
        ):
            return False

        salt = base64.urlsafe_b64decode(salt_value.encode("ascii"))
        expected_hash = base64.urlsafe_b64decode(
            hash_value.encode("ascii")
        )

        if len(salt) != 16 or len(expected_hash) != PASSWORD_HASH_LENGTH:
            return False

        candidate = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=PASSWORD_SCRYPT_N,
            r=PASSWORD_SCRYPT_R,
            p=PASSWORD_SCRYPT_P,
            dklen=PASSWORD_HASH_LENGTH,
            maxmem=64 * 1024 * 1024,
        )

    except (
        binascii.Error,
        ValueError,
        TypeError,
        UnicodeEncodeError,
    ):
        return False

    return hmac.compare_digest(candidate, expected_hash)
