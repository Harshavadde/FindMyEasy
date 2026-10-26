
import os
import uuid
from urllib.parse import quote

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
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
    if not file_data:
        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty.",
        )

    if content_type == "image/jpeg":
        valid = file_data.startswith(b"\xff\xd8\xff")
    elif content_type == "image/png":
        valid = file_data.startswith(b"\x89PNG\r\n\x1a\n")
    elif content_type == "image/webp":
        valid = (
            len(file_data) >= 12
            and file_data[0:4] == b"RIFF"
            and file_data[8:12] == b"WEBP"
        )
    else:
        valid = False

    if not valid:
        raise HTTPException(
            status_code=400,
            detail="Image data does not match its content type.",
        )


def get_storage_config():
    endpoint = os.getenv("AWS_ENDPOINT_URL_S3", "").strip()
    bucket = os.getenv("NEON_STORAGE_BUCKET", "").strip()
    region = os.getenv("AWS_REGION", "").strip()
    access_key = os.getenv("AWS_ACCESS_KEY_ID", "").strip()
    secret_key = os.getenv("AWS_SECRET_ACCESS_KEY", "").strip()

    if not all((endpoint, bucket, region, access_key, secret_key)):
        raise HTTPException(
            status_code=503,
            detail="Object storage is not configured correctly.",
        )

    if not endpoint.startswith("https://"):
        raise HTTPException(
            status_code=503,
            detail="The object storage endpoint must use HTTPS.",
        )

    return endpoint.rstrip("/"), bucket, region, access_key, secret_key


def create_storage_client():
    endpoint, bucket, region, access_key, secret_key = (
        get_storage_config()
    )

    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
            connect_timeout=10,
            read_timeout=30,
            retries={"max_attempts": 2},
        ),
    )

    return client, endpoint, bucket


def save_listing_image_bytes(
    db: Session,
    listing_id: str,
    image_type: ImageType,
    file_data: bytes,
    content_type: str,
    owner_id: str,
    original_filename: str = "photo.jpg",
):
    content_type = (
        content_type.split(";")[0].strip().lower()
    )

    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only JPG, PNG and WEBP images are supported.",
        )

    max_size = settings.MAX_IMAGE_SIZE_MB * 1024 * 1024

    if len(file_data) > max_size:
        raise HTTPException(
            status_code=413,
            detail=(
                f"Image size cannot exceed "
                f"{settings.MAX_IMAGE_SIZE_MB} MB."
            ),
        )

    validate_image_bytes(file_data, content_type)

    listing = (
        db.query(Listing)
        .filter(
            Listing.id == listing_id,
            Listing.owner_id == owner_id,
        )
        .first()
    )

    if listing is None:
        raise HTTPException(
            status_code=404,
            detail="Listing not found.",
        )

    extension = ALLOWED_CONTENT_TYPES[content_type]
    safe_type = image_type.value.lower()
    object_key = (
        f"listings/{listing_id}/{safe_type}/{uuid.uuid4()}{extension}"
    )

    # Never trust a client-supplied path or filename.
    clean_filename = os.path.basename(
        (original_filename or "photo.jpg").replace("\\", "/")
    )[:255]

    client = None
    endpoint = ""
    bucket = ""
    uploaded = False

    try:
        client, endpoint, bucket = create_storage_client()

        # Upload the bytes before inserting the database row.
        client.put_object(
            Bucket=bucket,
            Key=object_key,
            Body=file_data,
            ContentType=content_type,
        )
        uploaded = True

        # This bucket must allow public reads for this URL format.
        image_url = (
            f"{endpoint}/{quote(bucket, safe='')}/"
            f"{quote(object_key, safe='/')}"
        )

        image_record = ListingImage(
            listing_id=listing_id,
            image_url=image_url,
            image_type=image_type.value,
            original_filename=clean_filename or "photo.jpg",
        )

        db.add(image_record)
        db.commit()
        db.refresh(image_record)

        print(
            "Listing image stored successfully:",
            image_record.id,
            object_key,
        )

        return image_record

    except HTTPException:
        db.rollback()
        raise

    except (BotoCoreError, ClientError) as error:
        db.rollback()
        print("Neon Object Storage upload failed:", repr(error))

        raise HTTPException(
            status_code=502,
            detail="Unable to upload the image to object storage.",
        ) from error

    except Exception as error:
        db.rollback()
        print("Listing image save failed:", repr(error))

        # Avoid leaving an orphaned object if the DB insert fails.
        if uploaded and client is not None:
            try:
                client.delete_object(
                    Bucket=bucket,
                    Key=object_key,
                )
            except Exception as cleanup_error:
                print(
                    "Object cleanup failed:",
                    repr(cleanup_error),
                )

        raise HTTPException(
            status_code=500,
            detail="Unable to save the listing image.",
        ) from error
