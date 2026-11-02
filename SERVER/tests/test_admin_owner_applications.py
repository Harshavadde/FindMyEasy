import unittest
from datetime import datetime, timedelta, timezone
import hashlib
from urllib.parse import parse_qs, urlparse
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models
from app.api.routes.admin import router as admin_router
from app.api.routes.admin_owner_applications import (
    router as admin_owner_applications_router,
)
from app.api.routes.auth import router as auth_router
from app.api.routes.owner_applications import (
    router as owner_applications_router,
)
from app.api.routes.owner_invitations import router as owner_invitations_router
from app.core.config import settings
from app.core.security import hash_password
from app.db.database import Base, get_db
from app.models.owner_application import OwnerApplication
from app.models.owner_application_workflow import (
    OwnerApplicationHistory,
    OwnerInvitation,
)
from app.models.user import User


class AdminOwnerApplicationTests(unittest.TestCase):
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
        self.previous_environment = settings.ENVIRONMENT
        self.previous_public_base_url = settings.PUBLIC_BASE_URL
        settings.JWT_SECRET_KEY = "test-jwt-secret-key-at-least-32-bytes"
        settings.ENVIRONMENT = "development"
        settings.PUBLIC_BASE_URL = "http://localhost:8000"
        self.email_delivery_patcher = patch(
            "app.api.routes.admin_owner_applications.send_owner_registration_invitation"
        )
        self.send_invitation_email = self.email_delivery_patcher.start()
        with self.session_factory() as db:
            db.query(OwnerInvitation).delete()
            db.query(OwnerApplicationHistory).delete()
            db.query(OwnerApplication).delete()
            db.query(User).delete()
            db.commit()

        self.app = FastAPI()
        self.app.include_router(auth_router)
        self.app.include_router(admin_router)
        self.app.include_router(admin_owner_applications_router)
        self.app.include_router(owner_applications_router)
        self.app.include_router(owner_invitations_router)

        def override_db():
            with self.session_factory() as db:
                yield db

        self.app.dependency_overrides[get_db] = override_db
        self.client = TestClient(self.app)
        self.admin_token = self._create_user_and_login("ADMIN", "9876543210")
        self.user_token = self._create_user_and_login("SEEKER", "9876543211")

    def tearDown(self) -> None:
        self.email_delivery_patcher.stop()
        with self.session_factory() as db:
            db.query(OwnerInvitation).delete()
            db.query(OwnerApplicationHistory).delete()
            db.query(OwnerApplication).delete()
            db.query(User).delete()
            db.commit()
        settings.JWT_SECRET_KEY = self.previous_secret
        settings.ENVIRONMENT = self.previous_environment
        settings.PUBLIC_BASE_URL = self.previous_public_base_url

    def _create_user_and_login(self, role: str, phone: str) -> str:
        with self.session_factory() as db:
            db.add(
                User(
                    full_name=f"Test {role}",
                    phone_number=f"+91{phone}",
                    phone=phone,
                    password_hash=hash_password("a-strong-password"),
                    user_role=role,
                    is_active=True,
                )
            )
            db.commit()

        response = self.client.post(
            "/api/v1/auth/login",
            json={
                "phone_number": phone,
                "password": "a-strong-password",
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["access_token"]

    def _create_application(
        self,
        *,
        applicant_name: str,
        application_reference: str,
        status_value: str = "SUBMITTED",
        city: str = "Hyderabad",
        relationship_type: str = "PROPERTY_OWNER",
        submitted_at: datetime | None = None,
        applicant_email: str | None = "asha@example.com",
    ) -> OwnerApplication:
        application = OwnerApplication(
            application_reference=application_reference,
            applicant_name=applicant_name,
            applicant_phone="+919876543212",
            applicant_email=applicant_email,
            relationship_type=relationship_type,
            pg_name=f"{applicant_name}'s PG",
            city=city,
            area="Madhapur",
            address="Plot 14, Main Road, Madhapur",
            formatted_address="Plot 14, Main Road, Madhapur, Hyderabad",
            latitude=17.4483,
            longitude=78.3915,
            google_place_id="place-id",
            google_maps_url=(
                "https://www.google.com/maps/search/?api=1&query=17.4483,78.3915"
            ),
            status=status_value,
            phone_verified=False,
            declaration_accepted_at=datetime.now(timezone.utc),
            status_access_hash=f"hash-{application_reference}",
            submitted_at=submitted_at or datetime.now(timezone.utc),
        )
        with self.session_factory() as db:
            db.add(application)
            db.commit()
            db.refresh(application)
            return application

    def test_owner_application_admin_endpoints_require_admin(self) -> None:
        for method, path in (
            ("GET", "/api/v1/admin/owner-applications"),
            ("GET", "/api/v1/admin/owner-applications/stats"),
            ("GET", "/api/v1/admin/owner-applications/missing-id"),
            ("POST", "/api/v1/admin/owner-applications/missing-id/approve"),
            ("GET", "/api/v1/admin/owner-applications/missing-id/invitations"),
        ):
            unauthenticated = self.client.request(method, path)
            self.assertEqual(unauthenticated.status_code, 401, path)

            unauthorized = self.client.request(
                method,
                path,
                headers={"Authorization": f"Bearer {self.user_token}"},
            )
            self.assertEqual(unauthorized.status_code, 403, path)

    def test_stats_return_actual_counts_including_zero_future_statuses(self) -> None:
        self._create_application(
            applicant_name="Asha Rao",
            application_reference="FE-0000000000000001",
        )
        self._create_application(
            applicant_name="Ravi Shah",
            application_reference="FE-0000000000000002",
            status_value="APPROVED",
        )

        response = self.client.get(
            "/api/v1/admin/owner-applications/stats",
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(
            response.json(),
            {
                "total_applications": 2,
                "submitted": 1,
                "under_review": 0,
                "additional_information_required": 0,
                "approved": 1,
                "rejected": 0,
                "invitations_sent": 0,
                "invitations_accepted": 0,
                "expired": 0,
            },
        )

    def test_list_search_filters_sorting_pagination_and_city_options(self) -> None:
        self._create_application(
            applicant_name="Asha Rao",
            application_reference="FE-0000000000000001",
            city="Hyderabad",
        )
        self._create_application(
            applicant_name="Ravi Shah",
            application_reference="FE-0000000000000002",
            city="Bengaluru",
            relationship_type="PROPERTY_MANAGER",
        )

        response = self.client.get(
            "/api/v1/admin/owner-applications",
            params={
                "search": "Ravi",
                "status": "SUBMITTED",
                "city": "bengaluru",
                "relationship_type": "PROPERTY_MANAGER",
                "sort_by": "applicant_name",
                "sort_order": "asc",
                "page": 1,
                "page_size": 1,
            },
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertEqual(result["total"], 1)
        self.assertEqual(result["page"], 1)
        self.assertEqual(result["page_size"], 1)
        self.assertEqual(result["total_pages"], 1)
        self.assertEqual(result["items"][0]["applicant_name"], "Ravi Shah")
        self.assertCountEqual(result["cities"], ["Bengaluru", "Hyderabad"])
        self.assertNotIn("status_access_hash", result["items"][0])

    def test_submitted_application_is_visible_to_admin(self) -> None:
        submission = self.client.post(
            "/api/v1/owner-applications",
            json={
                "applicant_name": "Asha Rao",
                "applicant_phone": "9876543214",
                "relationship_type": "PROPERTY_OWNER",
                "pg_name": "Admin Visibility Test PG",
                "city": "Hyderabad",
                "area": "Madhapur",
                "address": "Plot 14, Main Road, Madhapur, Hyderabad",
                "latitude": 17.4483,
                "longitude": 78.3915,
                "declaration_accepted": True,
            },
        )
        self.assertEqual(submission.status_code, 201, submission.text)

        response = self.client.get(
            "/api/v1/admin/owner-applications",
            params={"search": submission.json()["application_reference"]},
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertEqual(result["total"], 1)
        self.assertEqual(
            result["items"][0]["application_reference"],
            submission.json()["application_reference"],
        )
        self.assertEqual(result["items"][0]["status"], "SUBMITTED")

    def test_detail_returns_review_fields_without_private_access_hash(self) -> None:
        application = self._create_application(
            applicant_name="Asha Rao",
            application_reference="FE-0000000000000001",
        )
        response = self.client.get(
            f"/api/v1/admin/owner-applications/{application.id}",
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        detail = response.json()
        self.assertEqual(detail["applicant_name"], "Asha Rao")
        self.assertEqual(detail["pg_name"], "Asha Rao's PG")
        self.assertEqual(detail["latitude"], 17.4483)
        self.assertFalse(detail["phone_verified"])
        self.assertTrue(detail["history_available"])
        self.assertEqual(detail["status_history"], [])
        self.assertIsNone(detail["last_updated_at"])
        self.assertNotIn("status_access_hash", detail)

    def test_detail_shows_owner_registration_and_used_invitation_status(self) -> None:
        application = self._create_application(
            applicant_name="Asha Rao",
            application_reference="FE-0000000000000001",
            status_value="INVITATION_ACCEPTED",
        )
        registered_at = datetime.now(timezone.utc)
        with self.session_factory() as db:
            owner = User(
                email="owner-registered@example.com",
                phone_number=application.applicant_phone,
                phone="9876543212",
                password_hash=hash_password("owner-password-123"),
                full_name=application.applicant_name,
                user_role="OWNER",
                is_phone_verified=True,
                is_active=True,
                created_at=registered_at,
            )
            db.add(owner)
            db.flush()
            application_row = db.query(OwnerApplication).filter_by(
                id=application.id
            ).one()
            application_row.owner_user_id = owner.id
            application_row.registration_completed_at = registered_at
            owner_id = owner.id
            owner_created_at = owner.created_at
            self.assertIsNotNone(owner_created_at)
            admin_id = (
                db.query(User.id)
                .filter(User.user_role == "ADMIN")
                .scalar()
            )
            db.add(
                OwnerInvitation(
                    application_id=application.id,
                    invited_phone=application.applicant_phone,
                    token_hash=hashlib.sha256(
                        b"owner-registration-token"
                    ).hexdigest(),
                    expires_at=registered_at + timedelta(hours=1),
                    created_by_admin_id=admin_id,
                    accepted_at=registered_at,
                    delivery_status="NOT_CONFIGURED",
                )
            )
            db.commit()

        detail = self.client.get(
            f"/api/v1/admin/owner-applications/{application.id}",
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(detail.status_code, 200, detail.text)
        self.assertEqual(detail.json()["owner_user_id"], owner_id)
        self.assertEqual(
            datetime.fromisoformat(detail.json()["registration_completed_at"]),
            registered_at.replace(tzinfo=None),
        )
        self.assertIsNotNone(
            detail.json()["owner_account_created_at"],
            detail.json(),
        )
        self.assertEqual(
            datetime.fromisoformat(detail.json()["owner_account_created_at"]),
            owner_created_at.replace(tzinfo=None),
            detail.json(),
        )

        invitations = self.client.get(
            f"/api/v1/admin/owner-applications/{application.id}/invitations",
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(invitations.status_code, 200, invitations.text)
        self.assertEqual(invitations.json()["items"][0]["status"], "USED")

        missing = self.client.get(
            "/api/v1/admin/owner-applications/missing-id",
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(missing.status_code, 404)

    def test_invalid_date_range_is_rejected(self) -> None:
        response = self.client.get(
            "/api/v1/admin/owner-applications",
            params={
                "submitted_from": "2026-04-02",
                "submitted_to": "2026-04-01",
            },
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(response.status_code, 422)

    def test_submitted_date_filter_includes_requested_day(self) -> None:
        self._create_application(
            applicant_name="Asha Rao",
            application_reference="FE-0000000000000001",
            submitted_at=datetime(2026, 4, 2, 14, 30, tzinfo=timezone.utc),
        )
        self._create_application(
            applicant_name="Ravi Shah",
            application_reference="FE-0000000000000002",
            submitted_at=datetime(2026, 4, 3, 0, 0, tzinfo=timezone.utc),
        )

        response = self.client.get(
            "/api/v1/admin/owner-applications",
            params={
                "submitted_from": "2026-04-02",
                "submitted_to": "2026-04-02",
            },
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["total"], 1)
        self.assertEqual(response.json()["items"][0]["applicant_name"], "Asha Rao")

    def test_approval_is_admin_only_atomic_and_recorded_in_history(self) -> None:
        application = self._create_application(
            applicant_name="Asha Rao",
            application_reference="FE-0000000000000001",
        )
        forbidden = self.client.post(
            f"/api/v1/admin/owner-applications/{application.id}/approve",
            headers={"Authorization": f"Bearer {self.user_token}"},
        )
        self.assertEqual(forbidden.status_code, 403)

        response = self.client.post(
            f"/api/v1/admin/owner-applications/{application.id}/approve",
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["status"], "APPROVED")

        with self.session_factory() as db:
            persisted = db.query(OwnerApplication).filter_by(id=application.id).one()
            event = (
                db.query(OwnerApplicationHistory)
                .filter_by(application_id=application.id)
                .one()
            )
            self.assertEqual(persisted.status, "APPROVED")
            self.assertEqual(event.action, "APPROVED")
            self.assertEqual(event.previous_status, "SUBMITTED")
            self.assertEqual(event.new_status, "APPROVED")
            self.assertEqual(event.performed_by_admin_id, self._admin_id())

        duplicate = self.client.post(
            f"/api/v1/admin/owner-applications/{application.id}/approve",
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(duplicate.status_code, 409)

    def test_rejection_requires_reason_and_records_internal_review(self) -> None:
        application = self._create_application(
            applicant_name="Asha Rao",
            application_reference="FE-0000000000000001",
        )
        missing_reason = self.client.post(
            f"/api/v1/admin/owner-applications/{application.id}/reject",
            json={"reason": "   "},
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(missing_reason.status_code, 422)

        response = self.client.post(
            f"/api/v1/admin/owner-applications/{application.id}/reject",
            json={
                "reason": "The submitted address could not be verified.",
                "internal_note": "Follow up only if the applicant reapplies.",
            },
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["status"], "REJECTED")

        detail = self.client.get(
            f"/api/v1/admin/owner-applications/{application.id}",
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(detail.status_code, 200, detail.text)
        event = detail.json()["status_history"][-1]
        self.assertEqual(event["message"], "The submitted address could not be verified.")
        self.assertEqual(
            event["internal_note"],
            "Follow up only if the applicant reapplies.",
        )

        invite = self.client.post(
            f"/api/v1/admin/owner-applications/{application.id}/invitations",
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(invite.status_code, 409)

    def test_request_information_changes_status_and_is_historic(self) -> None:
        application = self._create_application(
            applicant_name="Asha Rao",
            application_reference="FE-0000000000000001",
        )
        response = self.client.post(
            f"/api/v1/admin/owner-applications/{application.id}/request-information",
            json={"message": "Please provide proof of property ownership."},
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(
            response.json()["status"],
            "ADDITIONAL_INFORMATION_REQUIRED",
        )
        with self.session_factory() as db:
            event = (
                db.query(OwnerApplicationHistory)
                .filter_by(application_id=application.id)
                .one()
            )
            self.assertEqual(event.action, "INFORMATION_REQUESTED")
            self.assertEqual(event.message, "Please provide proof of property ownership.")
            self.assertEqual(event.performed_by_admin_id, self._admin_id())

            invitation = self.client.post(
                f"/api/v1/admin/owner-applications/{application.id}/invitations",
                headers={"Authorization": f"Bearer {self.admin_token}"},
            )
            self.assertEqual(invitation.status_code, 409)

            blank = self.client.post(
            f"/api/v1/admin/owner-applications/{application.id}/request-information",
            json={"message": "  "},
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(blank.status_code, 422)

    def test_invitation_is_hash_only_single_active_and_revokeable(self) -> None:
        application = self._create_application(
            applicant_name="Asha Rao",
            application_reference="FE-0000000000000001",
            status_value="APPROVED",
        )
        created = self.client.post(
            f"/api/v1/admin/owner-applications/{application.id}/invitations",
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(created.status_code, 201, created.text)
        invitation_data = created.json()
        invitation_url = urlparse(invitation_data["invitation_url"])
        self.assertEqual(
            invitation_url.path,
            "/api/v1/owner-invitations/register",
        )
        token = parse_qs(invitation_url.fragment)["token"][0]
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()

        self.assertEqual(invitation_data["status"], "ACTIVE")
        self.assertEqual(invitation_data["delivery_status"], "DELIVERED")
        self.assertEqual(invitation_data["delivery_channel"], "EMAIL")
        self.assertEqual(invitation_data["invited_phone"], application.applicant_phone)
        self.send_invitation_email.assert_called_once()
        email_kwargs = self.send_invitation_email.call_args.kwargs
        self.assertEqual(email_kwargs["recipient"], application.applicant_email)
        self.assertIn(token, email_kwargs["invitation_url"])
        expires_at = datetime.fromisoformat(
            invitation_data["expires_at"].replace("Z", "+00:00")
        )
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        self.assertGreater(
            (expires_at - datetime.now(timezone.utc)).total_seconds(),
            71 * 60 * 60,
        )
        validation = self.client.post(
            "/api/v1/owner-invitations/validate",
            json={"token": token},
        )
        self.assertEqual(validation.status_code, 200, validation.text)
        self.assertTrue(validation.json()["valid"])
        invalid_validation = self.client.post(
            "/api/v1/owner-invitations/validate",
            json={"token": "x" * 43},
        )
        self.assertEqual(invalid_validation.status_code, 200)
        self.assertFalse(invalid_validation.json()["valid"])
        with self.session_factory() as db:
            invitation = db.query(OwnerInvitation).one()
            self.assertEqual(invitation.token_hash, token_hash)
            self.assertNotEqual(invitation.token_hash, token)
            self.assertEqual(invitation.invited_phone, application.applicant_phone)
            self.assertEqual(invitation.created_by_admin_id, self._admin_id())

        duplicate = self.client.post(
            f"/api/v1/admin/owner-applications/{application.id}/invitations",
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(duplicate.status_code, 409)

        listed = self.client.get(
            f"/api/v1/admin/owner-applications/{application.id}/invitations",
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(listed.status_code, 200, listed.text)
        listed_invitation = listed.json()["items"][0]
        self.assertNotIn("invitation_url", listed_invitation)
        self.assertNotIn("token_hash", listed_invitation)

        revoked = self.client.post(
            f"/api/v1/admin/owner-applications/invitations/{invitation_data['id']}/revoke",
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(revoked.status_code, 200, revoked.text)
        self.assertEqual(revoked.json()["status"], "REVOKED")
        with self.session_factory() as db:
            history = (
                db.query(OwnerApplicationHistory)
                .filter_by(application_id=application.id)
                .order_by(OwnerApplicationHistory.created_at.asc())
                .all()
            )
            self.assertEqual(
                [item.action for item in history],
                ["INVITATION_CREATED", "INVITATION_REVOKED"],
            )
        revoked_validation = self.client.post(
            "/api/v1/owner-invitations/validate",
            json={"token": token},
        )
        self.assertEqual(revoked_validation.status_code, 200)
        self.assertFalse(revoked_validation.json()["valid"])

        replacement = self.client.post(
            f"/api/v1/admin/owner-applications/{application.id}/invitations",
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(replacement.status_code, 201, replacement.text)

    def test_email_registration_url_reaches_owner_registration_and_login(self) -> None:
        application = self._create_application(
            applicant_name="Asha Rao",
            application_reference="FE-0000000000000002",
            status_value="APPROVED",
        )
        invitation = self.client.post(
            f"/api/v1/admin/owner-applications/{application.id}/invitations",
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(invitation.status_code, 201, invitation.text)
        url = urlparse(invitation.json()["invitation_url"])
        self.assertEqual(url.path, "/api/v1/owner-invitations/register")
        self.assertEqual(url.query, "")
        token = parse_qs(url.fragment)["token"][0]

        validation = self.client.post(
            "/api/v1/owner-invitations/validate",
            json={"token": token},
        )
        self.assertTrue(validation.json()["valid"])
        registration = self.client.post(
            "/api/v1/owner-invitations/register",
            json={
                "token": token,
                "password": "owner-password-123",
                "terms_accepted": True,
            },
        )
        self.assertEqual(registration.status_code, 201, registration.text)
        login = self.client.post(
            "/api/v1/auth/login",
            json={
                "phone_number": application.applicant_phone,
                "password": "owner-password-123",
            },
        )
        self.assertEqual(login.status_code, 200, login.text)
        self.assertEqual(login.json()["user"]["user_role"], "OWNER")

    def test_invitation_expiry_is_checked_server_side(self) -> None:
        application = self._create_application(
            applicant_name="Asha Rao",
            application_reference="FE-0000000000000001",
            status_value="APPROVED",
        )
        created = self.client.post(
            f"/api/v1/admin/owner-applications/{application.id}/invitations",
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(created.status_code, 201, created.text)
        with self.session_factory() as db:
            invitation = db.query(OwnerInvitation).one()
            invitation.expires_at = datetime(2000, 1, 1, tzinfo=timezone.utc)
            db.commit()

        token = parse_qs(urlparse(created.json()["invitation_url"]).fragment)["token"][0]
        expired_validation = self.client.post(
            "/api/v1/owner-invitations/validate",
            json={"token": token},
        )
        self.assertEqual(expired_validation.status_code, 200)
        self.assertFalse(expired_validation.json()["valid"])

        listed = self.client.get(
            f"/api/v1/admin/owner-applications/{application.id}/invitations",
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(listed.status_code, 200, listed.text)
        self.assertEqual(listed.json()["items"][0]["status"], "EXPIRED")

        replacement = self.client.post(
            f"/api/v1/admin/owner-applications/{application.id}/invitations",
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(replacement.status_code, 201, replacement.text)

    def test_invitation_without_email_address_is_not_created(self) -> None:
        application = self._create_application(
            applicant_name="Asha Rao",
            application_reference="FE-0000000000000001",
            status_value="APPROVED",
            applicant_email=None,
        )

        response = self.client.post(
            f"/api/v1/admin/owner-applications/{application.id}/invitations",
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )

        self.assertEqual(response.status_code, 409, response.text)
        with self.session_factory() as db:
            self.assertEqual(db.query(OwnerInvitation).count(), 0)
        self.send_invitation_email.assert_not_called()

    def test_email_delivery_failure_is_persisted_as_failed(self) -> None:
        application = self._create_application(
            applicant_name="Asha Rao",
            application_reference="FE-0000000000000001",
            status_value="APPROVED",
        )
        self.send_invitation_email.side_effect = OSError("SMTP unavailable")

        response = self.client.post(
            f"/api/v1/admin/owner-applications/{application.id}/invitations",
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )

        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json()["delivery_status"], "FAILED")
        with self.session_factory() as db:
            persisted = db.query(OwnerInvitation).one()
            self.assertEqual(persisted.delivery_status, "FAILED")

    def test_missing_email_configuration_is_persisted_as_failed(self) -> None:
        application = self._create_application(
            applicant_name="Asha Rao",
            application_reference="FE-0000000000000001",
            status_value="APPROVED",
        )
        self.email_delivery_patcher.stop()
        with patch(
            "app.core.config.settings.OWNER_EMAIL_SMTP_HOST",
            "",
        ):
            response = self.client.post(
                f"/api/v1/admin/owner-applications/{application.id}/invitations",
                headers={"Authorization": f"Bearer {self.admin_token}"},
            )
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json()["delivery_status"], "FAILED")

    def test_only_approved_applications_can_generate_or_validate_invitations(self) -> None:
        for index, status_value in enumerate(
            ("SUBMITTED", "ADDITIONAL_INFORMATION_REQUIRED", "REJECTED"),
            start=1,
        ):
            application = self._create_application(
                applicant_name=f"Applicant {index}",
                application_reference=f"FE-{index:016d}",
                status_value=status_value,
            )
            response = self.client.post(
                f"/api/v1/admin/owner-applications/{application.id}/invitations",
                headers={"Authorization": f"Bearer {self.admin_token}"},
            )
            self.assertEqual(response.status_code, 409, status_value)

        approved = self._create_application(
            applicant_name="Approved Applicant",
            application_reference="FE-0000000000000099",
            status_value="APPROVED",
        )
        created = self.client.post(
            f"/api/v1/admin/owner-applications/{approved.id}/invitations",
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(created.status_code, 201, created.text)
        token = parse_qs(urlparse(created.json()["invitation_url"]).fragment)["token"][0]

        with self.session_factory() as db:
            db.query(OwnerApplication).filter_by(id=approved.id).update(
                {"status": "SUBMITTED"}
            )
            db.commit()
        validation = self.client.post(
            "/api/v1/owner-invitations/validate",
            json={"token": token},
        )
        self.assertEqual(validation.status_code, 200, validation.text)
        self.assertFalse(validation.json()["valid"])

    def _admin_id(self) -> str:
        with self.session_factory() as db:
            admin = db.query(User).filter_by(user_role="ADMIN").one()
            return admin.id


if __name__ == "__main__":
    unittest.main()
