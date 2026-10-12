
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.routes.auth import get_current_user
from app.db.database import get_db
from app.models.favorite import Favorite
from app.models.listing import Listing
from app.models.user import User

router = APIRouter(
    prefix="/api/v1/favorites",
    tags=["Favorites"],
)


@router.post("/{listing_id}", status_code=status.HTTP_201_CREATED)
def add_favorite(
    listing_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    listing = db.query(Listing).filter(
        Listing.id == listing_id
    ).first()

    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found.",
        )

    existing = db.query(Favorite).filter(
        Favorite.user_id == current_user.id,
        Favorite.listing_id == listing_id,
    ).first()

    if existing:
        return {
            "message": "Listing is already in favorites.",
            "listing_id": listing_id,
        }

    favorite = Favorite(
        user_id=current_user.id,
        listing_id=listing_id,
    )

    db.add(favorite)
    db.commit()

    return {
        "message": "Added to favorites.",
        "listing_id": listing_id,
    }


@router.delete("/{listing_id}")
def remove_favorite(
    listing_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    favorite = db.query(Favorite).filter(
        Favorite.user_id == current_user.id,
        Favorite.listing_id == listing_id,
    ).first()

    if not favorite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Favorite not found.",
        )

    db.delete(favorite)
    db.commit()

    return {"message": "Removed from favorites."}


@router.get("")
def get_favorites(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    favorites = (
        db.query(Favorite)
        .options(joinedload(Favorite.listing))
        .filter(Favorite.user_id == current_user.id)
        .order_by(Favorite.created_at.desc())
        .all()
    )

    return [
        {
            "listing_id": favorite.listing_id,
            "created_at": favorite.created_at,
            "listing": favorite.listing,
        }
        for favorite in favorites
        if favorite.listing is not None
    ]
