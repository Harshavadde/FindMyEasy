import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes.auth import get_current_user
from app.api.routes.images import router as images_router
from app.core.config import settings
from app.db.database import get_db
from app.models.user import User


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


if __name__ == "__main__":
    unittest.main()
