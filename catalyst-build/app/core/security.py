import base64
import binascii
import hashlib
import hmac
import secrets

from pwdlib import PasswordHash
from pwdlib.hashers.bcrypt import BcryptHasher

from app.core.config import settings

PASSWORD_SCRYPT_N = 2**14
PASSWORD_SCRYPT_R = 8
PASSWORD_SCRYPT_P = 1
PASSWORD_HASH_LENGTH = 64

password_hash = PasswordHash.recommended()


def generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp(otp: str) -> str:
    salt = settings.OTP_SECRET_SALT
    if len(salt.encode("utf-8")) < 32:
        raise RuntimeError("OTP_SECRET_SALT must be at least 32 bytes.")
    return hmac.new(
        salt.encode("utf-8"),
        otp.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_otp(otp: str, otp_hash: str) -> bool:
    return hmac.compare_digest(hash_otp(otp), otp_hash)


def _verify_scrypt_hash(password: str, encoded_hash: str) -> bool:
    try:
        algorithm, n, r, p, salt_value, hash_value = encoded_hash.split("$")
        if (
            algorithm != "scrypt"
            or int(n) != PASSWORD_SCRYPT_N
            or int(r) != PASSWORD_SCRYPT_R
            or int(p) != PASSWORD_SCRYPT_P
        ):
            return False
        salt = base64.urlsafe_b64decode(salt_value.encode("ascii"))
        expected_hash = base64.urlsafe_b64decode(hash_value.encode("ascii"))
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
    except (binascii.Error, TypeError, UnicodeEncodeError, ValueError):
        return False
    return hmac.compare_digest(candidate, expected_hash)


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str | None) -> bool:
    if not isinstance(hashed_password, str) or not hashed_password:
        return False
    try:
        return password_hash.verify(password, hashed_password)
    except Exception:
        pass
    if hashed_password.startswith("$2"):
        try:
            return BcryptHasher().verify(password, hashed_password)
        except Exception:
            return False
    if hashed_password.startswith("scrypt$"):
        return _verify_scrypt_hash(password, hashed_password)
    return False


def verify_password_and_update(
    password: str,
    hashed_password: str | None,
) -> tuple[bool, str | None]:
    if not isinstance(hashed_password, str) or not hashed_password:
        return False, None
    try:
        valid, updated_hash = password_hash.verify_and_update(
            password,
            hashed_password,
        )
        if valid:
            return True, updated_hash
        return False, None
    except Exception:
        pass

    if hashed_password.startswith("$2"):
        try:
            if BcryptHasher().verify(password, hashed_password):
                return True, password_hash.hash(password)
            return False, None
        except Exception:
            return False, None

    if hashed_password.startswith("scrypt$"):
        if _verify_scrypt_hash(password, hashed_password):
            return True, password_hash.hash(password)
        return False, None

    return False, None
