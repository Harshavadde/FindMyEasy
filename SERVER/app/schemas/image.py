from enum import Enum

from pydantic import BaseModel


class ImageType(str, Enum):
    COVER = "COVER"
    PROPERTY = "PROPERTY"
    ROOM = "ROOM"
    BED = "BED"
    WASHROOM = "WASHROOM"
    MESS = "MESS"


class ImageResponse(BaseModel):
    id: str
    listing_id: str
    image_url: str
    image_type: ImageType
    original_filename: str | None = None

    class Config:
        from_attributes = True