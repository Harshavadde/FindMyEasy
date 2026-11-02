"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  AdminConsoleShell,
  useAdminConsole,
} from "@/components/AdminConsoleShell";
import {
  ApiError,
  getAdminOwnerApplicationStats,
  getAdminOwnerApplications,
  type AdminOwnerApplicationFilters,
  type AdminOwnerApplicationPage,
  type AdminOwnerApplicationStats,
  type OwnerApplicationRelationship,
  type OwnerApplicationStatus,
} from "@/services/api";

const STATUSES: { value: OwnerApplicationStatus; label: string }[] = [
  { value: "SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW", label: "Under review" },
  {
    value: "ADDITIONAL_INFORMATION_REQUIRED",
    label: "Additional information required",
  },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "INVITATION_SENT", label: "Invitations sent" },
  { value: "INVITATION_ACCEPTED", label: "Owner registered" },
  { value: "EXPIRED", label: "Expired" },
];

const RELATIONSHIPS: { value: OwnerApplicationRelationship; label: string }[] = [
  { value: "PROPERTY_OWNER", label: "Property owner" },
  { value: "PROPERTY_MANAGER", label: "Property manager" },
  { value: "AUTHORIZED_REPRESENTATIVE", label: "Authorized representative" },
];

const STAT_CARDS: {
  key: keyof AdminOwnerApplicationStats;
  label: string;
}[] = [
  { key: "total_applications", label: "Total applications" },
  { key: "submitted", label: "Newly submitted" },
  { key: "under_review", label: "Under review" },
  {
    key: "additional_information_required",
    label: "Additional information",
  },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "invitations_sent", label: "Invitations sent" },
  { key: "invitations_accepted", label: "Invitations accepted" },
];

function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Unavailable"
    : parsed.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function relationshipLabel(value: OwnerApplicationRelationship) {
  return RELATIONSHIPS.find((item) => item.value === value)?.label ?? value;
}

