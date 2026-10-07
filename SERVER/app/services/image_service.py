import os
import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.listing import Listing
from app.models.listing_image import ListingImage
from app.schemas.image import ImageType


ALLOWED_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def validate_image_bytes(
    file_data: bytes,
    content_type: str,
) -> None:
    """
    Verify that the uploaded bytes actually represent
    the image type that the client says it is sending.
    """

    if not file_data:
        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty.",
        )

    # JPEG
    if content_type == "image/jpeg":
        if not file_data.startswith(b"\xff\xd8\xff"):
            raise HTTPException(
                status_code=400,
                detail="Invalid JPEG image data.",
            )

    # PNG
    elif content_type == "image/png":
        if not file_data.startswith(
            b"\x89PNG\r\n\x1a\n"
        ):
            raise HTTPException(
                status_code=400,
                detail="Invalid PNG image data.",
            )

    # WEBP
    elif content_type == "image/webp":
        if (
            len(file_data) < 12
            or file_data[0:4] != b"RIFF"
            or file_data[8:12] != b"WEBP"
        ):
            raise HTTPException(
                status_code=400,
                detail="Invalid WEBP image data.",
            )

    else:
        raise HTTPException(
            status_code=400,
            detail="Unsupported image type.",
        )


def save_listing_image_bytes(
    db: Session,
    listing_id: str,
    image_type: ImageType,
    file_data: bytes,
    content_type: str,
    original_filename: str = "photo.jpg",
):
    """
    Save raw image bytes received from the mobile app.

    This endpoint does NOT use:
    - FormData
    - multipart/form-data
    - UploadFile
    - FormDataPart
    """

    # Normalize content type
    content_type = (
        content_type
        .split(";")[0]
        .strip()
        .lower()
    )

    # Validate content type
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Only JPG, PNG and WEBP images "
                "are supported."
            ),
        )

    # Validate size
    max_size = (
        settings.MAX_IMAGE_SIZE_MB
        * 1024
        * 1024
    )

    if len(file_data) > max_size:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Image size cannot exceed "
                f"{settings.MAX_IMAGE_SIZE_MB} MB."
            ),
        )

    # Validate actual image bytes
    validate_image_bytes(
        file_data=file_data,
        content_type=content_type,
    )

    # Make sure listing exists
    listing = (
        db.query(Listing)
        .filter(
            Listing.id == listing_id
        )
        .first()
    )

    if listing is None:
        raise HTTPException(
            status_code=404,
            detail="Listing not found.",
        )

    # Get correct extension
    extension = ALLOWED_CONTENT_TYPES[
        content_type
    ]

    # Create listing upload directory
    listing_folder = os.path.join(
        settings.UPLOAD_DIR,
        "listings",
        listing_id,
    )

    os.makedirs(
        listing_folder,
        exist_ok=True,
    )

    # Generate unique filename
    filename = (
        f"{uuid.uuid4()}{extension}"
    )

    file_path = os.path.join(
        listing_folder,
        filename,
    )

    try:
        # Write actual image bytes
        with open(
            file_path,
            "wb",
        ) as image_file:
            image_file.write(file_data)

        # URL exposed by FastAPI StaticFiles
        image_url = (
            f"/uploads/listings/"
            f"{listing_id}/{filename}"
        )

        # Save database record
        image_record = ListingImage(
            listing_id=listing_id,
            image_url=image_url,
            image_type=image_type.value,
            original_filename=(
                original_filename
                or filename
            ),
        )

        db.add(image_record)
        db.commit()
        db.refresh(image_record)

        print("IMAGE SAVED SUCCESSFULLY")
        print("File:", file_path)
        print("URL:", image_url)
        print("DB ID:", image_record.id)

        return image_record

    except Exception as error:
        db.rollback()

        # Delete partially written file
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass

        print(
            "IMAGE SAVE FAILED:",
            error,
        )

        raise