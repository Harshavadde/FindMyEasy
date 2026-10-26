import os
import csv
import argparse
from pathlib import Path
from urllib.parse import quote

import boto3
from dotenv import load_dotenv
from botocore.config import Config

BASE_DIR = Path(__file__).resolve().parent
CSV_PATH = BASE_DIR.parent / "production-images.csv"
IMAGE_DIR = BASE_DIR / "uploads" / "listings"
OUTPUT_CSV = BASE_DIR / "production-image-upload-map.csv"

load_dotenv(BASE_DIR / ".env")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--upload",
        action="store_true",
        help="Actually upload matching files. Without this flag, only preview."
    )
    args = parser.parse_args()

    endpoint = os.getenv("AWS_ENDPOINT_URL_S3", "").rstrip("/")
    region = os.getenv("AWS_REGION")
    bucket = os.getenv("NEON_STORAGE_BUCKET")
    access_key = os.getenv("AWS_ACCESS_KEY_ID")
    secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")

    missing = [
        name for name, value in {
            "AWS_ENDPOINT_URL_S3": endpoint,
            "AWS_REGION": region,
            "NEON_STORAGE_BUCKET": bucket,
            "AWS_ACCESS_KEY_ID": access_key,
            "AWS_SECRET_ACCESS_KEY": secret_key,
        }.items() if not value
    ]
    if missing:
        raise SystemExit("Missing storage configuration: " + ", ".join(missing))

    if not CSV_PATH.exists():
        raise SystemExit(f"Production CSV not found: {CSV_PATH}")

    with CSV_PATH.open(newline="", encoding="utf-8-sig") as f:
        records = list(csv.DictReader(f))

    required = {"id", "listing_id", "image_url", "original_filename", "image_type"}
    if not records or not required.issubset(records[0]):
        raise SystemExit("CSV must contain: " + ", ".join(sorted(required)))

    candidates = []
    missing_files = []
    for record in records:
        url = record["image_url"].strip()
        prefix = "/uploads/listings/"
        if not url.startswith(prefix):
            print(f"SKIP (not a local path): {record['id']}")
            continue

        relative = url.lstrip("/").replace("/", os.sep)
        path = BASE_DIR / relative
        if not path.is_file():
            missing_files.append((record["id"], url))
            print(f"MISSING: {url}")
            continue

        key = f"hostels/{record['listing_id']}/{Path(url).name}"
        public_url = f"{endpoint}/{quote(bucket)}/{quote(key, safe='/')}"
        candidates.append({
            **record,
            "local_path": str(path),
            "object_key": key,
            "new_image_url": public_url,
        })

    print(f"\nProduction records in CSV: {len(records)}")
    print(f"Local files ready: {len(candidates)}")
    print(f"Missing local files: {len(missing_files)}")
    print(f"Mode: {'UPLOAD' if args.upload else 'DRY RUN'}")

    if missing_files:
        print("Missing files will NOT be uploaded or changed.")

    if not args.upload:
        print("\nDry run only. No objects uploaded and no database changed.")
        print("Review the counts, then use --upload to upload matching files.")
        return

    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(signature_version="s3v4"),
    )

    uploaded = 0
    failed = 0
    results = []

    for item in candidates:
        key = item["object_key"]
        path = Path(item["local_path"])
        try:
            try:
                client.head_object(Bucket=bucket, Key=key)
                print(f"EXISTS, not overwritten: {key}")
            except Exception as exc:
                status = getattr(exc, "response", {}).get(
                    "ResponseMetadata", {}
                ).get("HTTPStatusCode")
                code = getattr(exc, "response", {}).get(
                    "Error", {}
                ).get("Code")
                if status != 404 and code not in ("404", "NoSuchKey", "NotFound"):
                    raise

                client.upload_file(
                    str(path),
                    bucket,
                    key,
                    ExtraArgs={
                        "ContentType": (
                            "image/png" if path.suffix.lower() == ".png"
                            else "image/jpeg"
                        ),
                        "CacheControl": "public, max-age=31536000, immutable",
                    },
                )
                client.head_object(Bucket=bucket, Key=key)
                uploaded += 1
                print(f"UPLOADED: {key}")

            results.append({
                "id": item["id"],
                "listing_id": item["listing_id"],
                "old_image_url": item["image_url"],
                "new_image_url": item["new_image_url"],
                "object_key": key,
                "status": "verified",
            })
        except Exception as exc:
            failed += 1
            print(f"FAILED: {key} ({type(exc).__name__})")

    if results:
        with OUTPUT_CSV.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(results[0].keys()))
            writer.writeheader()
            writer.writerows(results)

    print(f"\nNew uploads: {uploaded}")
    print(f"Verified objects (including pre-existing): {len(results)}")
    print(f"Failures: {failed}")
    print(f"Missing local images left untouched: {len(missing_files)}")
    if results:
        print(f"URL mapping saved to: {OUTPUT_CSV}")
    print("No database records were modified.")

if __name__ == "__main__":
    main()
