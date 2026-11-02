"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createInitialAdmin,
  getAdminSetupStatus,
} from "@/services/api";

function passwordScore(password: string): number {
  return [
    password.length >= 8,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
}

const strengthNames = ["Enter a password", "Weak", "Fair", "Good", "Strong"];

type SetupStatus = "loading" | "available" | "unavailable" | "error";

export default function AdminSetupPage() {
  const router = useRouter();
  const [setupStatus, setSetupStatus] = useState<SetupStatus>("loading");
  const [statusError, setStatusError] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const checkSetupStatus = useCallback(async () => {
    setSetupStatus("loading");
    setStatusError("");
    try {
      const { available } = await getAdminSetupStatus();
      setSetupStatus(available ? "available" : "unavailable");
    } catch (requestError) {
      setStatusError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to check setup availability."
      );
      setSetupStatus("error");
    }
  }, []);

  useEffect(() => {
    void checkSetupStatus();
  }, [checkSetupStatus]);

  useEffect(() => {
    if (setupStatus !== "unavailable") return;
    const redirectTimer = window.setTimeout(
      () => router.replace("/login?role=admin"),
      3500
    );
    return () => window.clearTimeout(redirectTimer);
  }, [router, setupStatus]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (phone.length !== 10 || !/^[6-9]\d{9}$/.test(phone)) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (passwordScore(password) < 2) {
      setError("Choose a stronger password with at least 8 characters.");
      return;
    }

    setBusy(true);
    try {
      const result = await createInitialAdmin({
        full_name: fullName.trim(),
        phone_number: `+91${phone}`,
        ...(email.trim() ? { email: email.trim() } : {}),
        password,
        setup_token: setupToken.trim(),
      });
      setSuccess(result.message);
      setSetupToken("");
      window.setTimeout(() => router.replace("/login?role=admin"), 1400);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create the Admin account. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  const score = passwordScore(password);

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-[520px] rounded-3xl border border-line bg-white p-8 shadow-card sm:p-10">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-xl font-black text-white">
            F
          </div>
          <div>
            <p className="font-extrabold text-ink">FindEasy</p>
            <p className="text-xs font-semibold tracking-widest text-muted">
              ADMIN CONSOLE
            </p>
          </div>
        </div>

        <p className="text-sm font-bold text-brand">Secure one-time setup</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          Create the first Admin
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          This setup is available only while no Admin account exists. You will
          also need the one-time setup key configured on the backend.
        </p>

        {setupStatus === "loading" && (
          <div
            className="mt-7 rounded-xl bg-slate-50 px-4 py-4 text-sm text-muted"
            role="status"
          >
            Checking setup availability...
          </div>
        )}

        {setupStatus === "error" && (
          <div
            className="mt-7 rounded-xl border border-red-100 bg-red-50 px-4 py-4"
            role="alert"
          >
            <p className="text-sm leading-6 text-red-700">{statusError}</p>
            <button
              className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
              onClick={() => void checkSetupStatus()}
              type="button"
            >
              Retry
            </button>
          </div>
        )}

        {setupStatus === "unavailable" && (
          <div
            className="mt-7 rounded-xl bg-slate-50 px-4 py-4 text-sm leading-6 text-muted"
            role="status"
          >
            Initial setup is disabled or has already been completed. Redirecting
            to Admin sign in.
            <a
              className="ml-1 font-bold text-brand hover:underline"
              href="/login?role=admin"
            >
              Go to Admin sign in now
            </a>
          </div>
        )}

        {setupStatus === "available" && !success && (
          <form className="mt-7 space-y-4" onSubmit={submit}>
            <label className="block text-sm font-bold text-ink">
              Full name
              <input
                autoComplete="name"
                className="mt-2 h-12 w-full rounded-xl border border-line px-3 outline-none focus:border-brand"
                maxLength={150}
                onChange={(event) => setFullName(event.target.value)}
                required
                value={fullName}
              />
            </label>

            <label className="block text-sm font-bold text-ink">
              Mobile number
              <div className="mt-2 flex h-12 items-center rounded-xl border border-line px-3 focus-within:border-brand">
                <span className="mr-2 text-sm font-bold text-muted">+91</span>
                <input
                  autoComplete="tel-national"
                  className="h-full min-w-0 flex-1 outline-none"
                  inputMode="numeric"
                  maxLength={10}
                  onChange={(event) =>
                    setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  placeholder="10-digit mobile number"
                  required
                  value={phone}
                />
              </div>
            </label>

            <label className="block text-sm font-bold text-ink">
              Email address <span className="font-normal text-muted">(optional)</span>
              <input
                autoComplete="email"
                className="mt-2 h-12 w-full rounded-xl border border-line px-3 outline-none focus:border-brand"
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
            </label>

            <label className="block text-sm font-bold text-ink">
              Password
              <input
                autoComplete="new-password"
                className="mt-2 h-12 w-full rounded-xl border border-line px-3 outline-none focus:border-brand"
                maxLength={128}
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type={showPasswords ? "text" : "password"}
                value={password}
              />
            </label>
            <div aria-live="polite">
              <div className="flex gap-1" aria-hidden="true">
                {[1, 2, 3, 4].map((level) => (
                  <span
                    className={`h-1.5 flex-1 rounded-full ${
                      score >= level
                        ? score < 2
                          ? "bg-red-400"
                          : score < 4
                            ? "bg-amber-400"
                            : "bg-emerald-500"
                        : "bg-slate-200"
                    }`}
                    key={level}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-muted">
                Password strength: {strengthNames[score]}
              </p>
            </div>

            <label className="block text-sm font-bold text-ink">
              Confirm password
              <input
                autoComplete="new-password"
                className="mt-2 h-12 w-full rounded-xl border border-line px-3 outline-none focus:border-brand"
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type={showPasswords ? "text" : "password"}
                value={confirmPassword}
              />
            </label>

            <button
              className="text-sm font-bold text-brand hover:underline"
              onClick={() => setShowPasswords((visible) => !visible)}
              type="button"
            >
              {showPasswords ? "Hide passwords" : "Show passwords"}
            </button>

            <label className="block text-sm font-bold text-ink">
              One-time setup key
              <input
                autoComplete="off"
                className="mt-2 h-12 w-full rounded-xl border border-line px-3 outline-none focus:border-brand"
                onChange={(event) => setSetupToken(event.target.value)}
                required
                type="password"
                value={setupToken}
              />
              <span className="mt-1 block text-xs font-normal leading-5 text-muted">
                Get this key from the backend operator. It is never stored in
                the browser or returned by the API.
              </span>
            </label>

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
                {error}
              </p>
            )}

            <button
              className="h-12 w-full rounded-xl bg-brand font-extrabold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy || setupToken.length < 32}
              type="submit"
            >
              {busy ? "Creating Admin..." : "Create Admin account"}
            </button>
          </form>
        )}

        {success && (
          <p className="mt-7 rounded-xl bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-800" role="status">
            {success} Redirecting to Admin sign in...
          </p>
        )}
      </section>
    </main>
  );
}
