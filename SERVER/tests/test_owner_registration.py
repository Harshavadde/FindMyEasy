import hashlib
import os
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models
from app.api.routes.auth import router as auth_router
from app.api.routes.listings import router as owner_listings_router
from app.api.routes.owner_invitations import router as owner_invitations_router
from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.db.database import Base, get_db
from app.models.owner_application import OwnerApplication
from app.models.owner_application_workflow import OwnerInvitation
from app.models.user import User


class OwnerRegistrationTests(unittest.TestCase):
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
        self.previous_settings = settings.JWT_SECRET_KEY
        settings.JWT_SECRET_KEY = "test-jwt-secret-key-at-least-32-bytes"
        self.application_counter = 0
        with self.session_factory() as db:
            db.query(OwnerInvitation).delete()
            db.query(OwnerApplication).delete()
            db.query(User).delete()
            db.commit()

        self.app = FastAPI()
        self.app.include_router(auth_router)
        self.app.include_router(owner_invitations_router)
        self.app.include_router(owner_listings_router)

        def override_db():
            with self.session_factory() as db:
                yield db

        self.app.dependency_overrides[get_db] = override_db
        self.client = TestClient(self.app)

    def tearDown(self) -> None:
        with self.session_factory() as db:
            db.query(OwnerInvitation).delete()
            db.query(OwnerApplication).delete()
            db.query(User).delete()
            db.commit()
        settings.JWT_SECRET_KEY = self.previous_settings

    def _create_invitation(
        self,
        *,
        application_status: str = "APPROVED",
        invited_phone: str = "+919876543212",
        expires_at: datetime | None = None,
        revoked_at: datetime | None = None,
        accepted_at: datetime | None = None,
    ) -> tuple[str, str]:
        self.application_counter += 1
        token = (
            f"owner-registration-test-token-1234567890-{self.application_counter:04}"
        )
        application = OwnerApplication(
            application_reference=f"FE-OWNER-REG-{self.application_counter:04}",
            applicant_name="Asha Rao",
            applicant_phone="+919876543212",
            applicant_email="asha@example.com",
            relationship_type="PROPERTY_OWNER",
            pg_name="Asha Residency",
            city="Hyderabad",
            area="Madhapur",
            address="Plot 14, Main Road, Madhapur",
            formatted_address="Plot 14, Main Road, Madhapur, Hyderabad",
            latitude=17.4483,
            longitude=78.3915,
            status=application_status,
            phone_verified=True,
            declaration_accepted_at=datetime.now(timezone.utc),
            status_access_hash=(
                f"owner-registration-test-status-hash-{self.application_counter}"
            ),
        )
        with self.session_factory() as db:
            db.add(application)
            db.flush()
            db.add(
                OwnerInvitation(
                    application_id=application.id,
                    invited_phone=invited_phone,
                    token_hash=hashlib.sha256(token.encode("utf-8")).hexdigest(),
                    expires_at=expires_at
                    or datetime.now(timezone.utc) + timedelta(hours=1),
                    created_by_admin_id=self._create_admin(db),
                    revoked_at=revoked_at,
                    accepted_at=accepted_at,
                )
            )
            db.commit()
            return token, application.id

    @staticmethod
    def _create_admin(db) -> str:
        existing_admin = (
            db.query(User)
            .filter(User.user_role == "ADMIN")
            .first()
        )
        if existing_admin:
            return existing_admin.id
        admin = User(
            email="admin@example.com",
            phone_number="+919876543210",
            phone="9876543210",
            password_hash="unused",
            full_name="Test Admin",
            user_role="ADMIN",
            is_active=True,
        )
        db.add(admin)
        db.flush()
        return admin.id

    def _registration_response(self, token: str):
        return self.client.post(
            "/api/v1/owner-invitations/register",
            json={
                "token": token,
                "password": "owner-password-123",
                "terms_accepted": True,
            },
        )

    def test_valid_invitation_returns_approved_application_details(self) -> None:
        token, _ = self._create_invitation()

        response = self.client.post(
            "/api/v1/owner-invitations/validate",
            json={"token": token},
        )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["status"], "VALID")
        self.assertEqual(response.json()["applicant_name"], "Asha Rao")
        self.assertEqual(response.json()["applicant_phone"], "+919876543212")
        self.assertEqual(response.json()["pg_name"], "Asha Residency")
        self.assertNotIn(token, response.text)

    def test_browser_registration_fallback_is_no_store(self) -> None:
        response = self.client.get("/api/v1/owner-invitations/register")

        self.assertEqual(response.status_code, 200)
        self.assertIn("Owner registration", response.text)
        self.assertIn('const api = location.pathname.replace', response.text)
        self.assertIn('request("/validate"', response.text)
        self.assertIn('request("/register"', response.text)
        self.assertIn("findeasy://owner/register", response.text)
        self.assertIn("new URLSearchParams(location.hash.slice(1))", response.text)
        self.assertEqual(response.headers["cache-control"], "no-store, max-age=0")
        self.assertEqual(response.headers["referrer-policy"], "no-referrer")

    def test_submitted_and_rejected_applications_cannot_register(self) -> None:
        for application_status in ("SUBMITTED", "REJECTED"):
            with self.subTest(application_status=application_status):
                token, _ = self._create_invitation(
                    application_status=application_status
                )
                response = self.client.post(
                    "/api/v1/owner-invitations/validate",
                    json={"token": token},
                )
                self.assertEqual(response.status_code, 200)
                self.assertFalse(response.json()["valid"])
                self.assertEqual(
                    response.json()["status"],
                    "APPLICATION_NOT_APPROVED",
                )

    def test_registration_rejects_nonapproved_applications(self) -> None:
        for application_status in (
            "SUBMITTED",
            "UNDER_REVIEW",
            "ADDITIONAL_INFORMATION_REQUIRED",
            "REJECTED",
        ):
            with self.subTest(application_status=application_status):
                token, _ = self._create_invitation(
                    application_status=application_status
                )
                response = self._registration_response(token)
                self.assertEqual(response.status_code, 409)
                with self.session_factory() as db:
                    self.assertEqual(
                        db.query(User)
                        .filter(User.user_role == "OWNER")
                        .count(),
                        0,
                    )

    def test_expired_revoked_used_and_invalid_invitations_are_reported(self) -> None:
        cases = (
            (
                "EXPIRED",
                {
                    "expires_at": datetime.now(timezone.utc) - timedelta(seconds=1)
                },
            ),
            ("REVOKED", {"revoked_at": datetime.now(timezone.utc)}),
            ("USED", {"accepted_at": datetime.now(timezone.utc)}),
        )
        for expected_status, options in cases:
            with self.subTest(status=expected_status):
                token, _ = self._create_invitation(**options)
                response = self.client.post(
                    "/api/v1/owner-invitations/validate",
                    json={"token": token},
                )
                self.assertEqual(response.status_code, 200)
                self.assertFalse(response.json()["valid"])
                self.assertEqual(response.json()["status"], expected_status)

        invalid = self.client.post(
            "/api/v1/owner-invitations/validate",
            json={"token": "invalid-owner-registration-token-123456"},
        )
        self.assertEqual(invalid.status_code, 200)
        self.assertEqual(invalid.json()["status"], "INVALID")

    def test_invitation_phone_must_match_approved_application(self) -> None:
        token, _ = self._create_invitation(invited_phone="+919876543213")

        response = self.client.post(
            "/api/v1/owner-invitations/validate",
            json={"token": token},
        )

        self.assertEqual(response.json()["status"], "PHONE_MISMATCH")
        self.assertFalse(response.json()["valid"])

    def test_registration_requires_terms_and_conditions_acceptance(self) -> None:
        token, _ = self._create_invitation()

        response = self.client.post(
            "/api/v1/owner-invitations/register",
            json={
                "token": token,
                "password": "owner-password-123",
                "terms_accepted": False,
            },
        )

        self.assertEqual(response.status_code, 422)
        with self.session_factory() as db:
            self.assertEqual(db.query(User).filter(User.user_role == "OWNER").count(), 0)

    def test_duplicate_existing_account_prevents_registration(self) -> None:
        token, _ = self._create_invitation()
        with self.session_factory() as db:
            db.add(
                User(
                    phone_number="+919876543212",
                    phone="9876543212",
                    password_hash="unused",
                    full_name="Existing Seeker",
                    user_role="SEEKER",
                    is_active=True,
                )
            )
            db.commit()

        response = self._registration_response(token)

        self.assertEqual(response.status_code, 409)
        with self.session_factory() as db:
            self.assertEqual(db.query(User).count(), 2)
            self.assertIsNone(db.query(OwnerInvitation).one().accepted_at)

    def test_successful_registration_login_and_owner_listing_access(self) -> None:
        token, application_id = self._create_invitation()

        registration = self._registration_response(token)

        self.assertEqual(registration.status_code, 201, registration.text)
        self.assertTrue(registration.json()["success"])
        with self.session_factory() as db:
            owner = db.query(User).filter(User.user_role == "OWNER").one()
            application = db.query(OwnerApplication).filter_by(
                id=application_id
            ).one()
            invitation = db.query(OwnerInvitation).one()
            self.assertTrue(
                verify_password("owner-password-123", owner.password_hash)
            )
            self.assertNotEqual(owner.password_hash, "owner-password-123")
            self.assertFalse(owner.is_phone_verified)
            self.assertEqual(application.owner_user_id, owner.id)
            self.assertIsNotNone(application.registration_completed_at)
            self.assertEqual(application.status, "INVITATION_ACCEPTED")
            self.assertIsNotNone(invitation.accepted_at)

        login = self.client.post(
            "/api/v1/auth/login",
            json={
                "phone_number": "+919876543212",
                "password": "owner-password-123",
            },
        )
        self.assertEqual(login.status_code, 200, login.text)
        self.assertEqual(login.json()["user"]["user_role"], "OWNER")
        owner_listings = self.client.get(
            "/api/v1/owner/listings",
            headers={
                "Authorization": f"Bearer {login.json()['access_token']}"
            },
        )
        self.assertEqual(owner_listings.status_code, 200, owner_listings.text)

    def test_used_invitation_cannot_be_redeemed_again(self) -> None:
        token, _ = self._create_invitation()
        first = self._registration_response(token)
        second = self._registration_response(token)

        self.assertEqual(first.status_code, 201, first.text)
        self.assertEqual(second.status_code, 409, second.text)
        with self.session_factory() as db:
            self.assertEqual(db.query(User).filter(User.user_role == "OWNER").count(), 1)

    def test_registration_rechecks_invitation_expiry(self) -> None:
        expired_token, _ = self._create_invitation(
            expires_at=datetime.now(timezone.utc) - timedelta(seconds=1)
        )

        expired_invitation = self._registration_response(expired_token)
        self.assertEqual(expired_invitation.status_code, 410)

    def test_revoked_invitation_cannot_be_redeemed(self) -> None:
        token, _ = self._create_invitation(
            revoked_at=datetime.now(timezone.utc)
        )
        response = self._registration_response(token)

        self.assertEqual(response.status_code, 410)
        with self.session_factory() as db:
            self.assertEqual(db.query(User).filter(User.user_role == "OWNER").count(), 0)

    def test_concurrent_redemption_cannot_create_duplicate_owner_accounts(self) -> None:
        token = "owner-registration-concurrent-token-1234567890"
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as temp_db:
            database_path = temp_db.name
        try:
            engine = create_engine(
                f"sqlite:///{database_path}",
                connect_args={"check_same_thread": False, "timeout": 10},
            )
            Base.metadata.create_all(engine)
            session_factory = sessionmaker(
                bind=engine,
                autoflush=False,
                autocommit=False,
            )
            now = datetime.now(timezone.utc)
            with session_factory() as db:
                admin = User(
                    email="concurrent-admin@example.com",
                    phone_number="+919876543210",
                    password_hash="unused",
                    user_role="ADMIN",
                    is_active=True,
                )
                application = OwnerApplication(
                    application_reference="FE-OWNER-CONCURRENT-0001",
                    applicant_name="Asha Rao",
                    applicant_phone="+919876543212",
                    applicant_email="asha.concurrent@example.com",
                    relationship_type="PROPERTY_OWNER",
                    pg_name="Asha Residency",
                    city="Hyderabad",
                    area="Madhapur",
                    address="Plot 14, Main Road, Madhapur",
                    latitude=17.4483,
                    longitude=78.3915,
                    status="APPROVED",
                    declaration_accepted_at=now,
                    status_access_hash="concurrent-owner-registration-status",
                )
                db.add_all([admin, application])
                db.flush()
                db.add_all(
                    [
                        OwnerInvitation(
                            application_id=application.id,
                            invited_phone=application.applicant_phone,
                            token_hash=hashlib.sha256(
                                token.encode("utf-8")
                            ).hexdigest(),
                            expires_at=now + timedelta(hours=1),
                            created_by_admin_id=admin.id,
                        ),
                    ]
                )
                db.commit()

            app = FastAPI()
            app.include_router(owner_invitations_router)

            def override_db():
                with session_factory() as db:
                    yield db

            app.dependency_overrides[get_db] = override_db
            barrier = Barrier(2)

            def wait_then_hash(password: str) -> str:
                barrier.wait(timeout=5)
                return hash_password(password)

            def redeem():
                with TestClient(app) as client:
                    return client.post(
                        "/api/v1/owner-invitations/register",
                        json={
                            "token": token,
                            "password": "owner-password-123",
                            "terms_accepted": True,
                        },
                    )

            try:
                with patch(
                    "app.api.routes.owner_invitations.hash_password",
                    side_effect=wait_then_hash,
                ):
                    with ThreadPoolExecutor(max_workers=2) as executor:
                        futures = [
                            executor.submit(redeem)
                            for _ in range(2)
                        ]
                        responses = [
                            future.result(timeout=15) for future in futures
                        ]
                self.assertEqual(
                    sum(response.status_code == 201 for response in responses),
                    1,
                    [response.status_code for response in responses],
                )
                self.assertIn(
                    next(
                        response.status_code
                        for response in responses
                        if response.status_code != 201
                    ),
                    {409, 503},
                )
                with session_factory() as db:
                    self.assertEqual(
                        db.query(User)
                        .filter(User.user_role == "OWNER")
                        .count(),
                        1,
                    )
            finally:
                engine.dispose()
        finally:
            if os.path.exists(database_path):
                os.remove(database_path)


if __name__ == "__main__":
    unittest.main()
