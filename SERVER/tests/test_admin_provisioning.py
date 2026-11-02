import unittest
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.admin import router as admin_router
from app.api.routes.auth import router as auth_router
from app.cli.provision_admin import ProvisioningError, provision_first_admin
from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.db.database import Base, get_db
from app.models.admin_setup_state import AdminSetupState
from app.models.user import User


class AdminProvisioningTests(unittest.TestCase):
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
            db.query(User).delete()
            db.query(AdminSetupState).delete()
            db.commit()

        self.app = FastAPI()
        self.app.include_router(auth_router)
        self.app.include_router(admin_router)

        def override_db():
            with self.session_factory() as db:
                yield db

        self.app.dependency_overrides[get_db] = override_db
        self.client = TestClient(self.app)

    def tearDown(self) -> None:
        with self.session_factory() as db:
            db.query(User).delete()
            db.query(AdminSetupState).delete()
            db.commit()
        settings.JWT_SECRET_KEY = self.previous_secret

    def _create_user(
        self,
        phone_number: str,
        role: str,
        password: str = "a-strong-password",
        *,
        active: bool = True,
    ) -> User:
        user = User(
            phone_number=phone_number,
            phone=phone_number.removeprefix("+91"),
            password_hash=hash_password(password),
            full_name=f"Test {role}",
            user_role=role,
            is_active=active,
        )
        with self.session_factory() as db:
            db.add(user)
            db.commit()
            db.refresh(user)
            return user

    def test_create_first_admin_hashes_password_and_refuses_second_admin(self) -> None:
        with self.session_factory() as db:
            admin = provision_first_admin(
                db,
                mode="create",
                phone_number="9876543210",
                full_name="First Admin",
                password="a-strong-password",
            )
            admin_id = admin.id
            db.commit()

        with self.session_factory() as db:
            saved_admin = db.get(User, admin_id)
            self.assertIsNotNone(saved_admin)
            self.assertEqual(saved_admin.user_role, "ADMIN")
            self.assertNotEqual(saved_admin.password_hash, "a-strong-password")
            self.assertTrue(
                verify_password("a-strong-password", saved_admin.password_hash)
            )
            self.assertFalse(saved_admin.is_phone_verified)
            with self.assertRaisesRegex(ProvisioningError, "already exists"):
                provision_first_admin(
                    db,
                    mode="create",
                    phone_number="9876543211",
                    full_name="Another Admin",
                    password="another-strong-password",
                )

    def test_promote_requires_existing_active_account_and_preserves_password(self) -> None:
        trusted_user = self._create_user("+919876543210", "SEEKER")
        trusted_user_id = trusted_user.id
        previous_hash = trusted_user.password_hash

        with self.session_factory() as db:
            promoted = provision_first_admin(
                db,
                mode="promote",
                phone_number="9876543210",
            )
            promoted_id = promoted.id
            db.commit()

        with self.session_factory() as db:
            promoted = db.get(User, promoted_id)
            self.assertEqual(promoted.id, trusted_user_id)
            self.assertEqual(promoted.user_role, "ADMIN")
            self.assertEqual(promoted.password_hash, previous_hash)

        with self.session_factory() as db:
            with self.assertRaisesRegex(ProvisioningError, "already exists"):
                provision_first_admin(
                    db,
                    mode="promote",
                    phone_number="9876543211",
                )

    def test_promote_requires_a_registered_account(self) -> None:
        with self.session_factory() as db:
            with self.assertRaisesRegex(ProvisioningError, "No account"):
                provision_first_admin(
                    db,
                    mode="promote",
                    phone_number="9876543210",
                )

    def test_provisioning_rejects_duplicate_and_disabled_phone_matches(self) -> None:
        self._create_user("+919876543210", "SEEKER")
        with self.session_factory() as db:
            with self.assertRaisesRegex(ProvisioningError, "use promote"):
                provision_first_admin(
                    db,
                    mode="create",
                    phone_number="9876543210",
                    full_name="Duplicate",
                    password="a-strong-password",
                )

        with self.session_factory() as db:
            db.query(User).delete()
            db.commit()
        self._create_user(
            "+919876543210",
            "SEEKER",
            active=False,
        )
        with self.session_factory() as db:
            with self.assertRaisesRegex(ProvisioningError, "disabled"):
                provision_first_admin(
                    db,
                    mode="promote",
                    phone_number="9876543210",
                )

    def test_admin_login_token_allows_admin_api_but_other_roles_are_forbidden(self) -> None:
        admin = self._create_user("+919876543210", "ADMIN")
        response = self.client.post(
            "/api/v1/auth/login",
            json={
                "phone_number": "9876543210",
                "password": "a-strong-password",
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["user"]["user_role"], "ADMIN")
        token = response.json()["access_token"]
        admin_response = self.client.get(
            "/api/v1/admin/listings",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(admin_response.status_code, 200, admin_response.text)

        for role, phone in (
            ("SEEKER", "+919876543211"),
            ("OWNER", "+919876543212"),
        ):
            self._create_user(phone, role)
            login = self.client.post(
                "/api/v1/auth/login",
                json={
                    "phone_number": phone,
                    "password": "a-strong-password",
                },
            )
            self.assertEqual(login.status_code, 200, login.text)
            self.assertEqual(login.json()["user"]["user_role"], role)
            forbidden = self.client.get(
                "/api/v1/admin/listings",
                headers={
                    "Authorization": f"Bearer {login.json()['access_token']}"
                },
            )
            self.assertEqual(forbidden.status_code, 403)

        self.assertIsNotNone(admin.id)

    def test_admin_setup_status_reads_existing_state_without_changing_accounts(self) -> None:
        admin = self._create_user("+919876543210", "ADMIN")
        with self.session_factory() as db:
            db.add(
                AdminSetupState(
                    setup_key="initial-admin",
                    admin_user_id=admin.id,
                )
            )
            db.commit()

        response = self.client.get("/api/v1/auth/admin-setup/status")

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {"available": False})
        with self.session_factory() as db:
            self.assertEqual(db.query(User).count(), 1)
            self.assertEqual(db.query(AdminSetupState).count(), 1)
            self.assertEqual(db.query(User).one().user_role, "ADMIN")

    def test_email_password_login_remains_supported(self) -> None:
        user = User(
            email="existing@example.com",
            phone_number="+919876543210",
            phone="9876543210",
            password_hash=hash_password("a-strong-password"),
            full_name="Existing Seeker",
            user_role="SEEKER",
            is_active=True,
        )
        with self.session_factory() as db:
            db.add(user)
            db.commit()

        response = self.client.post(
            "/api/v1/auth/login",
            json={
                "email": "EXISTING@example.com",
                "password": "a-strong-password",
            },
        )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["user"]["user_role"], "SEEKER")
        self.assertTrue(response.json()["access_token"])

    def test_phone_password_login_rejects_invalid_credentials(self) -> None:
        self._create_user("+919876543210", "OWNER")
        response = self.client.post(
            "/api/v1/auth/login",
            json={
                "phone_number": "9876543210",
                "password": "incorrect-password",
            },
        )
        self.assertEqual(response.status_code, 401)

    def test_public_registration_cannot_create_admin_and_expired_token_is_rejected(self) -> None:
        registration = self.client.post(
            "/api/v1/auth/register",
            json={
                "phone_number": "9876543210",
                "password": "a-strong-password",
                "full_name": "Public Admin",
                "user_role": "ADMIN",
            },
        )
        self.assertEqual(registration.status_code, 422)

        expired_token = jwt.encode(
            {
                "sub": "expired-admin",
                "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
            },
            settings.JWT_SECRET_KEY,
            algorithm="HS256",
        )
        response = self.client.get(
            "/api/v1/admin/listings",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        self.assertEqual(response.status_code, 401)

    def test_admin_setup_route_does_not_create_or_recreate_accounts(self) -> None:
        status_response = self.client.get("/api/v1/auth/admin-setup/status")
        self.assertEqual(status_response.status_code, 200)
        self.assertEqual(status_response.json(), {"available": True})

        response = self.client.post(
            "/api/v1/auth/admin-setup",
            json={"full_name": "Admin", "password": "a-strong-password"},
        )
        self.assertEqual(response.status_code, 404)

        with self.session_factory() as db:
            self.assertEqual(db.query(User).count(), 0)

    def test_setup_status_depends_on_existing_state_not_setup_token(self) -> None:
        status_response = self.client.get("/api/v1/auth/admin-setup/status")
        self.assertEqual(status_response.status_code, 200)
        self.assertEqual(status_response.json(), {"available": True})


if __name__ == "__main__":
    unittest.main()
