from json import dumps
from urllib.parse import urlsplit

from fastapi.responses import HTMLResponse

from app.core.config import settings


_PAGE = r"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="referrer" content="no-referrer">
    <meta name="robots" content="noindex,nofollow">
    <title>FindEasy Owner registration</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; padding: 24px; background: #f8fafc; color: #0f172a; font: 16px/1.5 Arial, sans-serif; }
      main { width: 100%; max-width: 520px; margin: 6vh auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 20px; background: #fff; box-shadow: 0 12px 35px #0f172a12; }
      header { text-align: center; }
      .logo { display: grid; width: 48px; height: 48px; margin: auto; place-items: center; border-radius: 15px; background: #2563eb; color: white; font-size: 26px; font-weight: 800; }
      h1 { margin: 16px 0 6px; font-size: 25px; }
      .muted { color: #64748b; }
      #status { margin: 18px 0; padding: 12px; border-radius: 10px; background: #eff6ff; color: #1e3a8a; }
      #status.error { background: #fef2f2; color: #991b1b; }
      #status.success { background: #f0fdf4; color: #166534; }
      #details { display: none; margin: 18px 0; padding: 0 14px; border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc; }
      .detail { padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
      .detail:last-child { border-bottom: 0; }
      .detail strong { display: block; color: #64748b; font-size: 11px; letter-spacing: .04em; text-transform: uppercase; }
      label { display: block; margin-top: 16px; font-size: 14px; font-weight: 700; }
      input[type=password] { width: 100%; min-height: 48px; margin-top: 6px; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font: inherit; }
      .terms { display: flex; gap: 10px; align-items: flex-start; font-size: 14px; font-weight: 400; }
      button, .app-link { display: block; width: 100%; margin-top: 16px; padding: 14px; border: 0; border-radius: 10px; background: #2563eb; color: white; font: inherit; font-weight: 700; text-align: center; text-decoration: none; cursor: pointer; }
      button:disabled { opacity: .6; cursor: wait; }
      .app-link { display: none; background: #eff6ff; color: #1d4ed8; }
      @media (max-width: 480px) { body { padding: 14px; } main { margin: 2vh auto; padding: 22px; } }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div class="logo" aria-hidden="true">F</div>
        <p style="margin:8px 0 0;color:#2563eb;font-weight:800">FindEasy</p>
        <h1>Owner registration</h1>
        <p class="muted">Create your password for your approved FindEasy partnership.</p>
      </header>
      <a id="open-app" class="app-link">Open in FindEasy app</a>
      <p id="status" role="status">Checking your secure invitation…</p>
      <section id="details" aria-label="Approved application details">
        <div class="detail"><strong>Applicant</strong><span data-field="applicant_name"></span></div>
        <div class="detail"><strong>Mobile number</strong><span data-field="applicant_phone"></span></div>
        <div class="detail"><strong>Email address</strong><span data-field="applicant_email"></span></div>
        <div class="detail"><strong>PG / property</strong><span data-field="pg_name"></span></div>
        <div class="detail"><strong>City and locality</strong><span data-field="location"></span></div>
      </section>
      <form id="registration" style="display:none">
        <label for="password">Create password</label>
        <input id="password" name="password" type="password" minlength="8" maxlength="128" autocomplete="new-password" required>
        <label for="confirm-password">Confirm password</label>
        <input id="confirm-password" name="confirm-password" type="password" minlength="8" maxlength="128" autocomplete="new-password" required>
        <label class="terms"><input id="terms" type="checkbox" required> I accept the FindEasy Terms and Conditions.</label>
        <button id="submit" type="submit">Create Owner account</button>
      </form>
    </main>
    <script>
      (() => {
        const api = location.pathname.replace(/\/register\/?$/, "");
        const status = document.getElementById("status");
        const form = document.getElementById("registration");
        const details = document.getElementById("details");
        const submit = document.getElementById("submit");
        const appLink = document.getElementById("open-app");
        const token = new URLSearchParams(location.hash.slice(1)).get("token");

        history.replaceState(null, "", location.pathname);
        const setMessage = (message, kind) => {
          status.textContent = message;
          status.className = kind || "";
        };
        const appRegistrationUrl = __APP_REGISTRATION_URL__;
        const appScheme = __APP_SCHEME__;
        const appUrl = appRegistrationUrl
          + (appRegistrationUrl.includes("?") ? "&" : "?")
          + "token=" + encodeURIComponent(token || "");
        appLink.href = appUrl;
        if (token) appLink.style.display = "block";

        const request = async (path, body) => {
          const response = await fetch(api + path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            cache: "no-store",
            credentials: "omit"
          });
          let result;
          try {
            result = await response.json();
          } catch {
            throw new Error("FindEasy could not validate the invitation. Try again later.");
          }
          if (!response.ok) {
            const detail = result.detail;
            throw new Error(
              typeof detail === "string"
                ? detail
                : "This registration link is invalid or incomplete."
            );
          }
          return result;
        };

        const showValidationError = (message) => {
          form.style.display = "none";
          details.style.display = "none";
          setMessage(message, "error");
        };

        (async () => {
          if (!token) {
            showValidationError("This registration link is invalid or incomplete.");
            return;
          }
          try {
            const result = await request("/validate", { token });
            if (!result.valid) {
              showValidationError(result.message || "This registration link is no longer valid.");
              return;
            }
            const values = {
              ...result,
              location: [result.area, result.city].filter(Boolean).join(", ")
            };
            for (const [field, value] of Object.entries(values)) {
              const element = document.querySelector('[data-field="' + field + '"]');
              if (element) element.textContent = value || "Not provided";
            }
            details.style.display = "block";
            form.style.display = "block";
            setMessage("Your invitation is valid. Create a password to activate your Owner account.");
            if (/android|iphone|ipad|ipod/i.test(navigator.userAgent)) {
              window.location.href = appUrl;
              window.setTimeout(() => {
                if (!document.hidden) {
                  setMessage("If FindEasy did not open, you can finish registration in this browser.");
                }
              }, 1200);
            }
          } catch (error) {
            showValidationError(error instanceof Error ? error.message : "Unable to validate this invitation.");
          }
        })();

        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const password = document.getElementById("password").value;
          const confirmation = document.getElementById("confirm-password").value;
          if (password.length < 8 || password.length > 128 || !password.trim()) {
            setMessage("Choose a password between 8 and 128 characters.", "error");
            return;
          }
          if (password !== confirmation) {
            setMessage("The passwords do not match.", "error");
            return;
          }
          if (!document.getElementById("terms").checked) {
            setMessage("Accept the Terms and Conditions to continue.", "error");
            return;
          }
          submit.disabled = true;
          try {
            await request("/register", { token, password, terms_accepted: true });
            form.style.display = "none";
            details.style.display = "none";
            setMessage("Your Owner account is ready. Open FindEasy and sign in using Owner Login.", "success");
            appLink.href = appScheme + "://login/owner";
            appLink.textContent = "Continue to Owner Login";
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Unable to create your Owner account.", "error");
            submit.disabled = false;
          }
        });
      })();
    </script>
  </body>
</html>
"""


def owner_registration_fallback_page() -> HTMLResponse:
    app_registration_url = settings.OWNER_REGISTRATION_BASE_URL.split("#", 1)[0]
    app_scheme = urlsplit(app_registration_url).scheme or "findeasy"
    page = _PAGE.replace(
        "__APP_REGISTRATION_URL__",
        dumps(app_registration_url),
    ).replace("__APP_SCHEME__", dumps(app_scheme))
    return HTMLResponse(
        content=page,
        headers={
            "Cache-Control": "no-store, max-age=0",
            "Pragma": "no-cache",
            "Referrer-Policy": "no-referrer",
            "X-Content-Type-Options": "nosniff",
            "X-Robots-Tag": "noindex, nofollow",
        },
    )
