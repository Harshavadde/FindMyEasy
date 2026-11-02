import smtplib
import ssl
from datetime import datetime, timezone
from email.message import EmailMessage
from html import escape

from app.core.config import settings


def send_owner_registration_invitation(
    *,
    recipient: str,
    applicant_name: str,
    property_name: str,
    invitation_url: str,
    expires_at: datetime,
) -> None:
    if not settings.OWNER_EMAIL_SMTP_HOST:
        raise RuntimeError("Owner invitation email SMTP host is not configured.")
    if not settings.OWNER_EMAIL_FROM_ADDRESS:
        raise RuntimeError("Owner invitation sender address is not configured.")
    if bool(settings.OWNER_EMAIL_SMTP_USERNAME) != bool(
        settings.OWNER_EMAIL_SMTP_PASSWORD
    ):
        raise RuntimeError(
            "Owner invitation SMTP username and password must both be configured."
        )

    expiry_text = expires_at.astimezone(timezone.utc).strftime(
        "%d %b %Y, %I:%M %p UTC"
    )
    safe_name = escape(applicant_name)
    safe_property = escape(property_name)
    safe_url = escape(invitation_url, quote=True)
    message = EmailMessage()
    message["Subject"] = "Complete your FindEasy Owner registration"
    message["From"] = settings.OWNER_EMAIL_FROM_ADDRESS
    message["To"] = recipient
    message.set_content(
        f"""Hello {applicant_name},

Your FindEasy partnership application for {property_name} has been approved.
Use the secure link below to create your Owner account:

{invitation_url}

This link expires on {expiry_text} and can only be used once. If you did not
expect this invitation, you can ignore this email.

FindEasy
"""
    )
    message.add_alternative(
        f"""\
<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6">
    <h2 style="color: #2563eb">Welcome to FindEasy</h2>
    <p>Hello {safe_name},</p>
    <p>Your partnership application for <strong>{safe_property}</strong> has
    been approved. Use the secure link below to create your Owner account.</p>
    <p><a href="{safe_url}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Create Owner account</a></p>
    <p>This link expires on {escape(expiry_text)} and can only be used once.
    If you did not expect this invitation, you can ignore this email.</p>
    <p>FindEasy</p>
  </body>
</html>
""",
        subtype="html",
    )

    smtp_class = (
        smtplib.SMTP_SSL if settings.OWNER_EMAIL_SMTP_USE_SSL else smtplib.SMTP
    )
    with smtp_class(
        settings.OWNER_EMAIL_SMTP_HOST,
        settings.OWNER_EMAIL_SMTP_PORT,
        timeout=15,
        **(
            {"context": ssl.create_default_context()}
            if settings.OWNER_EMAIL_SMTP_USE_SSL
            else {}
        ),
    ) as smtp:
        if not settings.OWNER_EMAIL_SMTP_USE_SSL:
            smtp.starttls(context=ssl.create_default_context())
        if settings.OWNER_EMAIL_SMTP_USERNAME:
            smtp.login(
                settings.OWNER_EMAIL_SMTP_USERNAME,
                settings.OWNER_EMAIL_SMTP_PASSWORD,
            )
        smtp.send_message(message)
