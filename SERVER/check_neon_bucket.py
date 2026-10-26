import os
import boto3
from dotenv import load_dotenv
from botocore.config import Config

load_dotenv()

endpoint = os.getenv("AWS_ENDPOINT_URL_S3")
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
    print("Missing environment variables:", ", ".join(missing))
    raise SystemExit(1)

s3 = boto3.client(
    "s3",
    endpoint_url=endpoint,
    region_name=region,
    aws_access_key_id=access_key,
    aws_secret_access_key=secret_key,
    config=Config(signature_version="s3v4"),
)

print("Bucket:", bucket)
print("Checking objects (read-only)...")

count = 0
total_bytes = 0

try:
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket):
        for obj in page.get("Contents", []):
            count += 1
            total_bytes += obj["Size"]
            print(f'{count:3}. {obj["Key"]} ({obj["Size"]:,} bytes)')

    print("\nTotal objects:", count)
    print(f"Total size: {total_bytes / (1024 * 1024):.2f} MB")

except Exception as exc:
    print("Bucket listing failed:", type(exc).__name__)
    print("Check that the credentials have permission to list objects.")
    raise SystemExit(1)
