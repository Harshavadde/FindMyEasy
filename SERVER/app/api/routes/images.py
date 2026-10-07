from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.image import ImageResponse, ImageType
from app.services.image_service import save_listing_image_bytes


router = APIRouter(
    prefix="/api/v1/owner/listings",
    tags=["Owner - Images"],
)


@router.post(
    "/{listing_id}/images/raw",
    response_model=ImageResponse,
)
async def upload_listing_image_raw(
    listing_id: str,
    image_type: ImageType,
    request: Request,
    db: Session = Depends(get_db),
):
    content_type = (
        request.headers.get(
            "content-type",
            "image/jpeg",
        )
        .split(";")[0]
        .strip()
        .lower()
    )

    original_filename = request.headers.get(
        "x-file-name",
        "photo.jpg",
    )

    file_data = await request.body()

    print("========== IMAGE UPLOAD ==========")
    print("Listing:", listing_id)
    print("Type:", image_type.value)
    print("Content-Type:", content_type)
    print("Bytes:", len(file_data))
    print("Filename:", original_filename)
    print("===================================")

    return save_listing_image_bytes(
        db=db,
        listing_id=listing_id,
        image_type=image_type,
        file_data=file_data,
        content_type=content_type,
        original_filename=original_filename,
    )