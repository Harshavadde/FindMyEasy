import asyncio
import json
import unittest

from fastapi import FastAPI, HTTPException
from sqlalchemy import create_engine, event, inspect
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.routes.auth import (
    get_current_user,
    login,
    register,
)
from app.api.routes.listings import router as owner_listings_router
from app.api.routes.listings import (
    create_owner_listing,
    delete_owner_listing,
    get_owner_listing,
    get_owner_listings,
    update_owner_listing,
)
from app.api.routes.members import list_members
from app.api.routes.public_listings import get_public_listings
from app.api.routes.members import router as owner_members_router
from app.api.routes.public_listings import router as public_listings_router
from app.db.database import Base, get_db
from app.models.favorite import Favorite
from app.models.hostel_member import HostelMember
from app.models.listing import Listing
from app.models.listing_image import ListingImage
from app.models.listing_sharing import ListingSharing
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest
from app.schemas.listing import ListingCreate, ListingSharingCreate


class OwnerListingIsolationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(cls.engine, "connect")
        def enable_sqlite_foreign_keys(connection, _record) -> None:
            cursor = connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        Base.metadata.create_all(cls.engine)

    @classmethod
    def tearDownClass(cls) -> None:
        Base.metadata.drop_all(cls.engine)
        cls.engine.dispose()

    def setUp(self) -> None:
        self.db = Session(self.engine)
        self.owner_a, self.token_a = self._register_and_login(
            "owner-a@example.com"
        )
        self.owner_b, self.token_b = self._register_and_login(
            "owner-b@example.com"
        )

    def tearDown(self) -> None:
        self.db.rollback()
        self.db.query(Listing).delete()
        self.db.query(User).delete()
        self.db.commit()
        self.db.close()

    def test_registration_and_tokens_identify_distinct_owners(self) -> None:
        self.assertNotEqual(self.owner_a.id, self.owner_b.id)
        self.assertNotEqual(self.token_a, self.token_b)
        self.assertEqual(
            get_current_user(self.token_a, self.db).id,
            self.owner_a.id,
        )
        self.assertEqual(
            get_current_user(self.token_b, self.db).id,
            self.owner_b.id,
        )

    def test_listings_create_read_and_mutations_are_owner_scoped(self) -> None:
        self.assertEqual(get_owner_listings(self.db, self.owner_a), [])
        self.assertEqual(get_owner_listings(self.db, self.owner_b), [])

        listing = create_owner_listing(
            self._listing_data("Owner A property"),
            self.db,
            self.owner_a,
        )
        listing_id = listing.id
        saved_listing = self.db.query(Listing).filter_by(id=listing_id).one()
        self.assertEqual(saved_listing.owner_id, self.owner_a.id)

        owner_a_listings = get_owner_listings(self.db, self.owner_a)
        self.assertEqual([item.id for item in owner_a_listings], [listing_id])
        self.assertEqual(get_owner_listings(self.db, self.owner_b), [])
        self.assertEqual(owner_a_listings[0].total_beds, 3)
        self.assertEqual(owner_a_listings[0].available_beds, 2)

        with self.assertRaises(HTTPException) as detail_error:
            get_owner_listing(listing_id, self.db, self.owner_b)
        self.assertEqual(detail_error.exception.status_code, 404)

        with self.assertRaises(HTTPException) as update_error:
            update_owner_listing(
                listing_id,
                self._listing_data("Hijacked property"),
                self.db,
                self.owner_b,
            )
        self.assertEqual(update_error.exception.status_code, 404)

        with self.assertRaises(HTTPException) as delete_error:
            delete_owner_listing(listing_id, self.db, self.owner_b)
        self.assertEqual(delete_error.exception.status_code, 404)

        with self.assertRaises(HTTPException) as member_error:
            list_members(listing_id, self.db, self.owner_b)
        self.assertEqual(member_error.exception.status_code, 404)

        self.assertEqual(
            get_owner_listings(self.db, self.owner_a)[0].name,
            "Owner A property",
        )

    def test_http_authentication_and_owner_isolation(self) -> None:
        app = FastAPI()
        app.include_router(owner_listings_router)
        app.include_router(owner_members_router)
        app.include_router(public_listings_router)

        def override_get_db():
            yield self.db

        app.dependency_overrides[get_db] = override_get_db

        unauthenticated_status, _ = self._asgi_request(
            app,
            "GET",
            "/api/v1/owner/listings",
        )
        self.assertEqual(unauthenticated_status, 401)

        headers_a = {"Authorization": f"Bearer {self.token_a}"}
        headers_b = {"Authorization": f"Bearer {self.token_b}"}

        owner_a_initial_status, owner_a_initial = self._asgi_request(
            app,
            "GET",
            "/api/v1/owner/listings",
            headers=headers_a,
        )
        self.assertEqual(owner_a_initial_status, 200)
        self.assertEqual(owner_a_initial, [])

        created_status, created = self._asgi_request(
            app,
            "POST",
            "/api/v1/owner/listings",
            headers=headers_a,
            json_body={
                **self._listing_data(
                    "Owner A HTTP property"
                ).model_dump(mode="json"),
                "owner_id": self.owner_b.id,
            },
        )
        self.assertEqual(created_status, 200, created)
        listing_id = created["id"]
        self.assertEqual(
            self.db.query(Listing).filter_by(id=listing_id).one().owner_id,
            self.owner_a.id,
        )

        owner_a_status, owner_a_listings = self._asgi_request(
            app,
            "GET",
            "/api/v1/owner/listings",
            headers=headers_a,
        )
        self.assertEqual(owner_a_status, 200)
        self.assertEqual(len(owner_a_listings), 1)
        self.assertEqual(owner_a_listings[0]["available_beds"], 2)

        owner_b_status, owner_b_listings = self._asgi_request(
            app,
            "GET",
            "/api/v1/owner/listings",
            headers=headers_b,
        )
        self.assertEqual(owner_b_status, 200)
        self.assertEqual(owner_b_listings, [])

        cross_owner_statuses = [
            self._asgi_request(
                app,
                "GET",
                f"/api/v1/owner/listings/{listing_id}",
                headers=headers_b,
            )[0],
            self._asgi_request(
                app,
                "PUT",
                f"/api/v1/owner/listings/{listing_id}",
                headers=headers_b,
                json_body=self._listing_data("Hijacked property").model_dump(
                    mode="json"
                ),
            )[0],
            self._asgi_request(
                app,
                "DELETE",
                f"/api/v1/owner/listings/{listing_id}",
                headers=headers_b,
            )[0],
            self._asgi_request(
                app,
                "GET",
                f"/api/v1/owner/listings/{listing_id}/members",
                headers=headers_b,
            )[0],
        ]
        self.assertEqual(cross_owner_statuses, [404, 404, 404, 404])

        owner_a_after_b_status, owner_a_after_b = self._asgi_request(
            app,
            "GET",
            "/api/v1/owner/listings",
            headers=headers_a,
        )
        self.assertEqual(owner_a_after_b_status, 200)
        self.assertEqual(owner_a_after_b[0]["id"], listing_id)

        public_status, public_result = self._asgi_request(
            app,
            "GET",
            "/api/v1/listings",
        )
        self.assertEqual(public_status, 200)
        self.assertEqual(public_result["count"], 1)

    def test_invalid_bearer_token_is_unauthorized_over_http(self) -> None:
        app = FastAPI()
        app.include_router(owner_listings_router)

        def override_get_db():
            yield self.db

        app.dependency_overrides[get_db] = override_get_db

        status_code, _ = self._asgi_request(
            app,
            "GET",
            "/api/v1/owner/listings",
            headers={"Authorization": "Bearer not-a-valid-jwt"},
        )
        self.assertEqual(status_code, 401)

    def test_public_listing_search_remains_shared_between_owners(self) -> None:
        create_owner_listing(
            self._listing_data("Owner A property"),
            self.db,
            self.owner_a,
        )
        create_owner_listing(
            self._listing_data("Owner B property"),
            self.db,
            self.owner_b,
        )

        public_result = get_public_listings(
            city=None,
            area=None,
            property_type=None,
            gender=None,
            min_price=None,
            max_price=None,
            db=self.db,
        )
        self.assertEqual(public_result["count"], 2)

    def test_listing_owner_foreign_key_preserves_nullable_legacy_rows(self) -> None:
        owner_column = Listing.__table__.c.owner_id
        self.assertTrue(owner_column.nullable)
        self.assertTrue(
            any(
                foreign_key.target_fullname == "users.id"
                for foreign_key in owner_column.foreign_keys
            )
        )
        self.assertTrue(
            inspect(self.engine).get_foreign_keys("listings")
        )

        legacy_listing = Listing(
            owner_id=None,
            owner_phone="9876543210",
            name="Legacy unassigned property",
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
            address="2 Legacy Street",
        )
        self.db.add(legacy_listing)
        self.db.commit()

        saved_legacy_listing = (
            self.db.query(Listing)
            .filter_by(id=legacy_listing.id)
            .one()
        )
        self.assertIsNone(saved_legacy_listing.owner_id)
        self.assertEqual(saved_legacy_listing.name, "Legacy unassigned property")

    def _register_and_login(self, email: str) -> tuple[User, str]:
        registered = register(
            RegisterRequest(
                full_name=email.split("@")[0],
                email=email,
                password="test-password-123",
            ),
            self.db,
        )
        logged_in = login(
            LoginRequest(email=email, password="test-password-123"),
            self.db,
        )
        current_user = get_current_user(logged_in.access_token, self.db)

        self.assertEqual(registered.user.id, current_user.id)
        return current_user, logged_in.access_token

    @staticmethod
    def _listing_data(name: str) -> ListingCreate:
        return ListingCreate(
            owner_phone="9876543210",
            name=name,
            property_type="PG",
            gender="Co-living",
            sharing=[
                ListingSharingCreate(
                    sharing_type="Double",
                    monthly_price=9000,
                    total_beds=3,
                    available_beds=2,
                    filled_beds=1,
                )
            ],
            ac_type="Non-AC",
            facilities=[],
            city="Bengaluru",
            area="Indiranagar",
            address="1 Example Street",
        )

    @staticmethod
    def _asgi_request(
        app: FastAPI,
        method: str,
        path: str,
        headers: dict[str, str] | None = None,
        json_body: dict | None = None,
    ) -> tuple[int, dict | list | None]:
        request_body = (
            json.dumps(json_body).encode("utf-8")
            if json_body is not None
            else b""
        )
        request_headers = [
            (key.lower().encode("latin-1"), value.encode("latin-1"))
            for key, value in (headers or {}).items()
        ]
        if json_body is not None:
            request_headers.append((b"content-type", b"application/json"))
        response_messages = []
        request_sent = False

        async def receive():
            nonlocal request_sent
            if not request_sent:
                request_sent = True
                return {
                    "type": "http.request",
                    "body": request_body,
                    "more_body": False,
                }
            return {"type": "http.disconnect"}

        async def send(message):
            response_messages.append(message)

        scope = {
            "type": "http",
            "asgi": {"version": "3.0", "spec_version": "2.3"},
            "http_version": "1.1",
            "method": method,
            "scheme": "http",
            "path": path,
            "raw_path": path.encode("utf-8"),
            "root_path": "",
            "query_string": b"",
            "headers": request_headers,
            "client": ("testclient", 50000),
            "server": ("testserver", 80),
        }

        asyncio.run(app(scope, receive, send))

        start = next(
            message
            for message in response_messages
            if message["type"] == "http.response.start"
        )
        body = b"".join(
            message.get("body", b"")
            for message in response_messages
            if message["type"] == "http.response.body"
        )

        return start["status"], json.loads(body) if body else None


if __name__ == "__main__":
    unittest.main()
