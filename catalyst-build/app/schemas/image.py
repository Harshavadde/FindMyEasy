from enum import Enum

from pydantic import BaseModel, ConfigDict


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
    thumbnail_url: str | None = None
    image_type: ImageType
    original_filename: str | None = None

    model_config = ConfigDict(from_attributes=True)