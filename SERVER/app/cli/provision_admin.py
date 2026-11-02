import argparse
import getpass
import sys

from sqlalchemy import or_, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from app.core.admin_setup import (
    ADMIN_BOOTSTRAP_LOCK_ID,
    admin_setup_is_complete,
    mark_admin_setup_complete,
)
from app.core.security import hash_password
from app.db.database import SessionLocal
from app.models.user import User
from app.schemas.auth import normalize_phone_number


class ProvisioningError(Exception):
    pass


def _phone_filter(phone_number: str) -> ColumnElement[bool]:
    national_number = phone_number.removeprefix("+91")
    return or_(
        User.phone_number == phone_number,
        User.phone_number == national_number,
        User.phone == national_number,
    )


def _validate_target(
    db: Session,
    *,
    mode: str,
    phone_number: str,
) -> tuple[str, User | None]:
    if mode not in {"create", "promote"}:
        raise ProvisioningError("Choose either create or promote mode.")
    if (
        db.query(User.id).filter(User.user_role == "ADMIN").first()
        or admin_setup_is_complete(db)
    ):
        raise ProvisioningError(
            "An Admin already exists or first-admin setup has been completed; provisioning is disabled."
        )

    normalized_phone = normalize_phone_number(phone_number)
    matches = (
        db.query(User)
        .filter(_phone_filter(normalized_phone))
        .limit(2)
        .all()
    )
    if len(matches) > 1:
        raise ProvisioningError(
            "The mobile number matches multiple accounts; resolve the duplicate records first."
        )
    account = matches[0] if matches else None

    if mode == "promote":
        if account is None:
            raise ProvisioningError(
                "No account is registered with that mobile number."
            )
        if not account.is_active:
            raise ProvisioningError(
                "That account is disabled and cannot be promoted."
            )
        if not isinstance(account.password_hash, str) or not account.password_hash:
            raise ProvisioningError(
                "That account has no password and cannot sign in; use a trusted account with an active password."
            )
        if account.user_role == "ADMIN":
            raise ProvisioningError("That account is already an Admin.")
    elif account is not None:
        raise ProvisioningError(
            "An account already uses that mobile number; use promote mode instead."
        )

    return normalized_phone, account


def provision_first_admin(
    db: Session,
    *,
    mode: str,
    phone_number: str,
    full_name: str | None = None,
    password: str | None = None,
) -> User:
    if mode not in {"create", "promote"}:
        raise ProvisioningError("Choose either create or promote mode.")

    try:
        normalized_phone, account = _validate_target(
            db,
            mode=mode,
            phone_number=phone_number,
        )

        if mode == "promote":
            assert account is not None
            account.user_role = "ADMIN"
            db.flush()
            mark_admin_setup_complete(db, account.id)
            return account

        if not full_name or not full_name.strip():
            raise ProvisioningError("A full name is required when creating an account.")
        if password is None or not 8 <= len(password) <= 128:
            raise ProvisioningError(
                "The password must contain between 8 and 128 characters."
            )

        account = User(
            full_name=full_name.strip(),
            phone=normalized_phone.removeprefix("+91"),
            phone_number=normalized_phone,
            password_hash=hash_password(password),
            user_role="ADMIN",
            is_active=True,
            is_phone_verified=False,
        )
        db.add(account)
        db.flush()
        mark_admin_setup_complete(db, account.id)
        return account
    except ProvisioningError:
        raise
    except IntegrityError as error:
        db.rollback()
        raise ProvisioningError(
            "The account could not be provisioned because a matching account already exists."
        ) from error
    except SQLAlchemyError as error:
        db.rollback()
        raise ProvisioningError(
            "The database operation failed; no account changes were committed."
        ) from error


def _confirm(action: str) -> bool:
    response = input(f"Type {action} to continue: ").strip()
    return response == action


def run(mode: str) -> int:
    if not sys.stdin.isatty():
        print(
            "Run this command in an interactive PowerShell terminal so credentials "
            "can be entered securely.",
            file=sys.stderr,
        )
        return 2

    try:
        entered_phone = input("Registered Indian mobile number: ").strip()
        full_name = None
        password = None

        if mode == "create":
            full_name = input("Admin full name: ").strip()
            password = getpass.getpass("New Admin password (input hidden): ")
            confirmation = getpass.getpass("Confirm Admin password: ")
            if password != confirmation:
                raise ProvisioningError("The password entries do not match.")

        with SessionLocal() as db:
            try:
                db.execute(
                    text("SELECT pg_advisory_xact_lock(:lock_id)"),
                    {"lock_id": ADMIN_BOOTSTRAP_LOCK_ID},
                )
                phone_number, target = _validate_target(
                    db,
                    mode=mode,
                    phone_number=entered_phone,
                )
                if mode == "promote":
                    assert target is not None
                    display_name = target.full_name or "Unnamed account"
                    last_four = phone_number[-4:]
                    print(
                        f"Account selected: {display_name} "
                        f"(mobile ending {last_four}; role {target.user_role})."
                    )

                if not _confirm("CREATE" if mode == "create" else "PROMOTE"):
                    db.rollback()
                    print("Cancelled; no changes were made.")
                    return 1

                account = provision_first_admin(
                    db,
                    mode=mode,
                    phone_number=phone_number,
                    full_name=full_name,
                    password=password,
                )
                db.commit()
            except (ProvisioningError, SQLAlchemyError):
                db.rollback()
                raise

        operation = "created" if mode == "create" else "promoted"
        print(f"Admin account {operation} successfully.")
        print("Sign in at http://localhost:3000/login?role=admin")
        return 0
    except ProvisioningError as error:
        print(str(error), file=sys.stderr)
        return 1
    except ValueError as error:
        print(str(error), file=sys.stderr)
        return 1
    except SQLAlchemyError:
        print(
            "Unable to access PostgreSQL; no account changes were committed.",
            file=sys.stderr,
        )
        return 1
    finally:
        password = None


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Securely create the first FindEasy Admin account or promote an "
            "existing account. This command is disabled once an Admin exists."
        )
    )
    modes = parser.add_subparsers(dest="mode", required=True)
    modes.add_parser("create", help="Create a new Admin account.")
    modes.add_parser("promote", help="Promote an existing account by mobile number.")
    arguments = parser.parse_args()
    return run(arguments.mode)


if __name__ == "__main__":
    raise SystemExit(main())
