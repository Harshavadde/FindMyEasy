import argparse

from sqlalchemy import text

from app.db.database import Base, engine

# Import all models before create_all so relationships and foreign tables are registered.
from app.models.favorite import Favorite  # noqa: F401
from app.models.hostel_member import HostelMember  # noqa: F401
from app.models.listing import Listing  # noqa: F401
from app.models.listing_image import ListingImage  # noqa: F401
from app.models.listing_sharing import ListingSharing  # noqa: F401
from app.models.user import User  # noqa: F401


def add_owner_relationship(connection) -> None:
    connection.execute(text(
        "ALTER TABLE listings "
        "ADD COLUMN IF NOT EXISTS owner_id VARCHAR(36)"
    ))
    connection.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_listings_owner_id "
        "ON listings (owner_id)"
    ))

    invalid_references = connection.execute(text("""
        SELECT COUNT(*)
        FROM listings AS listing
        LEFT JOIN users AS owner ON owner.id = listing.owner_id
        WHERE listing.owner_id IS NOT NULL
          AND owner.id IS NULL
    """)).scalar_one()
    if invalid_references:
        raise RuntimeError(
            "Owner relationship migration stopped: listings contain "
            "non-null owner IDs that do not reference users. Review those "
            "records before adding the foreign key."
        )

    connection.execute(text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'fk_listings_owner_id_users'
                  AND conrelid = 'listings'::regclass
            ) THEN
                ALTER TABLE listings
                    ADD CONSTRAINT fk_listings_owner_id_users
                    FOREIGN KEY (owner_id)
                    REFERENCES users (id)
                    ON DELETE SET NULL
                    NOT VALID;
            END IF;
        END
        $$;
    """))


def rollback_owner_relationship() -> None:
    if engine.dialect.name != "postgresql":
        raise RuntimeError(
            "Owner relationship rollback is supported only on PostgreSQL."
        )

    with engine.begin() as connection:
        connection.execute(text("""
            ALTER TABLE listings
            DROP CONSTRAINT IF EXISTS fk_listings_owner_id_users
        """))
        connection.execute(text(
            "DROP INDEX IF EXISTS ix_listings_owner_id"
        ))
        # Keep owner_id: dropping it could erase verified ownership assignments.


def migrate() -> None:
    Base.metadata.create_all(bind=engine)

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(10)"))

        if connection.dialect.name == "postgresql":
            add_owner_relationship(connection)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--rollback-owner-relationship",
        action="store_true",
        help=(
            "Remove the owner foreign key and index but preserve owner_id "
            "and all ownership data."
        ),
    )
    args = parser.parse_args()

    if args.rollback_owner_relationship:
        rollback_owner_relationship()
        print("Owner foreign key and index removed; owner_id data preserved.")
    else:
        migrate()
        print("Database migration completed.")
