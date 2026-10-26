
import argparse
import mimetypes
from pathlib import Path
from urllib.parse import quote

import boto3
from botocore.config import Config
from sqlalchemy import select

from app.core.config import settings
from app.db.database import SessionLocal
from app.models.listing_image import ListingImage


SERVER_DIR = Path(__file__).resolve().parent
LOCAL_PREFIX = "/uploads/listings/"


def public_url(key: str) -> str:
    endpoint = settings.AWS_ENDPOINT_URL_S3.rstrip("/")
    bucket = quote(settings.NEON_STORAGE_BUCKET, safe="")
    return f"{endpoint}/{bucket}/{quote(key, safe='/')}"


def main(apply_changes: bool) -> None:
    if apply_changes and not all((
        settings.AWS_ENDPOINT_URL_S3,
        settings.AWS_REGION,
        settings.AWS_ACCESS_KEY_ID,
        settings.AWS_SECRET_ACCESS_KEY,
        settings.NEON_STORAGE_BUCKET,
    )):
        raise RuntimeError("Neon Object Storage configuration is incomplete.")

    client = None
    if apply_changes:
        client = boto3.client(
            "s3",
            endpoint_url=settings.AWS_ENDPOINT_URL_S3,
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            config=Config(s3={"addressing_style": "path"}),
        )

    db = SessionLocal()
    migrated = 0
    already_remote = 0
    missing = 0
    failed = 0

    try:
        records = db.scalars(
            select(ListingImage).order_by(ListingImage.id)
        ).all()

        local_records = [
            record for record in records
            if (record.image_url or "").startswith(LOCAL_PREFIX)
        ]

        print(f"Total image records: {len(records)}")
        print(f"Local image records: {len(local_records)}")
        print(f"Mode: {'APPLY' if apply_changes else 'DRY RUN'}")
        print()

        for record in local_records:
            relative_path = record.image_url.lstrip("/").replace("/", "\\")
            file_path = SERVER_DIR / relative_path

            if not file_path.is_file():
                print(f"MISSING: {record.id} -> {file_path}")
                missing += 1
                continue

            # Preserve the original filename and listing-specific folder.
            filename = file_path.name
            key = f"hostels/{record.listing_id}/{filename}"
            url = public_url(key)

            if len(url) > 500:
                print(f"FAILED: URL exceeds database column limit: {record.id}")
                failed += 1
                continue

            print(f"{'UPLOAD' if apply_changes else 'WOULD UPLOAD'}: {record.id}")
            print(f"  File: {file_path}")
            print(f"  Key:  {key}")

            if not apply_changes:
                continue

            try:
                content_type, _ = mimetypes.guess_type(file_path.name)
                if content_type not in {
                    "image/jpeg", "image/png", "image/webp"
                }:
                    print("  FAILED: unsupported image file type")
                    failed += 1
                    continue

                with file_path.open("rb") as image_file:
                    client.put_object(
                        Bucket=settings.NEON_STORAGE_BUCKET,
                        Key=key,
                        Body=image_file,
                        ContentType=content_type,
                        CacheControl="public, max-age=31536000, immutable",
                    )

                # Update only after the object upload succeeds.
                record.image_url = url
                db.commit()
                migrated += 1
                print("  SUCCESS: uploaded and database URL updated")

            except Exception as error:
                db.rollback()
                failed += 1
                print(f"  FAILED: {type(error).__name__}: {error}")

        already_remote = sum(
            1 for record in records
            if (record.image_url or "").startswith("http://")
            or (record.image_url or "").startswith("https://")
        )

        print("\n--- SUMMARY ---")
        print(f"Local records inspected: {len(local_records)}")
        print(f"Migrated: {migrated}")
        print(f"Already remote: {already_remote}")
        print(f"Missing local files: {missing}")
        print(f"Failed: {failed}")

        if not apply_changes:
            print("\nDRY RUN ONLY. No uploads or database changes were made.")

    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Upload images and update local database URLs.",
    )
    args = parser.parse_args()
    main(apply_changes=args.apply)
