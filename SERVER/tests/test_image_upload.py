import unittest
from io import BytesIO
from unittest.mock import Mock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image

from app.api.routes.auth import get_current_user
from app.api.routes.images import router as images_router
from app.core.config import settings
from app.db.database import get_db
from app.models.hostel_member import HostelMember
from app.models.listing import Listing
from app.models.listing_sharing import ListingSharing
from app.models.user import User
from app.schemas.image import ImageType
from app.services.image_service import (
    create_listing_thumbnail,
    save_listing_image_bytes,
)


class ImageUploadTests(unittest.TestCase):
    def setUp(self) -> None:
        self.app = FastAPI()
        self.app.include_router(images_router)
        self.app.dependency_overrides[get_current_user] = lambda: User(
            id="test-owner",
            user_role="OWNER",
        )

        def unused_db():
            yield None

        self.app.dependency_overrides[get_db] = unused_db
        self.client = TestClient(self.app)

    def test_raw_upload_rejects_oversized_body_before_storage(self) -> None:
        with (
            patch.object(settings, "MAX_IMAGE_SIZE_MB", 1),
            patch(
                "app.api.routes.images.save_listing_image_bytes"
            ) as save_image,
        ):
            response = self.client.post(
                "/api/v1/owner/listings/test-listing/images/raw"
                "?image_type=PROPERTY",
                content=b"x" * (1024 * 1024 + 1),
                headers={"Content-Type": "image/jpeg"},
            )

        self.assertEqual(response.status_code, 413)
        save_image.assert_not_called()

    def test_listing_thumbnail_is_small_webp(self) -> None:
        image_buffer = BytesIO()
        Image.new("RGB", (1200, 900), "blue").save(
            image_buffer,
            format="PNG",
        )

        thumbnail_data = create_listing_thumbnail(image_buffer.getvalue())

        self.assertEqual(thumbnail_data[:4], b"RIFF")
        self.assertEqual(thumbnail_data[8:12], b"WEBP")
        with Image.open(BytesIO(thumbnail_data)) as thumbnail:
            self.assertEqual(thumbnail.size, (480, 360))

    def test_new_upload_stores_full_resolution_image_and_webp_thumbnail(self) -> None:
        image_buffer = BytesIO()
        Image.new("RGB", (1200, 900), "blue").save(
            image_buffer,
            format="PNG",
        )
        original_data = image_buffer.getvalue()
        storage_client = Mock()
        db = Mock()
        db.query.return_value.filter.return_value.first.return_value = object()

        with patch(
            "app.services.image_service.create_storage_client",
            return_value=(
                storage_client,
                "https://storage.example.test",
                "test-bucket",
            ),
        ):
            save_listing_image_bytes(
                db=db,
                listing_id="listing-1",
                image_type=ImageType.COVER,
                file_data=original_data,
                content_type="image/png",
                owner_id="owner-1",
                original_filename="property.png",
            )

        self.assertEqual(storage_client.put_object.call_count, 2)
        original_upload, thumbnail_upload = (
            call.kwargs for call in storage_client.put_object.call_args_list
        )
        self.assertEqual(original_upload["Body"], original_data)
        self.assertEqual(original_upload["ContentType"], "image/png")
        self.assertIn("CacheControl", original_upload)
        self.assertEqual(thumbnail_upload["ContentType"], "image/webp")
        self.assertTrue(thumbnail_upload["Key"].endswith("-thumbnail.webp"))
        with Image.open(BytesIO(thumbnail_upload["Body"])) as thumbnail:
            self.assertEqual(thumbnail.size, (480, 360))

        image_record = db.add.call_args.args[0]
        self.assertIn("/cover/", image_record.image_url)
        self.assertTrue(image_record.image_url.endswith(".png"))
        self.assertTrue(image_record.thumbnail_url.endswith("-thumbnail.webp"))


if __name__ == "__main__":
    unittest.main()
