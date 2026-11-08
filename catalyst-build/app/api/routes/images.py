from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_owner
from app.core.config import settings
from app.db.database import get_db
from app.models.user import User
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
    current_user: User = Depends(get_current_owner),
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

    max_bytes = settings.MAX_IMAGE_SIZE_MB * 1024 * 1024
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > max_bytes:
                raise HTTPException(
                    status_code=413,
                    detail=f"Image size cannot exceed {settings.MAX_IMAGE_SIZE_MB} MB.",
                )
        except ValueError as error:
            raise HTTPException(
                status_code=400,
                detail="Invalid image content length.",
            ) from error

    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"Image size cannot exceed {settings.MAX_IMAGE_SIZE_MB} MB.",
            )
        body.extend(chunk)
    file_data = bytes(body)

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
        owner_id=current_user.id,
    )