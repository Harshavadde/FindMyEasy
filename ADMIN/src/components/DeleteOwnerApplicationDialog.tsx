"use client";

import { useState } from "react";

import type { AdminOwnerApplicationSummary } from "@/services/api";

export function DeleteOwnerApplicationDialog({
  application,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  application: AdminOwnerApplicationSummary;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const matchesReference =
    confirmation.trim() === application.application_reference;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        aria-labelledby="delete-application-title"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        role="dialog"
      >
        <p className="text-xs font-extrabold uppercase tracking-wide text-red-700">
          Permanent action
        </p>
        <h2
          className="mt-2 text-xl font-extrabold text-ink"
          id="delete-application-title"
        >
          Delete partnership application?
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          This permanently removes the application, its review history, and
          invitations. A linked Owner account is removed only if it has no
          listings, saved listings, or other dependent records.
        </p>

        <dl className="mt-5 grid gap-x-5 sm:grid-cols-2">
          {[
            ["Application reference", application.application_reference],
            ["Applicant", application.applicant_name],
            ["Phone", application.applicant_phone],
            ["Email", application.applicant_email || "Not provided"],
            ["PG / property", application.pg_name],
            ["Current status", application.status.replaceAll("_", " ")],
          ].map(([label, value]) => (
            <div className="border-b border-line py-3" key={label}>
              <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">
                {label}
              </dt>
              <dd className="mt-1 break-words text-sm font-semibold text-ink">
                {value}
              </dd>
            </div>
          ))}
        </dl>

        <label className="mt-5 block text-sm font-bold text-ink">
          Type{" "}
          <span className="font-extrabold text-red-700">
            {application.application_reference}
          </span>{" "}
          to confirm
          <input
            autoComplete="off"
            className="mt-2 h-11 w-full rounded-xl border border-line px-3 text-sm font-normal outline-none focus:border-red-500"
            onChange={(event) => setConfirmation(event.target.value)}
            value={confirmation}
          />
        </label>

        {error && (
          <p
            aria-live="polite"
            className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row">
          <button
            className="rounded-xl border border-line px-4 py-3 text-sm font-bold text-ink hover:bg-slate-50 disabled:opacity-60"
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-xl bg-red-700 px-4 py-3 text-sm font-extrabold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!matchesReference || busy}
            onClick={onConfirm}
            type="button"
          >
            {busy ? "Deleting..." : "Permanently delete"}
          </button>
        </div>
      </section>
    </div>
  );
}
