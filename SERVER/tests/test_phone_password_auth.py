import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, Mock, patch

import jwt
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.auth import router as auth_router
from app.api.routes.favorites import router as favorites_router
from app.core.config import Settings, settings
from app.db.database import Base, get_db
from app.models.favorite import Favorite
from app.models.hostel_member import HostelMember
from app.models.listing import Listing
from app.models.listing_image import ListingImage
from app.models.listing_sharing import ListingSharing
from app.models.otp_verification import OtpVerification
from app.models.user import User
from app.schemas.auth import normalize_phone_number


class PhonePasswordAuthTests(unittest.TestCase):
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
        settings.JWT_SECRET_KEY = "test-jwt-secret-key-at-least-32-bytes"
        settings.PHONE_OTP_ENABLED = False
        self.app = FastAPI()
        self.app.include_router(auth_router)
        self.app.include_router(favorites_router)

        def override_db():
            with self.session_factory() as session:
                yield session

        self.app.dependency_overrides[get_db] = override_db
        self.client = TestClient(self.app)

    def tearDown(self) -> None:
        with self.session_factory() as session:
            session.query(OtpVerification).delete()
            session.query(User).delete()
            session.commit()

    def _register(
        self,
        phone_number: str,
        *,
        password: str = "a-strong-password",
        full_name: str = "Test User",
        user_role: str = "SEEKER",
    ):
        return self.client.post(
            "/api/v1/auth/register",
            json={
                "phone_number": phone_number,
                "password": password,
                "full_name": full_name,
                "user_role": user_role,
            },
        )

    def test_registration_normalizes_phone_and_does_not_verify_it(self) -> None:
        with patch(
            "app.api.routes.auth.send_otp_sms",
            new_callable=AsyncMock,
        ) as send_sms:
            response = self._register("  9876543210  ")

        self.assertEqual(response.status_code, 201, response.text)
        result = response.json()
        self.assertEqual(result["user"]["phone_number"], "+919876543210")
        self.assertEqual(result["user"]["user_role"], "SEEKER")
        self.assertTrue(result["access_token"])
        send_sms.assert_not_awaited()

        with self.session_factory() as session:
            user = session.query(User).one()
            self.assertFalse(user.is_phone_verified)
            self.assertNotEqual(user.password_hash, "a-strong-password")
            self.assertIsNone(user.email)

    def test_registration_accepts_eight_character_password_and_rejects_seven(self) -> None:
        accepted = self._register("+919876543210", password="12345678")
        rejected = self._register("+919876543211", password="1234567")

        self.assertEqual(accepted.status_code, 201, accepted.text)
        self.assertEqual(rejected.status_code, 422)

    def test_duplicate_normalized_phone_number_is_rejected(self) -> None:
        first = self._register("+919876543210")
        duplicate = self._register("9876543210")

        self.assertEqual(first.status_code, 201, first.text)
        self.assertEqual(duplicate.status_code, 409)
        self.assertIn("already exists", duplicate.json()["detail"])
        with self.session_factory() as session:
            self.assertEqual(session.query(User).count(), 1)
            phone_number_index = next(
                index
                for index in User.__table__.indexes
                if list(index.columns)[0].name == "phone_number"
            )
            self.assertTrue(phone_number_index.unique)

    def test_distinct_phone_numbers_create_distinct_users(self) -> None:
        first = self._register("+919876543210")
        second = self._register("+919876543211")

        self.assertEqual(first.status_code, 201, first.text)
        self.assertEqual(second.status_code, 201, second.text)
        self.assertNotEqual(first.json()["user"]["id"], second.json()["user"]["id"])

    def test_login_requires_password_and_rejects_phone_only_account(self) -> None:
        self._register("+919876543210")

        with patch(
            "app.api.routes.auth.send_otp_sms",
            new_callable=AsyncMock,
        ) as send_sms:
            valid = self.client.post(
                "/api/v1/auth/login",
                json={
                    "phone_number": "9876543210",
                    "password": "a-strong-password",
                },
            )
            invalid = self.client.post(
                "/api/v1/auth/login",
                json={
                    "phone_number": "+919876543210",
                    "password": "wrong-password",
                },
            )

        phone_only_user = User(
            phone_number="+919876543211",
            is_phone_verified=True,
            is_active=True,
            full_name="Legacy phone-only account",
        )
        phone_only_session = Mock()
        (
            phone_only_session.query.return_value
            .filter.return_value
            .first.return_value
        ) = phone_only_user
        self.app.dependency_overrides[get_db] = lambda: phone_only_session
        with patch(
            "app.api.routes.auth.send_otp_sms",
            new_callable=AsyncMock,
        ) as send_sms:
            legacy = self.client.post(
                "/api/v1/auth/login",
                json={
                    "phone_number": "+919876543211",
                    "password": "a-strong-password",
                },
            )

        send_sms.assert_not_awaited()
        self.assertEqual(valid.status_code, 200, valid.text)
        self.assertEqual(invalid.status_code, 401)
        self.assertEqual(legacy.status_code, 401)
        self.assertEqual(
            invalid.json()["detail"],
            "Invalid phone number or password.",
        )

    def test_initial_phone_lookups_handle_schema_failures(self) -> None:
        failing_session = Mock()
        failing_session.query.side_effect = SQLAlchemyError(
            "no such column: users.phone_number"
        )
        self.app.dependency_overrides[get_db] = lambda: failing_session

        login = self.client.post(
            "/api/v1/auth/login",
            json={
                "phone_number": "+919876543210",
                "password": "a-strong-password",
            },
        )
        register = self.client.post(
            "/api/v1/auth/register",
            json={
                "phone_number": "+919876543210",
                "password": "a-strong-password",
                "full_name": "Test User",
                "user_role": "SEEKER",
            },
        )

        self.assertEqual(login.status_code, 500)
        self.assertEqual(
            login.json()["detail"],
            "Unable to log you in. Please try again.",
        )
        self.assertEqual(register.status_code, 500)
        self.assertEqual(
            register.json()["detail"],
            "Unable to create your account. Please try again.",
        )
        self.assertEqual(failing_session.rollback.call_count, 2)

    def test_login_access_token_subject_matches_authenticated_user_id(self) -> None:
        registered = self._register("+919876543210")
        self.assertEqual(registered.status_code, 201, registered.text)
        with self.session_factory() as session:
            user_id = session.query(User.id).one()[0]

        token_created_at = datetime.now(timezone.utc)
        login = self.client.post(
            "/api/v1/auth/login",
            json={
                "phone_number": "+919876543210",
                "password": "a-strong-password",
            },
        )

        self.assertEqual(login.status_code, 200, login.text)
        claims = jwt.decode(
            login.json()["access_token"],
            settings.JWT_SECRET_KEY,
            algorithms=["HS256"],
        )
        self.assertEqual(claims["sub"], user_id)
        expected_expiration = token_created_at + timedelta(
            minutes=settings.AUTH_TOKEN_EXPIRE_MINUTES
        )
        actual_expiration = datetime.fromtimestamp(
            claims["exp"],
            timezone.utc,
        )
        self.assertLessEqual(
            abs((actual_expiration - expected_expiration).total_seconds()),
            2,
        )

    def test_unauthenticated_me_rejected_and_authenticated_unverified_user_allowed(
        self,
    ) -> None:
        self.assertEqual(
            self.client.get("/api/v1/auth/me").status_code,
            401,
        )
        response = self._register("+919876543210")
        token = response.json()["access_token"]
        current_user = self.client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(current_user.status_code, 200, current_user.text)
        self.assertEqual(current_user.json()["phone_number"], "+919876543210")

    def test_authenticated_users_cannot_read_each_others_favorites(self) -> None:
        user_a = self._register("+919876543210")
        user_b = self._register("+919876543211")
        token_a = user_a.json()["access_token"]
        token_b = user_b.json()["access_token"]
        with self.session_factory() as session:
            listing = Listing(
                name="Private test listing",
                property_type="PG",
                gender="Co-living",
                monthly_price=9000,
                total_beds=1,
                available_beds=1,
                filled_beds=0,
                ac_type="Non-AC",
                facilities=[],
                city="Bengaluru",
                area="Indiranagar",
                address="1 Test Road",
            )
            session.add(listing)
            session.commit()
            listing_id = listing.id

        add_favorite = self.client.post(
            f"/api/v1/favorites/{listing_id}",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        self.assertEqual(add_favorite.status_code, 201, add_favorite.text)
        favorites_a = self.client.get(
            "/api/v1/favorites",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        favorites_b = self.client.get(
            "/api/v1/favorites",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        self.assertEqual(favorites_a.status_code, 200)
        self.assertEqual(favorites_b.status_code, 200)
        self.assertEqual(
            [item["listing_id"] for item in favorites_a.json()],
            [listing_id],
        )
        self.assertEqual(favorites_b.json(), [])

    def test_unauthenticated_favorites_request_is_rejected(self) -> None:
        self.assertEqual(self.client.get("/api/v1/favorites").status_code, 401)

    def test_otp_routes_return_not_found_and_never_call_provider(self) -> None:
        with patch(
            "app.api.routes.auth.send_otp_sms",
            new_callable=AsyncMock,
        ) as send_sms:
            request = self.client.post(
                "/api/v1/auth/request-otp",
                json={"phone_number": "+919876543210"},
            )
            verify = self.client.post(
                "/api/v1/auth/verify-otp",
                json={"phone_number": "+919876543210", "otp": "123456"},
            )

        self.assertEqual(request.status_code, 404)
        self.assertEqual(verify.status_code, 404)
        send_sms.assert_not_awaited()

    def test_production_settings_cannot_enable_fixed_otp_authentication(self) -> None:
        production = Settings(
            DATABASE_URL="postgresql+psycopg://test:test@127.0.0.1/test",
            ENVIRONMENT="production",
            OTP_TEST_MODE=True,
        )
        self.assertFalse(production.PHONE_OTP_ENABLED)
        self.assertFalse(hasattr(production, "OTP_TEST_MODE"))

    def test_phone_normalization_rejects_invalid_indian_numbers(self) -> None:
        with self.assertRaises(ValueError):
            normalize_phone_number("+12025550123")

    def test_password_auth_routes_are_registered(self) -> None:
        from app.main import app as main_app

        registered = main_app.openapi()["paths"]
        self.assertIn("post", registered["/api/v1/auth/register"])
        self.assertIn("post", registered["/api/v1/auth/login"])


if __name__ == "__main__":
    unittest.main()
