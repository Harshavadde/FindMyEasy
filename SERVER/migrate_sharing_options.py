from sqlalchemy import text
from app.db.database import engine

migration_sql = [
    """
    ALTER TABLE listing_sharing
    ADD COLUMN IF NOT EXISTS ac_type VARCHAR(20)
    NOT NULL DEFAULT 'Non-AC'
    """,
    """
    ALTER TABLE listing_sharing
    ADD COLUMN IF NOT EXISTS floor VARCHAR(50)
    """
]

with engine.begin() as connection:
    for statement in migration_sql:
        connection.execute(text(statement))

print("Migration completed successfully.")
