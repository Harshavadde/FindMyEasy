from sqlalchemy.orm import Session

from app.models.admin_setup_state import AdminSetupState


ADMIN_BOOTSTRAP_LOCK_ID = 7_214_095_103
ADMIN_SETUP_KEY = "initial-admin"


def admin_setup_is_complete(db: Session) -> bool:
    return (
        db.query(AdminSetupState.setup_key)
        .filter(AdminSetupState.setup_key == ADMIN_SETUP_KEY)
        .first()
        is not None
    )


def mark_admin_setup_complete(db: Session, admin_user_id: str) -> None:
    db.add(
        AdminSetupState(
            setup_key=ADMIN_SETUP_KEY,
            admin_user_id=admin_user_id,
        )
    )
