"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  getAdminSetupStatus,
  login,
} from "@/services/api";
import { saveAdminToken } from "@/services/tokenStorage";

export default function AdminLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [setupAvailable, setSetupAvailable] = useState(false);
  const [setupStatusError, setSetupStatusError] = useState(false);

  useEffect(() => {
    let active = true;
    getAdminSetupStatus()
      .then(({ available }) => {
        if (active) setSetupAvailable(available);
      })
      .catch(() => {
        if (active) setSetupStatusError(true);
      });

    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const result = await login(phone, password);
      saveAdminToken(result.access_token);
      router.replace("/dashboard");
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Unable to sign in. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-[440px] rounded-3xl border border-line bg-white p-8 shadow-card sm:p-10">
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
        <p className="text-sm font-bold text-brand">Internal workspace</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          Administrator sign in
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Sign in with an authorized FindEasy administrator account.
        </p>

        <form className="mt-8 space-y-5" onSubmit={submit}>
          <label className="block text-sm font-bold text-ink">
            Phone number
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
            Password
            <input
              autoComplete="current-password"
              className="mt-2 h-12 w-full rounded-xl border border-line px-3 outline-none focus:border-brand"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {error && (
            <p
              aria-live="polite"
              className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
            >
              {error}
            </p>
          )}

          <button
            className="h-12 w-full rounded-xl bg-brand font-extrabold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy}
            type="submit"
          >
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          Access restricted to FindEasy administrators.
        </p>
        {setupAvailable && (
          <p className="mt-4 text-center text-sm font-bold">
            <a className="text-brand hover:underline" href="/setup">
              First-time setup
            </a>
          </p>
        )}
        {setupStatusError && (
          <p className="mt-3 text-center text-xs text-muted" role="status">
            Initial setup availability could not be checked.
          </p>
        )}
      </section>
    </main>
  );
}
