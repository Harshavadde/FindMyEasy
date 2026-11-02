import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.auth import router as auth_router
from app.api.routes.owner_applications import router as owner_applications_router
from app.core.security import hash_password
from app.db.database import get_db
from app.models.owner_application import OwnerApplication
from app.models.user import User


class OwnerApplicationTests(unittest.TestCase):
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
        OwnerApplication.__table__.create(cls.engine)
        User.__table__.create(cls.engine)

    @classmethod
    def tearDownClass(cls) -> None:
        User.__table__.drop(cls.engine)
        OwnerApplication.__table__.drop(cls.engine)
        cls.engine.dispose()

    def setUp(self) -> None:
        with self.session_factory() as db:
            db.query(OwnerApplication).delete()
            db.query(User).delete()
            db.commit()

        self.app = FastAPI()
        self.app.include_router(owner_applications_router)
        self.app.include_router(auth_router)

        def override_db():
            with self.session_factory() as db:
                yield db

        self.app.dependency_overrides[get_db] = override_db
        self.client = TestClient(self.app)

    def tearDown(self) -> None:
        with self.session_factory() as db:
            db.query(OwnerApplication).delete()
            db.query(User).delete()
            db.commit()

    @staticmethod
    def _payload(**overrides) -> dict:
        payload = {
            "applicant_name": "  Asha   Rao ",
            "applicant_phone": "9876543210",
            "relationship_type": "PROPERTY_MANAGER",
            "pg_name": "Lake View PG",
            "city": "Hyderabad",
            "area": "Madhapur",
            "address": "Plot 14, Main Road, Madhapur, Hyderabad",
            "formatted_address": "Plot 14, Main Road, Madhapur, Hyderabad",
            "latitude": 17.4483,
            "longitude": 78.3915,
            "google_maps_url": (
                "https://www.google.com/maps/search/?api=1&query=17.4483,78.3915"
            ),
            "declaration_accepted": True,
        }
        payload.update(overrides)
        return payload

    def test_public_submission_stores_application_without_creating_owner(self) -> None:
        response = self.client.post(
            "/api/v1/owner-applications",
            json=self._payload(),
        )
        self.assertEqual(response.status_code, 201, response.text)
        result = response.json()
        self.assertTrue(result["application_reference"].startswith("FE-"))
        self.assertEqual(result["status"], "SUBMITTED")
        self.assertFalse(result["phone_verification_required"])
        self.assertGreaterEqual(len(result["status_access_key"]), 40)

        with self.session_factory() as db:
            application = db.query(OwnerApplication).one()
            self.assertEqual(application.applicant_name, "Asha Rao")
            self.assertEqual(application.applicant_phone, "+919876543210")
            self.assertIsNone(application.applicant_email)
            self.assertEqual(application.relationship_type, "PROPERTY_MANAGER")
            self.assertEqual(application.pg_name, "Lake View PG")
            self.assertEqual(application.city, "Hyderabad")
            self.assertEqual(application.area, "Madhapur")
            self.assertEqual(
                float(application.latitude),
                17.4483,
            )
            self.assertEqual(
                float(application.longitude),
                78.3915,
            )
            self.assertEqual(application.status, "SUBMITTED")
            self.assertFalse(application.phone_verified)
            self.assertNotEqual(
                application.status_access_hash,
                result["status_access_key"],
            )
            self.assertEqual(db.query(User).count(), 0)

    def test_status_requires_private_key_and_returns_no_applicant_data(self) -> None:
        created = self.client.post(
            "/api/v1/owner-applications",
            json=self._payload(
                relationship_type="AUTHORIZED_REPRESENTATIVE",
                applicant_email="asha@example.com",
                google_place_id="place-id-123",
            ),
        )
        self.assertEqual(created.status_code, 201, created.text)
        result = created.json()

        invalid = self.client.post(
            f"/api/v1/owner-applications/{result['application_reference']}/status",
            json={"status_access_key": "x" * 43},
        )
        self.assertEqual(invalid.status_code, 404)

        status_response = self.client.post(
            f"/api/v1/owner-applications/{result['application_reference'].lower()}/status",
            json={"status_access_key": result["status_access_key"]},
        )
        self.assertEqual(status_response.status_code, 200, status_response.text)
        response_body = status_response.json()
        self.assertEqual(response_body["status"], "SUBMITTED")
        self.assertIn("awaiting", response_body["message"])
        self.assertNotIn("applicant_name", response_body)
        self.assertNotIn("applicant_phone", response_body)
        self.assertNotIn("applicant_email", response_body)

    def test_duplicate_active_application_is_rejected(self) -> None:
        first = self.client.post(
            "/api/v1/owner-applications",
            json=self._payload(),
        )
        self.assertEqual(first.status_code, 201, first.text)

        duplicate = self.client.post(
            "/api/v1/owner-applications",
            json=self._payload(
                applicant_name="Different Name",
                pg_name="lake view pg",
                city="hyderabad",
                area="MADHAPUR",
                address="plot 14, main road, madhapur, hyderabad",
            ),
        )
        self.assertEqual(duplicate.status_code, 409, duplicate.text)
        with self.session_factory() as db:
            self.assertEqual(db.query(OwnerApplication).count(), 1)

    def test_required_fields_relationship_coordinates_and_declaration_validate(self) -> None:
        missing_required = self._payload()
        del missing_required["pg_name"]
        response = self.client.post(
            "/api/v1/owner-applications",
            json=missing_required,
        )
        self.assertEqual(response.status_code, 422)

        invalid_relationship = self.client.post(
            "/api/v1/owner-applications",
            json=self._payload(relationship_type="TENANT"),
        )
        self.assertEqual(invalid_relationship.status_code, 422)

        incomplete_coordinates = self.client.post(
            "/api/v1/owner-applications",
            json=self._payload(longitude=None),
        )
        self.assertEqual(incomplete_coordinates.status_code, 422)

        out_of_range_coordinates = self.client.post(
            "/api/v1/owner-applications",
            json=self._payload(latitude=91),
        )
        self.assertEqual(out_of_range_coordinates.status_code, 422)

        missing_declaration = self.client.post(
            "/api/v1/owner-applications",
            json=self._payload(declaration_accepted=False),
        )
        self.assertEqual(missing_declaration.status_code, 422)

        with self.session_factory() as db:
            self.assertEqual(db.query(OwnerApplication).count(), 0)

    def test_existing_user_and_owner_authentication_are_unchanged(self) -> None:
        with self.session_factory() as db:
            for role, phone in (
                ("SEEKER", "+919876543211"),
                ("OWNER", "+919876543212"),
            ):
                db.add(
                    User(
                        full_name=f"Existing {role}",
                        phone_number=phone,
                        phone=phone.removeprefix("+91"),
                        password_hash=hash_password("existing-password"),
                        user_role=role,
                        is_active=True,
                    )
                )
            db.commit()

        for role, phone in (
            ("SEEKER", "9876543211"),
            ("OWNER", "9876543212"),
        ):
            login = self.client.post(
                "/api/v1/auth/login",
                json={
                    "phone_number": phone,
                    "password": "existing-password",
                },
            )
            self.assertEqual(login.status_code, 200, login.text)
            self.assertEqual(login.json()["user"]["user_role"], role)


if __name__ == "__main__":
    unittest.main()
