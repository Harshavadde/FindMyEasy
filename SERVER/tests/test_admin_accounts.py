import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.admin import router as admin_router
from app.api.routes.auth import router as auth_router
from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.db.database import Base, get_db
from app.models.admin_account_audit_log import AdminAccountAuditLog
from app.models.admin_setup_state import AdminSetupState
from app.models.listing import Listing
from app.models.user import User


class AdminAccountTests(unittest.TestCase):
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
        with self.session_factory() as db:
            db.query(AdminAccountAuditLog).delete()
            db.query(AdminSetupState).delete()
            db.query(Listing).delete()
            db.query(User).delete()
            db.commit()
            self.admin = self._new_user(db, "9876543210", "ADMIN")
            db.add(
                AdminSetupState(
                    setup_key="initial-admin",
                    admin_user_id=self.admin.id,
                )
            )
            self.owner = self._new_user(db, "9876543211", "OWNER")
            self.seeker = self._new_user(db, "9876543212", "SEEKER")
            db.commit()
            self.admin_id = self.admin.id
            self.owner_id = self.owner.id
            self.seeker_id = self.seeker.id

        self.app = FastAPI()
        self.app.include_router(auth_router)
        self.app.include_router(admin_router)

        def override_db():
            with self.session_factory() as db:
                yield db

        self.app.dependency_overrides[get_db] = override_db
        self.client = TestClient(self.app)
        self.admin_token = self._login("9876543210")
        self.owner_token = self._login("9876543211")
        self.seeker_token = self._login("9876543212")

    def tearDown(self) -> None:
        with self.session_factory() as db:
            db.query(AdminAccountAuditLog).delete()
            db.query(AdminSetupState).delete()
            db.query(Listing).delete()
            db.query(User).delete()
            db.commit()
        settings.JWT_SECRET_KEY = self.previous_secret

    @staticmethod
    def _new_user(db, phone: str, role: str) -> User:
        user = User(
            email=f"{role.lower()}-{phone}@example.com",
            full_name=f"Test {role}",
            phone_number=f"+91{phone}",
            phone=phone,
            password_hash=hash_password("a-strong-password"),
            user_role=role,
            is_active=True,
        )
        db.add(user)
        db.flush()
        return user

    def _login(self, phone: str, password: str = "a-strong-password") -> str:
        response = self.client.post(
            "/api/v1/auth/login",
            json={"phone_number": phone, "password": password},
        )
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["access_token"]

    @staticmethod
    def _headers(token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {token}"}

    def test_admin_can_create_second_admin_and_created_user_can_sign_in(self) -> None:
        with self.session_factory() as db:
            shared_listing = Listing(
                name="Shared Admin Listing",
                property_type="PG",
                gender="Co-living",
                monthly_price=10000,
                total_beds=1,
                available_beds=1,
                filled_beds=0,
                ac_type="Non-AC",
                facilities=[],
                food_available="No",
                city="Hyderabad",
                area="Madhapur",
                address="1 Shared Road",
                status="published",
            )
            db.add(shared_listing)
            db.commit()
            shared_listing_id = shared_listing.id

        response = self.client.post(
            "/api/v1/admin/administrators",
            headers=self._headers(self.admin_token),
            json={
                "full_name": "Second Administrator",
                "phone_number": "9876543213",
                "email": "SECOND.ADMIN@example.com",
                "password": "another-strong-password",
                "user_role": "SEEKER",
            },
        )
        self.assertEqual(response.status_code, 201, response.text)
        created = response.json()
        self.assertEqual(created["user_role"], "ADMIN")
        self.assertEqual(created["phone_number"], "+919876543213")
        self.assertEqual(created["email"], "second.admin@example.com")
        self.assertNotIn("password_hash", created)

        with self.session_factory() as db:
            account = db.query(User).filter(User.id == created["id"]).one()
            self.assertTrue(
                verify_password("another-strong-password", account.password_hash)
            )
            self.assertEqual(account.user_role, "ADMIN")
            self.assertTrue(account.is_active)
            audit = (
                db.query(AdminAccountAuditLog)
                .filter(AdminAccountAuditLog.target_admin_id == account.id)
                .one()
            )
            self.assertEqual(audit.actor_admin_id, self.admin_id)
            self.assertEqual(audit.action, "ADMIN_CREATED")

        second_token = self._login("9876543213", "another-strong-password")
        listing_response = self.client.get(
            "/api/v1/admin/listings",
            headers=self._headers(second_token),
        )
        self.assertEqual(listing_response.status_code, 200, listing_response.text)
        first_admin_listings = self.client.get(
            "/api/v1/admin/listings",
            headers=self._headers(self.admin_token),
        )
        self.assertEqual(first_admin_listings.status_code, 200)
        self.assertEqual(
            [item["id"] for item in listing_response.json()["items"]],
            [shared_listing_id],
        )
        self.assertEqual(
            [item["id"] for item in first_admin_listings.json()["items"]],
            [shared_listing_id],
        )

    def test_duplicate_phone_and_email_are_rejected(self) -> None:
        response = self.client.post(
            "/api/v1/admin/administrators",
            headers=self._headers(self.admin_token),
            json={
                "full_name": "Duplicate Phone",
                "phone_number": "9876543210",
                "password": "another-strong-password",
            },
        )
        self.assertEqual(response.status_code, 409)

        response = self.client.post(
            "/api/v1/admin/administrators",
            headers=self._headers(self.admin_token),
            json={
                "full_name": "Duplicate Email",
                "phone_number": "9876543213",
                "email": "ADMIN-9876543210@example.com",
                "password": "another-strong-password",
            },
        )
        self.assertEqual(response.status_code, 409)

    def test_owner_and_seeker_cannot_manage_admin_accounts(self) -> None:
        for token in (self.owner_token, self.seeker_token):
            response = self.client.get(
                "/api/v1/admin/administrators",
                headers=self._headers(token),
            )
            self.assertEqual(response.status_code, 403)
            response = self.client.post(
                f"/api/v1/admin/administrators/{self.admin_id}/disable",
                headers=self._headers(token),
            )
            self.assertEqual(response.status_code, 403)
            response = self.client.get(
                "/api/v1/admin/listings",
                headers=self._headers(token),
            )
            self.assertEqual(response.status_code, 403)
            response = self.client.post(
                "/api/v1/admin/administrators",
                headers=self._headers(token),
                json={
                    "full_name": "Unauthorized",
                    "phone_number": "9876543213",
                    "password": "another-strong-password",
                },
            )
            self.assertEqual(response.status_code, 403)

    def test_admin_account_can_be_disabled_and_cannot_sign_in(self) -> None:
        created = self.client.post(
            "/api/v1/admin/administrators",
            headers=self._headers(self.admin_token),
            json={
                "full_name": "Temporary Administrator",
                "phone_number": "9876543213",
                "password": "another-strong-password",
            },
        ).json()
        second_token = self._login("9876543213", "another-strong-password")
        disabled = self.client.post(
            f"/api/v1/admin/administrators/{created['id']}/disable",
            headers=self._headers(self.admin_token),
        )
        self.assertEqual(disabled.status_code, 200, disabled.text)
        self.assertFalse(disabled.json()["is_active"])
        self.assertEqual(
            self.client.get(
                "/api/v1/auth/me",
                headers=self._headers(second_token),
            ).status_code,
            401,
        )

        login = self.client.post(
            "/api/v1/auth/login",
            json={
                "phone_number": "9876543213",
                "password": "another-strong-password",
            },
        )
        self.assertEqual(login.status_code, 403)

        with self.session_factory() as db:
            audit = (
                db.query(AdminAccountAuditLog)
                .filter(
                    AdminAccountAuditLog.target_admin_id == created["id"],
                    AdminAccountAuditLog.action == "ADMIN_DISABLED",
                )
                .one()
            )
            self.assertEqual(audit.actor_admin_id, self.admin_id)

    def test_primary_and_current_admin_accounts_cannot_be_disabled(self) -> None:
        response = self.client.post(
            f"/api/v1/admin/administrators/{self.admin_id}/disable",
            headers=self._headers(self.admin_token),
        )
        self.assertEqual(response.status_code, 409)

        second_admin = self.client.post(
            "/api/v1/admin/administrators",
            headers=self._headers(self.admin_token),
            json={
                "full_name": "Second Administrator",
                "phone_number": "9876543213",
                "password": "another-strong-password",
            },
        ).json()
        second_admin_token = self._login(
            "9876543213",
            "another-strong-password",
        )
        response = self.client.post(
            f"/api/v1/admin/administrators/{second_admin['id']}/disable",
            headers=self._headers(second_admin_token),
        )
        self.assertEqual(response.status_code, 409)

    def test_public_registration_cannot_create_admin_and_invalid_login_fails(self) -> None:
        registration = self.client.post(
            "/api/v1/auth/register",
            json={
                "full_name": "Public Admin",
                "phone_number": "9876543213",
                "password": "another-strong-password",
                "user_role": "ADMIN",
            },
        )
        self.assertIn(registration.status_code, (201, 422))
        if registration.status_code == 201:
            self.assertEqual(registration.json()["user"]["user_role"], "SEEKER")

        invalid_login = self.client.post(
            "/api/v1/auth/login",
            json={
                "phone_number": "9876543210",
                "password": "wrong-password",
            },
        )
        self.assertEqual(invalid_login.status_code, 401)


if __name__ == "__main__":
    unittest.main()
