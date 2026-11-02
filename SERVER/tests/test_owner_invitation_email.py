import smtplib
import unittest
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from unittest.mock import MagicMock, patch

from app.core.config import settings
from app.services.owner_invitation_email import (
    send_owner_registration_invitation,
)


class OwnerInvitationEmailTests(unittest.TestCase):
    def setUp(self) -> None:
        self.previous_settings = (
            settings.OWNER_EMAIL_SMTP_HOST,
            settings.OWNER_EMAIL_SMTP_PORT,
            settings.OWNER_EMAIL_SMTP_USERNAME,
            settings.OWNER_EMAIL_SMTP_PASSWORD,
            settings.OWNER_EMAIL_FROM_ADDRESS,
            settings.OWNER_EMAIL_SMTP_USE_SSL,
        )
        settings.OWNER_EMAIL_SMTP_HOST = "smtp.example.test"
        settings.OWNER_EMAIL_SMTP_PORT = 587
        settings.OWNER_EMAIL_SMTP_USERNAME = "findeasy@example.test"
        settings.OWNER_EMAIL_SMTP_PASSWORD = "test-password"
        settings.OWNER_EMAIL_FROM_ADDRESS = "FindEasy <no-reply@example.test>"
        settings.OWNER_EMAIL_SMTP_USE_SSL = False

    def tearDown(self) -> None:
        (
            settings.OWNER_EMAIL_SMTP_HOST,
            settings.OWNER_EMAIL_SMTP_PORT,
            settings.OWNER_EMAIL_SMTP_USERNAME,
            settings.OWNER_EMAIL_SMTP_PASSWORD,
            settings.OWNER_EMAIL_FROM_ADDRESS,
            settings.OWNER_EMAIL_SMTP_USE_SSL,
        ) = self.previous_settings

    def _send(self) -> None:
        send_owner_registration_invitation(
            recipient="asha@example.test",
            applicant_name="Asha Rao",
            property_name="Asha Residency",
            invitation_url=(
                "https://api.findeasy.test/api/v1/owner-invitations/register"
                "#token=redacted-test-token"
            ),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=72),
        )

    def test_sends_html_and_plain_text_invitation_over_starttls(self) -> None:
        smtp_client = MagicMock()
        smtp_context = MagicMock()
        smtp_context.__enter__.return_value = smtp_client
        smtp_context.__exit__.return_value = False

        with patch(
            "app.services.owner_invitation_email.smtplib.SMTP",
            return_value=smtp_context,
        ) as smtp_factory:
            self._send()

        smtp_factory.assert_called_once_with(
            "smtp.example.test",
            587,
            timeout=15,
        )
        smtp_client.starttls.assert_called_once()
        smtp_client.login.assert_called_once_with(
            "findeasy@example.test",
            "test-password",
        )
        sent_message = smtp_client.send_message.call_args.args[0]
        self.assertIsInstance(sent_message, EmailMessage)
        self.assertEqual(sent_message["To"], "asha@example.test")
        self.assertIn("Asha Residency", sent_message.get_body(("plain",)).get_content())
        invitation_url = (
            "https://api.findeasy.test/api/v1/owner-invitations/register"
            "#token=redacted-test-token"
        )
        self.assertIn(invitation_url, sent_message.get_body(("plain",)).get_content())
        html_body = sent_message.get_body(("html",)).get_content()
        self.assertIn(f'href="{invitation_url}"', html_body)
        self.assertIn(">Create Owner account</a>", html_body)

    def test_missing_smtp_configuration_fails_explicitly(self) -> None:
        settings.OWNER_EMAIL_SMTP_HOST = ""

        with self.assertRaisesRegex(RuntimeError, "SMTP host is not configured"):
            self._send()

    def test_unpaired_smtp_credentials_fail_explicitly(self) -> None:
        settings.OWNER_EMAIL_SMTP_PASSWORD = ""

        with self.assertRaisesRegex(
            RuntimeError,
            "username and password must both be configured",
        ):
            self._send()

    def test_smtp_failure_is_not_swallowed(self) -> None:
        smtp_context = MagicMock()
        smtp_context.__enter__.side_effect = smtplib.SMTPException("rejected")

        with patch(
            "app.services.owner_invitation_email.smtplib.SMTP",
            return_value=smtp_context,
        ):
            with self.assertRaises(smtplib.SMTPException):
                self._send()


if __name__ == "__main__":
    unittest.main()
