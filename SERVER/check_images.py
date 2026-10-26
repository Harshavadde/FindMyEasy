from sqlalchemy import create_engine, text
from app.core.config import settings

engine = create_engine(settings.DATABASE_URL)

with engine.connect() as connection:
    rows = connection.execute(
        text("""
            SELECT id, listing_id, image_url, image_type
            FROM listing_images
            ORDER BY listing_id, id
        """)
    ).fetchall()

    for row in rows:
        print(
            f"ID={row.id} | LISTING={row.listing_id} "
            f"| TYPE={row.image_type} | URL={row.image_url}"
        )

engine.dispose()