function StatusBadge({ value }: { value: OwnerApplicationStatus }) {
  const palette =
    value === "APPROVED" || value === "INVITATION_ACCEPTED"
      ? "bg-emerald-50 text-emerald-700"
      : value === "REJECTED" || value === "EXPIRED"
        ? "bg-red-50 text-red-700"
        : value === "SUBMITTED"
          ? "bg-blue-50 text-blue-700"
          : "bg-amber-50 text-amber-800";
  const label = STATUSES.find((item) => item.value === value)?.label ?? value;
  return (
    <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${palette}`}>
      {label}
    </span>
  );
}

function OwnerApplicationsContent() {
  const { token, signOut } = useAdminConsole();
  const [stats, setStats] = useState<AdminOwnerApplicationStats | null>(null);
  const [pageData, setPageData] = useState<AdminOwnerApplicationPage | null>(
    null
  );
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OwnerApplicationStatus | "">("");
  const [city, setCity] = useState("");
  const [relationship, setRelationship] = useState<
    OwnerApplicationRelationship | ""
  >("");
  const [submittedFrom, setSubmittedFrom] = useState("");
  const [submittedTo, setSubmittedTo] = useState("");
  const [sortBy, setSortBy] =
    useState<AdminOwnerApplicationFilters["sort_by"]>("submitted_at");
  const [sortOrder, setSortOrder] =
    useState<AdminOwnerApplicationFilters["sort_order"]>("desc");
  const [page, setPage] = useState(1);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingPage, setLoadingPage] = useState(true);
  const [error, setError] = useState("");

  const filters = useMemo<AdminOwnerApplicationFilters>(
    () => ({
      search: search.trim() || undefined,
      status: status || undefined,
      city: city || undefined,
      relationship_type: relationship || undefined,
      submitted_from: submittedFrom || undefined,
      submitted_to: submittedTo || undefined,
      sort_by: sortBy,
      sort_order: sortOrder,
      page,
      page_size: 20,
    }),
    [
      city,
      page,
      relationship,
      search,
      sortBy,
      sortOrder,
      status,
      submittedFrom,
      submittedTo,
    ]
  );

  const loadStats = useCallback(async () => {
    if (!token) {
      signOut();
      return;
    }
    setLoadingStats(true);
    try {
      setStats(await getAdminOwnerApplicationStats(token));
    } catch (loadError) {
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
          : "Unable to load application statistics."
      );
    } finally {
      setLoadingStats(false);
    }
  }, [signOut, token]);

  const loadApplications = useCallback(async () => {
    if (!token) {
      signOut();
      return;
    }
    setLoadingPage(true);
    try {
      setPageData(await getAdminOwnerApplications(token, filters));
      setError("");
    } catch (loadError) {
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
          : "Unable to load Owner applications."
      );
    } finally {
      setLoadingPage(false);
    }
  }, [filters, signOut, token]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  function clearFilters() {
    setSearch("");
    setStatus("");
    setCity("");
    setRelationship("");
    setSubmittedFrom("");
    setSubmittedTo("");
    setSortBy("submitted_at");
    setSortOrder("desc");
    setPage(1);
  }

  return (
    <>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">
            Initial Request Review
          </h1>
          <p className="mt-1 text-sm text-muted">
            Search and review Owner partnership applications submitted to
            FindEasy.
          </p>
        </div>
        <button
          className="rounded-xl border border-line bg-white px-4 py-3 text-sm font-bold hover:bg-slate-50 disabled:opacity-60"
          disabled={loadingStats || loadingPage}
          onClick={() => {
            void Promise.all([loadStats(), loadApplications()]);
          }}
          type="button"
        >
          Refresh applications
        </button>
      </div>

      <section
        aria-label="Owner application totals"
        className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {STAT_CARDS.map(({ key, label }) => (
          <div
            className="rounded-2xl border border-line bg-white p-5 shadow-card"
            key={key}
          >
            <p className="text-xs font-bold text-muted">{label}</p>
            <p className="mt-3 text-3xl font-extrabold text-ink">
              {loadingStats ? (
                <span className="inline-block h-9 w-12 animate-pulse rounded bg-slate-100" />
              ) : stats ? (
                stats[key]
              ) : (
                "—"
              )}
            </p>
            <p className="mt-1 text-xs text-muted">From the application database</p>
          </div>
        ))}
      </section>

      <section className="mt-7 rounded-2xl border border-line bg-white p-5 shadow-card">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="font-extrabold text-ink">Partnership applications</h2>
            <p className="mt-1 text-xs text-muted">
              Applicant details and statuses are loaded from the FastAPI
              database.
            </p>
          </div>
          <button
            className="self-start rounded-lg px-3 py-2 text-xs font-bold text-muted hover:bg-slate-50"
            onClick={clearFilters}
            type="button"
          >
            Clear filters
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-bold text-muted sm:col-span-2">
            Search applicant, mobile, reference or PG
            <input
              aria-label="Search owner applications"
              className="mt-2 h-11 w-full rounded-xl border border-line px-3 text-sm font-normal text-ink outline-none focus:border-brand"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search applications"
              value={search}
            />
          </label>
          <label className="text-xs font-bold text-muted">
            Status
            <select
              aria-label="Filter by status"
              className="mt-2 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-normal text-ink outline-none focus:border-brand"
              onChange={(event) => {
                setStatus(event.target.value as OwnerApplicationStatus | "");
                setPage(1);
              }}
              value={status}
            >
              <option value="">All statuses</option>
              {STATUSES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-muted">
            City
            <select
              aria-label="Filter by city"
              className="mt-2 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-normal text-ink outline-none focus:border-brand"
              onChange={(event) => {
                setCity(event.target.value);
                setPage(1);
              }}
              value={city}
            >
              <option value="">All cities</option>
              {(pageData?.cities ?? []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-muted">
            Relationship
            <select
              aria-label="Filter by relationship"
              className="mt-2 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-normal text-ink outline-none focus:border-brand"
              onChange={(event) => {
                setRelationship(
                  event.target.value as OwnerApplicationRelationship | ""
                );
                setPage(1);
              }}
              value={relationship}
            >
              <option value="">All relationships</option>
              {RELATIONSHIPS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-muted">
            Submitted from
            <input
              aria-label="Filter submitted from date"
              className="mt-2 h-11 w-full rounded-xl border border-line px-3 text-sm font-normal text-ink outline-none focus:border-brand"
              onChange={(event) => {
                setSubmittedFrom(event.target.value);
                setPage(1);
              }}
              type="date"
              value={submittedFrom}
            />
          </label>
          <label className="text-xs font-bold text-muted">
            Submitted through
            <input
              aria-label="Filter submitted through date"
              className="mt-2 h-11 w-full rounded-xl border border-line px-3 text-sm font-normal text-ink outline-none focus:border-brand"
              onChange={(event) => {
                setSubmittedTo(event.target.value);
                setPage(1);
              }}
              type="date"
              value={submittedTo}
            />
          </label>
          <label className="text-xs font-bold text-muted">
            Sort by
            <select
              aria-label="Sort applications by"
              className="mt-2 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-normal text-ink outline-none focus:border-brand"
              onChange={(event) => {
                setSortBy(
                  event.target.value as AdminOwnerApplicationFilters["sort_by"]
                );
                setPage(1);
              }}
              value={sortBy}
            >
              <option value="submitted_at">Submitted date</option>
              <option value="applicant_name">Applicant name</option>
              <option value="status">Status</option>
              <option value="application_reference">Application reference</option>
            </select>
          </label>
          <label className="text-xs font-bold text-muted">
            Order
            <select
              aria-label="Sort order"
              className="mt-2 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-normal text-ink outline-none focus:border-brand"
              onChange={(event) =>
                setSortOrder(
                  event.target.value as AdminOwnerApplicationFilters["sort_order"]
                )
              }
              value={sortOrder}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </label>
        </div>
      </section>

      {error && (
        <div
          aria-live="polite"
          className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          <span>{error}</span>
          <button
            className="font-bold"
            onClick={() => setError("")}
            type="button"
          >
            Dismiss
          </button>
        </div>
      )}

      <section className="mt-5 overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        {loadingPage && !pageData ? (
          <div className="space-y-3 p-5" aria-label="Loading applications">
            {Array.from({ length: 5 }, (_, index) => (
              <div
                className="h-12 animate-pulse rounded-lg bg-slate-100"
                key={index}
              />
            ))}
          </div>
        ) : pageData?.items.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[1180px] w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3">Application reference</th>
                    <th className="px-4 py-3">Applicant</th>
                    <th className="px-4 py-3">Mobile / Email</th>
                    <th className="px-4 py-3">Relationship</th>
                    <th className="px-4 py-3">PG / City / Area</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {pageData.items.map((application) => (
                    <tr className="align-top hover:bg-slate-50/70" key={application.id}>
                      <td className="px-4 py-4 font-extrabold text-ink">
                        {application.application_reference}
                      </td>
                      <td className="px-4 py-4 font-semibold text-ink">
                        {application.applicant_name}
                      </td>
                      <td className="px-4 py-4 text-muted">
                        <div>{application.applicant_phone}</div>
                        <div className="mt-1 text-xs">
                          {application.applicant_email || "Email not provided"}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-muted">
                        {relationshipLabel(application.relationship_type)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-ink">
                          {application.pg_name}
                        </div>
                        <div className="mt-1 text-xs text-muted">
                          {[application.city, application.area].join(" · ")}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted">
                        {formatDate(application.submitted_at)}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge value={application.status} />
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          className="whitespace-nowrap font-bold text-brand hover:underline"
                          href={`/dashboard/owner-applications/${encodeURIComponent(application.id)}`}
                        >
                          View details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col justify-between gap-3 border-t border-line px-4 py-4 text-xs text-muted sm:flex-row sm:items-center">
              <p>
                {pageData.total} application{pageData.total === 1 ? "" : "s"} ·
                Page {pageData.page} of {pageData.total_pages}
              </p>
              <div className="flex gap-2">
                <button
                  className="rounded-lg border border-line px-3 py-2 font-bold text-ink disabled:opacity-40"
                  disabled={pageData.page <= 1 || loadingPage}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  type="button"
                >
                  Previous
                </button>
                <button
                  className="rounded-lg border border-line px-3 py-2 font-bold text-ink disabled:opacity-40"
                  disabled={pageData.page >= pageData.total_pages || loadingPage}
                  onClick={() => setPage((current) => current + 1)}
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : loadingPage ? (
          <p className="px-5 py-14 text-center text-sm font-medium text-muted">
            Loading applications...
          </p>
        ) : !pageData ? (
          <div className="px-5 py-14 text-center">
            <p className="font-extrabold text-ink">
              Applications could not be loaded
            </p>
            <p className="mt-2 text-sm text-muted">
              Check the error above and retry the request.
            </p>
          </div>
        ) : (
          <div className="px-5 py-14 text-center">
            <p className="font-extrabold text-ink">No applications found</p>
            <p className="mt-2 text-sm text-muted">
              {pageData.total === 0
                ? "There are no Owner partnership applications to review yet."
                : "Try changing or clearing the current search and filters."}
            </p>
          </div>
        )}
      </section>
    </>
  );
}

export default function OwnerApplicationsPage() {
  return (
    <AdminConsoleShell
      activeSection="owner-applications"
      title="Initial Request Review"
    >
      <OwnerApplicationsContent />
    </AdminConsoleShell>
  );
}
