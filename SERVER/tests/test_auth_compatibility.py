import base64
import hashlib
import unittest
from unittest.mock import Mock, patch

import jwt
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pwdlib.hashers.bcrypt import BcryptHasher
from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import configure_mappers, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.auth import router as auth_router
from app.core.config import settings
from app.core.security import (
    hash_password,
    verify_password,
    verify_password_and_update,
)
from app.db.database import Base, get_db
from app.models.user import User


def _legacy_scrypt_hash(password: str) -> str:
    salt = b"0123456789abcdef"
    password_hash = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=2**14,
        r=8,
        p=1,
        dklen=64,
        maxmem=64 * 1024 * 1024,
    )
    return "$".join(
        (
            "scrypt",
            str(2**14),
            "8",
            "1",
            base64.urlsafe_b64encode(salt).decode("ascii"),
            base64.urlsafe_b64encode(password_hash).decode("ascii"),
        )
    )


class AuthCompatibilityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        cls.session_factory = sessionmaker(
            bind=cls.engine,
            autoflush=False,
            autocommit=False,
        )
        Base.metadata.create_all(cls.engine)

    @classmethod
    def tearDownClass(cls) -> None:
        Base.metadata.drop_all(cls.engine)
        cls.engine.dispose()

    def setUp(self) -> None:
        self.previous_secret = settings.JWT_SECRET_KEY
        settings.JWT_SECRET_KEY = "test-jwt-secret-key-at-least-32-bytes"
        self.app = FastAPI()
        self.app.include_router(auth_router)

        def override_db():
            with self.session_factory() as session:
                yield session

        self.app.dependency_overrides[get_db] = override_db
        self.client = TestClient(self.app)

    def tearDown(self) -> None:
        with self.session_factory() as session:
            session.query(User).delete()
            session.commit()
        settings.JWT_SECRET_KEY = self.previous_secret

    def _create_user(
        self,
        *,
        phone_number: str | None = "+919876543210",
        legacy_phone: str | None = None,
        password_hash: str | None = None,
        is_active: bool = True,
    ) -> User:
        user = User(
            phone_number=phone_number,
            phone=legacy_phone,
            password_hash=password_hash or hash_password("a-strong-password"),
            full_name="Test User",
            user_role="SEEKER",
            is_active=is_active,
        )
        with self.session_factory() as session:
            session.add(user)
            session.commit()
            session.refresh(user)
            return user

    def _login(self, phone_number: str, password: str = "a-strong-password"):
        return self.client.post(
            "/api/v1/auth/login",
            json={"phone_number": phone_number, "password": password},
        )

    def test_registration_and_login_use_argon2_and_issue_jwt(self) -> None:
        registration = self.client.post(
            "/api/v1/auth/register",
            json={
                "phone_number": "+919876543210",
                "password": "a-strong-password",
                "full_name": "Test User",
                "user_role": "SEEKER",
            },
        )
        self.assertEqual(registration.status_code, 201, registration.text)

        login = self._login("+919876543210")
        self.assertEqual(login.status_code, 200, login.text)
        token = login.json()["access_token"]
        claims = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=["HS256"],
        )
        self.assertEqual(claims["sub"], registration.json()["user"]["id"])

        with self.session_factory() as session:
            user = session.query(User).one()
            stored_hash = user.password_hash
        assert isinstance(stored_hash, str)
        self.assertTrue(stored_hash.startswith("$argon2id$"))
        self.assertTrue(verify_password("a-strong-password", stored_hash))

    def test_bcrypt_legacy_login_rehashes_to_argon2(self) -> None:
        legacy_hash = BcryptHasher().hash("a-strong-password")
        user = self._create_user(password_hash=legacy_hash)

        login = self._login(user.phone_number)
        self.assertEqual(login.status_code, 200, login.text)

        with self.session_factory() as session:
            stored_hash = session.query(User).one().password_hash
        assert isinstance(stored_hash, str)
        self.assertTrue(stored_hash.startswith("$argon2id$"))
        self.assertTrue(verify_password("a-strong-password", stored_hash))

    def test_historical_scrypt_login_rehashes_to_argon2(self) -> None:
        legacy_hash = _legacy_scrypt_hash("a-strong-password")
        user = self._create_user(password_hash=legacy_hash)

        login = self._login(user.phone_number)
        self.assertEqual(login.status_code, 200, login.text)

        with self.session_factory() as session:
            stored_hash = session.query(User).one().password_hash
        assert isinstance(stored_hash, str)
        self.assertTrue(stored_hash.startswith("$argon2id$"))
        self.assertTrue(verify_password("a-strong-password", stored_hash))

    def test_historical_scrypt_hash_rejects_wrong_password_and_bad_parameters(
        self,
    ) -> None:
        legacy_hash = _legacy_scrypt_hash("a-strong-password")
        invalid_parameters = legacy_hash.replace("$16384$8$1$", "$32768$8$1$")

        self.assertFalse(verify_password("incorrect-password", legacy_hash))
        self.assertFalse(
            verify_password("a-strong-password", invalid_parameters)
        )

    def test_legacy_verifier_reports_upgrade_hash(self) -> None:
        legacy_hash = BcryptHasher().hash("a-strong-password")

        verified, updated_hash = verify_password_and_update(
            "a-strong-password",
            legacy_hash,
        )

        self.assertTrue(verified)
        self.assertIsNotNone(updated_hash)
        self.assertTrue(updated_hash.startswith("$argon2id$"))

    def test_wrong_password_and_missing_user_return_same_auth_error(self) -> None:
        self._create_user()
        wrong_password = self._login("+919876543210", "incorrect-password")
        missing_user = self._login("+919876543211")

        self.assertEqual(wrong_password.status_code, 401)
        self.assertEqual(missing_user.status_code, 401)
        self.assertEqual(wrong_password.json(), missing_user.json())

    def test_unsupported_and_malformed_hashes_return_auth_failure(self) -> None:
        for index, stored_hash in enumerate(
            (
                "unsupported-hash-format",
                "$argon2id$v=19$m=65536,t=3,p=4$broken$malformed",
            )
        ):
            phone_number = f"+91987654321{index}"
            self._create_user(
                phone_number=phone_number,
                password_hash=stored_hash,
            )

            response = self._login(phone_number)

            self.assertEqual(response.status_code, 401)
            self.assertEqual(
                response.json()["detail"],
                "Invalid phone number or password.",
            )
            with self.session_factory() as session:
                session.delete(
                    session.query(User)
                    .filter(User.phone_number == phone_number)
                    .one()
                )
                session.commit()

    def test_disabled_user_is_not_distinguishable_from_invalid_credentials(self) -> None:
        self._create_user(is_active=False)

        disabled = self._login("+919876543210")
        missing = self._login("+919876543211")

        self.assertEqual(disabled.status_code, 401)
        self.assertEqual(disabled.json(), missing.json())

    def test_password_verification_rejects_empty_and_plaintext_values(self) -> None:
        self.assertFalse(verify_password("a-strong-password", ""))
        self.assertFalse(
            verify_password("a-strong-password", "a-strong-password")
        )

    def test_phone_number_spaces_and_country_code_are_normalized(self) -> None:
        self._create_user()

        for phone_number in ("+919876543210", "9876543210", " 9876543210 "):
            with self.subTest(phone_number=phone_number):
                response = self._login(phone_number)
                self.assertEqual(response.status_code, 200, response.text)

        malformed = self._login("+91 9876543210")
        self.assertEqual(malformed.status_code, 422)

    def test_phone_lookup_accepts_legacy_national_number_format(self) -> None:
        self._create_user(phone_number="9876543210")

        response = self._login("+919876543210")

        self.assertEqual(response.status_code, 200, response.text)

    def test_phone_lookup_uses_legacy_phone_column_without_mutating_it(self) -> None:
        self._create_user(phone_number=None, legacy_phone="9876543210")

        response = self._login("+919876543210")

        self.assertEqual(response.status_code, 200, response.text)
        with self.session_factory() as session:
            stored_user = session.query(User).one()
            self.assertIsNone(stored_user.phone_number)
            self.assertEqual(stored_user.phone, "9876543210")

    def test_ambiguous_legacy_phone_matches_fail_closed_and_block_registration(
        self,
    ) -> None:
        self._create_user(phone_number="+919876543210")
        self._create_user(phone_number=None, legacy_phone="9876543210")

        login = self._login("+919876543210")
        registration = self.client.post(
            "/api/v1/auth/register",
            json={
                "phone_number": "+919876543210",
                "password": "a-strong-password",
                "full_name": "Another User",
                "user_role": "SEEKER",
            },
        )

        self.assertEqual(login.status_code, 401)
        self.assertEqual(registration.status_code, 409)

    def test_database_lookup_failure_returns_generic_server_error(self) -> None:
        failing_session = Mock()
        failing_session.query.side_effect = SQLAlchemyError(
            "sensitive database exception"
        )
        self.app.dependency_overrides[get_db] = lambda: failing_session

        response = self._login("+919876543210")

        self.assertEqual(response.status_code, 500)
        self.assertEqual(
            response.json()["detail"],
            "Unable to log you in. Please try again.",
        )
        self.assertNotIn("sensitive database exception", response.text)

    def test_all_model_relationships_configure_when_user_is_imported(self) -> None:
        configure_mappers()
        expected_models = {
            "Favorite",
            "HostelMember",
            "Listing",
            "ListingImage",
            "ListingSharing",
            "OtpVerification",
            "User",
        }
        registered_models = {
            mapper.class_.__name__ for mapper in Base.registry.mappers
        }
        self.assertTrue(expected_models.issubset(registered_models))

    def test_health_and_swagger_routes_are_available(self) -> None:
        from app.main import app as main_app

        with patch("app.main.engine.connect") as connect:
            connect.return_value.__enter__.return_value = Mock()
            with TestClient(main_app) as main_client:
                health = main_client.get("/health")
                openapi = main_client.get("/openapi.json")
                swagger = main_client.get("/docs")

        self.assertEqual(health.status_code, 200, health.text)
        self.assertEqual(health.json(), {"status": "ok", "database": "ok"})
        self.assertEqual(openapi.status_code, 200)
        self.assertEqual(swagger.status_code, 200)


if __name__ == "__main__":
    unittest.main()
