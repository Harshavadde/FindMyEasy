"use client";

import { useState } from "react";

import type { AdminListingSummaryContract } from "@/services/api";

type ListingDecision = "published" | "rejected";

export function ListingReviewActions({
  listing,
  busy,
  onDecision,
}: {
  listing: Pick<
    AdminListingSummaryContract,
    "id" | "name" | "area" | "city" | "monthly_price" | "total_beds" | "status"
  >;
  busy: boolean;
  onDecision: (
    status: ListingDecision,
    reason?: string
  ) => Promise<boolean>;
}) {
  const [dialogStatus, setDialogStatus] = useState<ListingDecision | null>(null);
  const [reason, setReason] = useState("");

  async function confirmDecision() {
    if (!dialogStatus || busy) return;
    const saved = await onDecision(
      dialogStatus,
      dialogStatus === "rejected" ? reason.trim() : undefined
    );
    if (saved) {
      setDialogStatus(null);
      setReason("");
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {listing.status !== "published" && (
          <button
            className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-extrabold text-white hover:bg-emerald-800 disabled:opacity-50"
            disabled={busy}
            onClick={() => setDialogStatus("published")}
            type="button"
          >
            Approve &amp; publish
          </button>
        )}
        {listing.status !== "rejected" && (
          <button
            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-extrabold text-red-700 hover:bg-red-50 disabled:opacity-50"
            disabled={busy}
            onClick={() => setDialogStatus("rejected")}
            type="button"
          >
            Reject
          </button>
        )}
      </div>

      {dialogStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <section
            aria-labelledby="listing-decision-title"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
            role="dialog"
          >
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted">
              Property review
            </p>
            <h2
              className="mt-2 text-xl font-extrabold text-ink"
              id="listing-decision-title"
            >
              {dialogStatus === "published"
                ? "Approve and publish this property?"
                : "Reject this property?"}
            </h2>
            <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
              <p className="font-bold text-ink">{listing.name}</p>
              <p className="mt-1 text-muted">
                {[listing.area, listing.city].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-1 text-muted">
                ₹{listing.monthly_price.toLocaleString("en-IN")} / month ·{" "}
                {listing.total_beds} beds
              </p>
            </div>
            {dialogStatus === "published" ? (
              <p className="mt-4 text-sm leading-6 text-muted">
                This saves the status to the backend and makes the listing
                eligible for public marketplace visibility.
              </p>
            ) : (
              <label className="mt-4 block text-sm font-bold text-ink">
                Rejection reason
                <textarea
                  className="mt-2 min-h-28 w-full rounded-xl border border-line p-3 text-sm font-normal outline-none focus:border-red-500"
                  maxLength={2000}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Explain what needs to be corrected."
                  required
                  value={reason}
                />
              </label>
            )}
            <div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row">
              <button
                className="rounded-xl border border-line px-4 py-3 text-sm font-bold text-ink hover:bg-slate-50 disabled:opacity-60"
                disabled={busy}
                onClick={() => {
                  setDialogStatus(null);
                  setReason("");
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className={`rounded-xl px-4 py-3 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                  dialogStatus === "published"
                    ? "bg-emerald-700 hover:bg-emerald-800"
                    : "bg-red-700 hover:bg-red-800"
                }`}
                disabled={
                  busy ||
                  (dialogStatus === "rejected" && reason.trim().length === 0)
                }
                onClick={() => void confirmDecision()}
                type="button"
              >
                {busy
                  ? "Saving..."
                  : dialogStatus === "published"
                    ? "Confirm publish"
                    : "Confirm rejection"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
