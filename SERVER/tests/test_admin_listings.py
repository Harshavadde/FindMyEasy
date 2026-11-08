import unittest
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.admin import router as admin_router
from app.api.routes.auth import router as auth_router
from app.core.config import settings
from app.core.security import hash_password
from app.db.database import Base, get_db
from app.models.hostel_member import HostelMember
from app.models.listing import Listing
from app.models.listing_image import ListingImage
from app.models.listing_sharing import ListingSharing
from app.models.user import User


class AdminListingsTests(unittest.TestCase):
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
            db.query(HostelMember).delete()
            db.query(ListingSharing).delete()
            db.query(ListingImage).delete()
            db.query(Listing).delete()
            db.query(User).delete()
            db.commit()

        self.app = FastAPI()
        self.app.include_router(auth_router)
        self.app.include_router(admin_router)

        def override_db():
            with self.session_factory() as db:
                yield db

        self.app.dependency_overrides[get_db] = override_db
        self.client = TestClient(self.app)
        self.admin_token = self._create_user_and_login("ADMIN", "9876543210")
        self.user_token = self._create_user_and_login("SEEKER", "9876543211")
        self.listing_id = self._create_listing()

    def tearDown(self) -> None:
        with self.session_factory() as db:
            db.query(HostelMember).delete()
            db.query(ListingSharing).delete()
            db.query(ListingImage).delete()
            db.query(Listing).delete()
            db.query(User).delete()
            db.commit()
        settings.JWT_SECRET_KEY = self.previous_secret

    def _create_user_and_login(self, role: str, phone: str) -> str:
        with self.session_factory() as db:
            db.add(
                User(
                    email=f"{role.lower()}-{phone}@example.com",
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

    def _create_listing(self) -> str:
        with self.session_factory() as db:
            owner = (
                db.query(User)
                .filter(User.user_role == "SEEKER")
                .one()
            )
            listing = Listing(
                owner_id=owner.id,
                owner_phone=owner.phone_number,
                name="Maple House",
                property_type="PG",
                gender="Co-living",
                description="A furnished property near transit.",
                monthly_price=12000,
                security_deposit=24000,
                total_beds=6,
                available_beds=3,
                filled_beds=3,
                ac_type="AC",
                facilities=["Wi-Fi", "Laundry"],
                food_available="Yes",
                food_type="Vegetarian",
                city="Hyderabad",
                area="Madhapur",
                address="Plot 14, Main Road",
                latitude="17.4483",
                longitude="78.3915",
                status="pending",
                created_at=datetime(2025, 1, 1, tzinfo=timezone.utc),
                updated_at=datetime(2025, 1, 1, tzinfo=timezone.utc),
            )
            db.add(listing)
            db.flush()
            db.add(
                ListingSharing(
                    listing_id=listing.id,
                    sharing_type="Double",
                    ac_type="AC",
                    floor="2",
                    monthly_price=12000,
                    total_beds=6,
                    available_beds=3,
                    filled_beds=3,
                )
            )
            db.add(
                ListingImage(
                    listing_id=listing.id,
                    image_url="https://images.example.test/maple.jpg",
                    thumbnail_url="https://images.example.test/maple-thumb.webp",
                    image_type="COVER",
                    original_filename="maple.jpg",
                    created_at=datetime(2025, 1, 2, tzinfo=timezone.utc),
                )
            )
            db.add(
                ListingImage(
                    listing_id=listing.id,
                    image_url="https://images.example.test/maple-room.jpg",
                    image_type="GALLERY",
                    original_filename="maple-room.jpg",
                    created_at=datetime(2025, 1, 1, tzinfo=timezone.utc),
                )
            )
            db.commit()
            return listing.id

    def test_listing_list_and_detail_return_review_data(self) -> None:
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        select_statements = []

        def capture_selects(connection, cursor, statement, parameters, context, many):
            if statement.lstrip().upper().startswith("SELECT"):
                select_statements.append(statement)

        event.listen(self.engine, "before_cursor_execute", capture_selects)
        try:
            listing_page = self.client.get(
                "/api/v1/admin/listings",
                params={
                    "sort_by": "created_at",
                    "sort_order": "desc",
                    "page": 1,
                    "page_size": 10,
                },
                headers=headers,
            )
        finally:
            event.remove(self.engine, "before_cursor_execute", capture_selects)
        self.assertEqual(listing_page.status_code, 200, listing_page.text)
        self.assertEqual(len(select_statements), 5)
        page = listing_page.json()
        self.assertEqual(page["total"], 1)
        self.assertEqual(page["cities"], ["Hyderabad"])
        self.assertEqual(page["total_listings"], 1)
        self.assertEqual(page["review_count"], 1)
        self.assertEqual(page["published_count"], 0)
        self.assertEqual(page["rejected_count"], 0)
        self.assertEqual(page["items"][0]["owner_name"], "Test SEEKER")
        self.assertEqual(page["items"][0]["name"], "Maple House")
        self.assertEqual(
            page["items"][0]["preview_image_url"],
            "https://images.example.test/maple-thumb.webp",
        )
        self.assertNotIn("images", page["items"][0])
        self.assertNotIn("sharing", page["items"][0])
        self.assertNotIn("address", page["items"][0])
        self.assertTrue(
            page["items"][0]["created_at"].startswith("2025-01-01T00:00:00")
        )
        detail = self.client.get(
            f"/api/v1/admin/listings/{self.listing_id}",
            headers=headers,
        )
        self.assertEqual(detail.status_code, 200, detail.text)
        result = detail.json()
        self.assertEqual(result["name"], "Maple House")
        self.assertEqual(result["images"][0]["image_url"], "https://images.example.test/maple.jpg")
        self.assertEqual(
            result["images"][0]["thumbnail_url"],
            "https://images.example.test/maple-thumb.webp",
        )
        self.assertEqual(result["address"], "Plot 14, Main Road")
        self.assertEqual(result["security_deposit"], 24000)
        self.assertEqual(result["food_type"], "Vegetarian")

    def test_listing_city_filter_and_postgresql_city_options_query(self) -> None:
        with self.session_factory() as db:
            db.add(
                Listing(
                    name="Cedar House",
                    property_type="PG",
                    gender="Co-living",
                    description=None,
                    monthly_price=10000,
                    security_deposit=0,
                    total_beds=1,
                    available_beds=1,
                    filled_beds=0,
                    ac_type="Non-AC",
                    facilities=[],
                    food_available="No",
                    city="Bengaluru",
                    area="Indiranagar",
                    address="Address 2",
                    status="published",
                    created_at=datetime(2025, 1, 2, tzinfo=timezone.utc),
                    updated_at=datetime(2025, 1, 2, tzinfo=timezone.utc),
                )
            )
            db.commit()

        with self.session_factory() as db:
            statement = (
                db.query(Listing.city)
                .distinct()
                .order_by(Listing.city)
                .statement
            )
        sql = str(statement.compile(dialect=postgresql.dialect()))
        self.assertIn(
            "SELECT DISTINCT listings.city FROM listings ORDER BY listings.city",
            " ".join(sql.split()),
        )
        self.assertNotIn("ORDER BY lower(listings.city)", " ".join(sql.split()))

        headers = {"Authorization": f"Bearer {self.admin_token}"}
        response = self.client.get(
            "/api/v1/admin/listings",
            params={
                "city": "hyderabad",
                "sort_by": "created_at",
                "sort_order": "desc",
                "page": 1,
                "page_size": 10,
            },
            headers=headers,
        )
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertEqual(result["cities"], ["Bengaluru", "Hyderabad"])
        self.assertEqual(result["total"], 1)
        self.assertEqual([item["name"] for item in result["items"]], ["Maple House"])
        self.assertEqual(result["total_listings"], 2)
        self.assertEqual(result["review_count"], 1)
        self.assertEqual(result["published_count"], 1)
        self.assertEqual(result["rejected_count"], 0)

    def test_existing_full_resolution_image_is_used_when_no_thumbnail_exists(
        self,
    ) -> None:
        with self.session_factory() as db:
            cover = (
                db.query(ListingImage)
                .filter(
                    ListingImage.listing_id == self.listing_id,
                    ListingImage.image_type == "COVER",
                )
                .one()
            )
            cover.thumbnail_url = None
            db.commit()

        headers = {"Authorization": f"Bearer {self.admin_token}"}
        page = self.client.get("/api/v1/admin/listings", headers=headers)
        self.assertEqual(page.status_code, 200, page.text)
        self.assertEqual(
            page.json()["items"][0]["preview_image_url"],
            "https://images.example.test/maple.jpg",
        )

        detail = self.client.get(
            f"/api/v1/admin/listings/{self.listing_id}",
            headers=headers,
        )
        self.assertEqual(detail.status_code, 200, detail.text)
        cover_image = next(
            image
            for image in detail.json()["images"]
            if image["image_type"] == "COVER"
        )
        self.assertEqual(
            cover_image["image_url"],
            "https://images.example.test/maple.jpg",
        )
        self.assertIsNone(cover_image["thumbnail_url"])

    def test_listing_page_sorts_created_at_descending_and_paginates_ten(self) -> None:
        with self.session_factory() as db:
            for day in range(2, 13):
                db.add(
                    Listing(
                        name=f"House {day}",
                        property_type="PG",
                        gender="Co-living",
                        description=None,
                        monthly_price=10000,
                        security_deposit=0,
                        total_beds=1,
                        available_beds=1,
                        filled_beds=0,
                        ac_type="Non-AC",
                        facilities=[],
                        food_available="No",
                        city="Hyderabad",
                        area="Madhapur",
                        address=f"Address {day}",
                        status="pending",
                        created_at=datetime(2025, 1, day, tzinfo=timezone.utc),
                        updated_at=datetime(2025, 1, day, tzinfo=timezone.utc),
                    )
                )
            db.commit()

        headers = {"Authorization": f"Bearer {self.admin_token}"}
        first_page = self.client.get(
            "/api/v1/admin/listings",
            params={
                "sort_by": "created_at",
                "sort_order": "desc",
                "page": 1,
                "page_size": 10,
            },
            headers=headers,
        )
        self.assertEqual(first_page.status_code, 200, first_page.text)
        first_result = first_page.json()
        self.assertEqual(first_result["total"], 12)
        self.assertEqual(first_result["page"], 1)
        self.assertEqual(first_result["page_size"], 10)
        self.assertEqual(first_result["total_pages"], 2)
        self.assertEqual(
            [item["name"] for item in first_result["items"]],
            [f"House {day}" for day in range(12, 2, -1)],
        )

        second_page = self.client.get(
            "/api/v1/admin/listings",
            params={
                "sort_by": "created_at",
                "sort_order": "desc",
                "page": 2,
                "page_size": 10,
            },
            headers=headers,
        )
        self.assertEqual(second_page.status_code, 200, second_page.text)
        self.assertEqual(
            [item["name"] for item in second_page.json()["items"]],
            ["House 2", "Maple House"],
        )

    def test_listing_page_returns_empty_items_for_no_matches(self) -> None:
        response = self.client.get(
            "/api/v1/admin/listings",
            params={
                "search": "no listing has this name",
                "sort_by": "created_at",
                "sort_order": "desc",
                "page": 1,
                "page_size": 10,
            },
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertEqual(result["items"], [])
        self.assertEqual(result["total"], 0)
        self.assertEqual(result["page"], 1)
        self.assertEqual(result["total_pages"], 1)

    def test_listing_decisions_require_admin_and_rejection_reason(self) -> None:
        path = f"/api/v1/admin/listings/{self.listing_id}/status"
        missing_reason = self.client.patch(
            path,
            json={"status": "rejected"},
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(missing_reason.status_code, 422)

        rejected = self.client.patch(
            path,
            json={
                "status": "rejected",
                "rejection_reason": "  Missing fire-safety details.  ",
            },
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(rejected.status_code, 200, rejected.text)
        self.assertEqual(rejected.json()["status"], "rejected")

        published = self.client.patch(
            path,
            json={"status": "published"},
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(published.status_code, 200, published.text)
        with self.session_factory() as db:
            listing = db.get(Listing, self.listing_id)
            self.assertEqual(listing.status, "published")
            self.assertIsNone(listing.rejection_reason)

        for method, url, json_body in (
            ("GET", "/api/v1/admin/listings", None),
            ("GET", f"/api/v1/admin/listings/{self.listing_id}", None),
            ("PATCH", path, {"status": "published"}),
        ):
            response = self.client.request(
                method,
                url,
                json=json_body,
                headers={"Authorization": f"Bearer {self.user_token}"},
            )
            self.assertEqual(response.status_code, 403, response.text)


if __name__ == "__main__":
    unittest.main()
