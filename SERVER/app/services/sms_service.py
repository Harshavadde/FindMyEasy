import os
from urllib.parse import quote

import httpx

from app.core.config import settings


async def send_otp_sms(phone_number: str, otp: str) -> None:
    api_key = os.getenv("TWOFACTOR_API_KEY", settings.TWOFACTOR_API_KEY).strip()
    if not api_key:
        raise RuntimeError("TWOFACTOR_API_KEY must be configured to send SMS.")

    mobile_number = phone_number.removeprefix("+91")
    url = (
        f"https://2factor.in/API/V1/{quote(api_key, safe='')}/SMS/"
        f"{quote(mobile_number, safe='')}/{quote(otp, safe='')}/OTP1"
    )
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        result = response.json()

    if not isinstance(result, dict) or result.get("Status") != "Success":
        raise RuntimeError("The SMS provider did not accept the OTP request.")
