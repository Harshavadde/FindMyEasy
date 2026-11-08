"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { useAdminConsole } from "@/components/AdminConsoleShell";
import {
  ApiError,
  createAdminAccount,
  disableAdminAccount,
  getAdminAccounts,
  normalizeIndianPhoneInput,
  type AdminUser,
} from "@/services/api";

function formatDate(value: string | null) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Not available"
    : parsed.toLocaleString("en-IN", {
        dateStyle: "long",
        timeStyle: "short",
      });
}

function AccountField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border-b border-line py-4 last:border-0">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function AdminProfileContent() {
  const { user } = useAdminConsole();
  const displayName = user.full_name || "Administrator";
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="mx-auto max-w-3xl">
      <div>
        <p className="text-sm font-bold text-brand">Account</p>
        <h1 className="mt-1 text-2xl font-extrabold text-ink">
          Administrator profile
        </h1>
        <p className="mt-2 text-sm text-muted">
          Profile information from your authenticated FindEasy account.
        </p>
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-white p-6 shadow-card">
        <div className="flex items-center gap-4 border-b border-line pb-6">
          <div
            aria-hidden="true"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-lg font-extrabold text-brand"
          >
            {initials || "A"}
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-ink">{displayName}</h2>
            <p className="mt-1 text-sm text-muted">FindEasy administrator</p>
          </div>
        </div>

        <div className="pt-2" id="account-details">
          <AccountField label="Full name" value={displayName} />
          <AccountField label="Role" value={user.user_role} />
          <AccountField
            label="Mobile number"
            value={user.phone_number || "Not available"}
          />
          <AccountField label="Email" value={user.email || "Not available"} />
          <AccountField
            label="Account status"
            value={user.is_active ? "Active" : "Disabled"}
          />
          <AccountField
            label="Account created"
            value={formatDate(user.created_at)}
          />
          <AccountField
            label="Last login"
            value="Not tracked by the backend"
          />
        </div>
      </section>

      <p className="mt-4 text-xs leading-5 text-muted">
        Profile editing and password changes are not currently supported by the
        authenticated Admin API.
      </p>

      <AdminAccountManagement />
    </div>
  );
}

function AdminAccountManagement() {
  const { token, user, signOut } = useAdminConsole();
  const [accounts, setAccounts] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyAdminId, setBusyAdminId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadAccounts = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const result = await getAdminAccounts(token, signal);
        if (!signal?.aborted) setAccounts(result);
      } catch (loadError) {
        if (signal?.aborted) return;
        if (
          loadError instanceof ApiError &&
          [401, 403].includes(loadError.status)
        ) {
          signOut();
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load administrator accounts."
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [signOut, token]
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadAccounts(controller.signal);
    return () => controller.abort();
  }, [loadAccounts]);

  async function addAdministrator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const created = await createAdminAccount(token, {
        full_name: name.trim(),
        phone_number: `+91${phone}`,
        ...(email.trim() ? { email: email.trim() } : {}),
        password,
      });
      setAccounts((current) => [...current, created]);
      setName("");
      setPhone("");
      setEmail("");
      setPassword("");
      setNotice(`${created.full_name || "Administrator"} can now sign in.`);
    } catch (createError) {
      if (
        createError instanceof ApiError &&
        [401, 403].includes(createError.status)
      ) {
        signOut();
        return;
      }
      setError(
        createError instanceof Error
          ? createError.message
          : "Unable to create the administrator account."
      );
    } finally {
      setBusy(false);
    }
  }

  async function disableAdministrator(account: AdminUser) {
    if (!account.is_active || account.id === user.id || busyAdminId) return;
    setBusyAdminId(account.id);
    setError("");
    setNotice("");
    try {
      const updated = await disableAdminAccount(token, account.id);
      setAccounts((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      setNotice(`${updated.full_name || "Administrator"} was disabled.`);
    } catch (disableError) {
      if (
        disableError instanceof ApiError &&
        [401, 403].includes(disableError.status)
      ) {
        signOut();
        return;
      }
      setError(
        disableError instanceof Error
          ? disableError.message
          : "Unable to disable the administrator account."
      );
    } finally {
      setBusyAdminId("");
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-line bg-white p-6 shadow-card">
      <div>
        <h2 className="text-lg font-extrabold text-ink">
          Administrator access
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          Create independent Admin accounts or disable access. Passwords are
          hashed by the backend and never displayed again.
        </p>
      </div>

      {error && (
        <p
          className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          role="status"
        >
          {notice}
        </p>
      )}

      <div className="mt-5 divide-y divide-line">
        {loading ? (
          Array.from({ length: 2 }, (_, index) => (
            <div
              aria-hidden="true"
              className="h-16 animate-pulse bg-slate-50"
              key={index}
            />
          ))
        ) : accounts.length ? (
          accounts.map((account) => (
            <div
              className="flex flex-wrap items-center justify-between gap-3 py-4"
              key={account.id}
            >
              <div>
                <p className="font-bold text-ink">
                  {account.full_name || "Administrator"}
                  {account.id === user.id ? " (you)" : ""}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {account.phone_number}
                  {account.email ? ` · ${account.email}` : ""}
                  {` · ${account.is_active ? "Active" : "Disabled"}`}
                </p>
              </div>
              <button
                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={
                  !account.is_active ||
                  account.id === user.id ||
                  busyAdminId === account.id
                }
                onClick={() => void disableAdministrator(account)}
                type="button"
              >
                {busyAdminId === account.id ? "Disabling..." : "Disable"}
              </button>
            </div>
          ))
        ) : error ? null : (
          <p className="py-4 text-sm text-muted">
            No administrator accounts are available.
          </p>
        )}
      </div>

      <form className="mt-6 grid gap-3 border-t border-line pt-6 sm:grid-cols-2" onSubmit={addAdministrator}>
        <label className="text-xs font-bold text-muted">
          Full name
          <input
            autoComplete="name"
            className="mt-1.5 h-11 w-full rounded-xl border border-line px-3 text-sm font-normal text-ink outline-none focus:border-brand"
            maxLength={150}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </label>
        <label className="text-xs font-bold text-muted">
          Phone number
          <div className="mt-1.5 flex h-11 items-center rounded-xl border border-line px-3 focus-within:border-brand">
            <span className="mr-2 text-sm">+91</span>
            <input
              autoComplete="tel-national"
              className="h-full min-w-0 flex-1 text-sm font-normal text-ink outline-none"
              inputMode="numeric"
              maxLength={18}
              onChange={(event) =>
                setPhone(normalizeIndianPhoneInput(event.target.value))
              }
              pattern="[6-9][0-9]{9}"
              placeholder="10-digit mobile number"
              required
              value={phone}
            />
          </div>
        </label>
        <label className="text-xs font-bold text-muted">
          Email (optional)
          <input
            autoComplete="email"
            className="mt-1.5 h-11 w-full rounded-xl border border-line px-3 text-sm font-normal text-ink outline-none focus:border-brand"
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
        </label>
        <label className="text-xs font-bold text-muted">
          Temporary password
          <input
            autoComplete="new-password"
            className="mt-1.5 h-11 w-full rounded-xl border border-line px-3 text-sm font-normal text-ink outline-none focus:border-brand"
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        <div className="sm:col-span-2">
          <button
            className="rounded-xl bg-brand px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50"
            disabled={busy || phone.length !== 10}
            type="submit"
          >
            {busy ? "Creating account..." : "Create administrator"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default function AdminProfilePage() {
  return <AdminProfileContent />;
}
