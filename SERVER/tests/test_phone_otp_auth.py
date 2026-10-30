import asyncio
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.auth import router as auth_router
from app.core.config import settings
from app.core.security import verify_otp
from app.db.database import Base, get_db
from app.models.favorite import Favorite
from app.models.hostel_member import HostelMember
from app.models.listing import Listing
from app.models.listing_image import ListingImage
from app.models.listing_sharing import ListingSharing
from app.models.otp_verification import OtpVerification
from app.models.user import User
from app.services.sms_service import send_otp_sms


class PhoneOtpAuthTests(unittest.TestCase):
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
        settings.OTP_SECRET_SALT = "test-otp-secret-salt-at-least-32-bytes"
        settings.ENVIRONMENT = "test"
        settings.PHONE_OTP_ENABLED = True
        self.app = FastAPI()
        self.app.include_router(auth_router)

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

    def _request_otp(self, phone_number: str) -> None:
        with (
            patch("app.api.routes.auth.generate_otp", return_value="135790"),
            patch(
                "app.api.routes.auth.send_otp_sms",
                new_callable=AsyncMock,
            ) as send_sms,
        ):
            response = self.client.post(
                "/api/v1/auth/request-otp",
                json={"phone_number": phone_number},
            )
        self.assertEqual(response.status_code, 200, response.text)
        send_sms.assert_awaited_once_with(phone_number, "135790")

    def test_request_otp_hashes_code_and_enforces_resend_cooldown(self) -> None:
        phone_number = "+919876543210"
        self._request_otp(phone_number)

        with self.session_factory() as session:
            verification = session.query(OtpVerification).one()
            self.assertTrue(verify_otp("135790", verification.otp_hash))
            self.assertNotEqual(verification.otp_hash, "135790")
            self.assertEqual(verification.attempts, 0)

        cooldown = self.client.post(
            "/api/v1/auth/request-otp",
            json={"phone_number": phone_number},
        )
        self.assertEqual(cooldown.status_code, 429)

    def test_otp_routes_register_expected_paths_and_reject_mismatch(self) -> None:
        from app.main import app as main_app

        registered = main_app.openapi()["paths"]
        self.assertIn("post", registered["/api/v1/auth/request-otp"])
        self.assertIn("post", registered["/api/v1/auth/verify-otp"])

        wrong_path = self.client.post(
            "/api/v1/auth/send-otp",
            json={"phone_number": "+919876543210"},
        )
        self.assertEqual(wrong_path.status_code, 404)

        invalid_schema = self.client.post(
            "/api/v1/auth/request-otp",
            json={"phone": "9876543210"},
        )
        self.assertEqual(invalid_schema.status_code, 422)

    def test_otp_verification_enforces_expiry_and_attempt_limit(self) -> None:
        phone_number = "+919876543210"
        self._request_otp(phone_number)

        for _ in range(3):
            invalid = self.client.post(
                "/api/v1/auth/verify-otp",
                json={"phone_number": phone_number, "otp": "999999"},
            )
            self.assertEqual(invalid.status_code, 400)

        locked = self.client.post(
            "/api/v1/auth/verify-otp",
            json={"phone_number": phone_number, "otp": "135790"},
        )
        self.assertEqual(locked.status_code, 429)

        with self.session_factory() as session:
            verification = session.query(OtpVerification).one()
            verification.attempts = 0
            verification.expires_at = datetime.now(timezone.utc) - timedelta(
                seconds=1
            )
            session.commit()

        expired = self.client.post(
            "/api/v1/auth/verify-otp",
            json={"phone_number": phone_number, "otp": "135790"},
        )
        self.assertEqual(expired.status_code, 400)
        self.assertIn("expired", expired.json()["detail"].lower())

    def test_provider_failure_returns_502_without_real_sms(self) -> None:
        with (
            patch("app.api.routes.auth.generate_otp", return_value="135790"),
            patch(
                "app.api.routes.auth.send_otp_sms",
                new_callable=AsyncMock,
                side_effect=RuntimeError("provider rejected request"),
            ) as send_sms,
        ):
            response = self.client.post(
                "/api/v1/auth/request-otp",
                json={"phone_number": "+919876543210"},
            )

        self.assertEqual(response.status_code, 502)
        self.assertIn("Unable to send", response.json()["detail"])
        send_sms.assert_awaited_once()

    def test_production_otp_is_disabled_by_default(self) -> None:
        settings.ENVIRONMENT = "production"
        settings.PHONE_OTP_ENABLED = False
        with patch(
            "app.api.routes.auth.send_otp_sms",
            new_callable=AsyncMock,
        ) as send_sms:
            response = self.client.post(
                "/api/v1/auth/request-otp",
                json={"phone_number": "+919876543210"},
            )
        self.assertEqual(response.status_code, 404)
        send_sms.assert_not_awaited()

    def test_invalid_provider_response_is_rejected(self) -> None:
        response = MagicMock()
        response.raise_for_status.return_value = None
        response.json.return_value = {"Status": "Error"}
        client = MagicMock()
        client.__aenter__ = AsyncMock(return_value=client)
        client.__aexit__ = AsyncMock(return_value=None)
        client.get = AsyncMock(return_value=response)

        with (
            patch("app.services.sms_service.os.getenv", return_value="test-api-key"),
            patch("app.services.sms_service.httpx.AsyncClient", return_value=client),
        ):
            with self.assertRaises(RuntimeError):
                asyncio.run(send_otp_sms("+919876543210", "135790"))


if __name__ == "__main__":
    unittest.main()
