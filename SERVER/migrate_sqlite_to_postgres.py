
import json
import sqlite3
from datetime import date, datetime, timezone
from pathlib import Path

from sqlalchemy import (
    Date,
    DateTime,
    JSON,
    create_engine,
    select,
    func,
)

from app.core.config import settings
from app.db.database import Base

# Import models so SQLAlchemy registers all tables.
from app.models.listing import Listing
from app.models.listing_sharing import ListingSharing
from app.models.listing_image import ListingImage
from app.models.hostel_member import HostelMember


SERVER_DIR = Path(__file__).resolve().parent
SQLITE_PATH = SERVER_DIR / "findeasy.db"

TABLE_ORDER = [
    "listings",
    "listing_sharing",
    "listing_images",
    "hostel_members",
]


def convert_value(value, column):
    """Convert SQLite values to compatible PostgreSQL values."""
    if value is None:
        return None

    column_type = column.type

    if isinstance(column_type, JSON):
        if isinstance(value, str):
            return json.loads(value)
        return value

    if isinstance(column_type, DateTime):
        if isinstance(value, str):
            value = datetime.fromisoformat(
                value.replace("Z", "+00:00")
            )

        if column_type.timezone and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)

        if not column_type.timezone and value.tzinfo is not None:
            value = value.replace(tzinfo=None)

        return value

    if isinstance(column_type, Date):
        if isinstance(value, str):
            return date.fromisoformat(value[:10])
        return value

    return value


def main():
    if not SQLITE_PATH.exists():
        raise FileNotFoundError(
            f"SQLite database not found: {SQLITE_PATH}"
        )

    if settings.DATABASE_URL.startswith("sqlite"):
        raise RuntimeError(
            "DATABASE_URL is still SQLite. "
            "Update SERVER/.env to use PostgreSQL first."
        )

    target_engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
    )

    try:
        # 1. Verify PostgreSQL connectivity.
        with target_engine.connect() as conn:
            version = conn.execute(
                select(func.version())
            ).scalar()

            print("Connected to:", version)

        # 2. Register models and create missing PostgreSQL tables.
        Base.metadata.create_all(bind=target_engine)

        target_tables = {
            table.name: table
            for table in Base.metadata.sorted_tables
        }

        missing_models = set(TABLE_ORDER) - set(target_tables)

        if missing_models:
            raise RuntimeError(
                f"Models not registered: {sorted(missing_models)}"
            )

        # 3. Require all destination tables to be empty.
        with target_engine.connect() as conn:
            for name in TABLE_ORDER:
                count = conn.execute(
                    select(func.count()).select_from(
                        target_tables[name]
                    )
                ).scalar_one()

                if count != 0:
                    raise RuntimeError(
                        f"PostgreSQL table {name!r} already has "
                        f"{count} rows. Migration stopped without "
                        "inserting additional records."
                    )

        # 4. Read SQLite data in read-only mode.
        with sqlite3.connect(
            f"file:{SQLITE_PATH.as_posix()}?mode=ro",
            uri=True,
        ) as source:
            source.row_factory = sqlite3.Row

            source_tables = {
                row[0]
                for row in source.execute("""
                    SELECT name
                    FROM sqlite_master
                    WHERE type = 'table'
                """)
            }

            missing_source = set(TABLE_ORDER) - source_tables

            if missing_source:
                raise RuntimeError(
                    "SQLite is missing tables: "
                    f"{sorted(missing_source)}"
                )

            # Load all records BEFORE modifying the migration copy.
            source_rows = {}

            for name in TABLE_ORDER:
                source_rows[name] = [
                    dict(row)
                    for row in source.execute(
                        f'SELECT * FROM "{name}"'
                    )
                ]

        # 5. Repair the known orphaned member reference
        # in memory only. The SQLite file is never modified.
        member_id = "3afc5f1b-b62e-4101-beb1-8dc3ae798dd6"
        old_sharing_id = "cbed9029-a3c4-4703-a42f-7c91a09e478c"
        replacement_sharing_id = "15e08672-5b63-4172-9acf-5e357e39efd4"

        member_rows = source_rows["hostel_members"]
        sharing_rows = source_rows["listing_sharing"]

        member = next(
            (
                row for row in member_rows
                if row["id"] == member_id
            ),
            None,
        )

        if member and member["sharing_id"] == old_sharing_id:
            replacement = next(
                (
                    row for row in sharing_rows
                    if row["id"] == replacement_sharing_id
                ),
                None,
            )

            if replacement is None:
                raise RuntimeError(
                    "Replacement sharing record not found."
                )

            if member["listing_id"] != replacement["listing_id"]:
                raise RuntimeError(
                    "Member and replacement sharing belong "
                    "to different listings."
                )

            if str(replacement["sharing_type"]) != "2":
                raise RuntimeError(
                    "Replacement sharing type does not match."
                )

            # IMPORTANT:
            # Do this only if you have confirmed that Vamsi
            # belongs to this 2-sharing group.
            member["sharing_id"] = replacement_sharing_id

            print(
                "Migration copy: repaired Vamsi's sharing reference."
            )

        # 6. Display source counts.
        expected = {
            name: len(source_rows[name])
            for name in TABLE_ORDER
        }

        print("\nSQLite source row counts:")

        for name, count in expected.items():
            print(f"  {name}: {count}")

        # 7. Copy all records in one PostgreSQL transaction.
        # Any insert failure rolls back the entire copy.
        with target_engine.begin() as conn:
            for name in TABLE_ORDER:
                table = target_tables[name]
                rows = source_rows[name]

                if not rows:
                    continue

                target_columns = {
                    column.name: column
                    for column in table.columns
                }

                source_columns = set(rows[0].keys())

                common_columns = (
                    source_columns & set(target_columns)
                )

                missing_required = [
                    column.name
                    for column in table.columns
                    if column.name not in source_columns
                    and not column.nullable
                    and column.default is None
                    and column.server_default is None
                    and not column.primary_key
                    and not getattr(column, "identity", None)
                ]

                if missing_required:
                    raise RuntimeError(
                        f"{name}: source lacks required columns "
                        f"{missing_required}."
                    )

                converted_rows = []

                for row in rows:
                    converted = {
                        key: convert_value(
                            row[key],
                            target_columns[key],
                        )
                        for key in common_columns
                    }

                    converted_rows.append(converted)

                conn.execute(
                    table.insert(),
                    converted_rows,
                )

                print(
                    f"Copied {len(rows)} rows into {name}"
                )

        # 8. Verify committed PostgreSQL row counts.
        print("\nPostgreSQL verification:")

        with target_engine.connect() as conn:
            for name in TABLE_ORDER:
                count = conn.execute(
                    select(func.count()).select_from(
                        target_tables[name]
                    )
                ).scalar_one()

                print(f"  {name}: {count}")

                if count != expected[name]:
                    raise RuntimeError(
                        f"Count mismatch for {name}: "
                        f"expected {expected[name]}, got {count}"
                    )

            # Verify that no hostel member has an invalid
            # listing or sharing reference.
            members = target_tables["hostel_members"]
            sharing = target_tables["listing_sharing"]

            orphan_count = conn.execute(
                select(func.count())
                .select_from(members)
                .outerjoin(
                    sharing,
                    members.c.sharing_id == sharing.c.id,
                )
                .where(sharing.c.id.is_(None))
            ).scalar_one()

            if orphan_count:
                raise RuntimeError(
                    f"Found {orphan_count} members with missing "
                    "sharing references."
                )

        print("\nMigration completed and row counts match.")
        print("Foreign-key reference check passed.")

    finally:
        target_engine.dispose()


if __name__ == "__main__":
    main()
