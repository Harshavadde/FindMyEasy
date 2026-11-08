"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  useAdminConsole,
} from "@/components/AdminConsoleShell";
import { DeleteOwnerApplicationDialog } from "@/components/DeleteOwnerApplicationDialog";
import {
  ApiError,
  deleteAdminOwnerApplication,
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

const STAT_FILTERS: Partial<
  Record<keyof AdminOwnerApplicationStats, OwnerApplicationStatus>
> = {
  submitted: "SUBMITTED",
  under_review: "UNDER_REVIEW",
  additional_information_required: "ADDITIONAL_INFORMATION_REQUIRED",
  approved: "APPROVED",
  rejected: "REJECTED",
  invitations_sent: "INVITATION_SENT",
  invitations_accepted: "INVITATION_ACCEPTED",
};

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
  const { token, signOut, getReviewViewState, saveReviewViewState } =
    useAdminConsole();
  const [stats, setStats] = useState<AdminOwnerApplicationStats | null>(null);
  const [pageData, setPageData] = useState<AdminOwnerApplicationPage | null>(
    null
  );
  const [search, setSearch] = useState(
    () => getReviewViewState().ownerApplications?.search ?? ""
  );
  const [debouncedSearch, setDebouncedSearch] = useState(
    () => getReviewViewState().ownerApplications?.search ?? ""
  );
  const [status, setStatus] = useState<OwnerApplicationStatus | "">(
    () => getReviewViewState().ownerApplications?.status ?? ""
  );
  const [city, setCity] = useState(
    () => getReviewViewState().ownerApplications?.city ?? ""
  );
  const [relationship, setRelationship] = useState<
    OwnerApplicationRelationship | ""
  >(() => getReviewViewState().ownerApplications?.relationship ?? "");
  const [submittedFrom, setSubmittedFrom] = useState(
    () => getReviewViewState().ownerApplications?.submittedFrom ?? ""
  );
  const [submittedTo, setSubmittedTo] = useState(
    () => getReviewViewState().ownerApplications?.submittedTo ?? ""
  );
  const [sortBy, setSortBy] =
    useState<AdminOwnerApplicationFilters["sort_by"]>(
      () => getReviewViewState().ownerApplications?.sortBy ?? "submitted_at"
    );
  const [sortOrder, setSortOrder] =
    useState<AdminOwnerApplicationFilters["sort_order"]>(
      () => getReviewViewState().ownerApplications?.sortOrder ?? "desc"
    );
  const [page, setPage] = useState(
    () => getReviewViewState().ownerApplications?.page ?? 1
  );
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingPage, setLoadingPage] = useState(true);
  const [error, setError] = useState("");
  const [deleteCandidate, setDeleteCandidate] =
    useState<AdminOwnerApplicationPage["items"][number] | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    saveReviewViewState({
      ...getReviewViewState(),
      ownerApplications: {
        search,
        status,
        city,
        relationship,
        submittedFrom,
        submittedTo,
        sortBy: sortBy ?? "submitted_at",
        sortOrder: sortOrder ?? "desc",
        page,
      },
    });
  }, [
    city,
    page,
    relationship,
    search,
    getReviewViewState,
    saveReviewViewState,
    sortBy,
    sortOrder,
    status,
    submittedFrom,
    submittedTo,
  ]);

  const filters = useMemo<AdminOwnerApplicationFilters>(
    () => ({
      search: debouncedSearch.trim() || undefined,
      status: status || undefined,
      city: city || undefined,
      relationship_type: relationship || undefined,
      submitted_from: submittedFrom || undefined,
      submitted_to: submittedTo || undefined,
      sort_by: sortBy,
      sort_order: sortOrder,
      page,
      page_size: 10,
    }),
    [
      city,
      page,
      relationship,
      debouncedSearch,
      sortBy,
      sortOrder,
      status,
      submittedFrom,
      submittedTo,
    ]
  );

  const loadStats = useCallback(async (signal?: AbortSignal) => {
    if (!token) {
      signOut();
      return;
    }
    setLoadingStats(true);
    try {
      const result = await getAdminOwnerApplicationStats(token);
      if (!signal?.aborted) setStats(result);
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
          : "Unable to load application statistics."
      );
    } finally {
      if (!signal?.aborted) setLoadingStats(false);
    }
  }, [signOut, token]);

  const loadApplications = useCallback(async (signal?: AbortSignal) => {
    if (!token) {
      signOut();
      return;
    }
    setLoadingPage(true);
    try {
      setPageData(await getAdminOwnerApplications(token, filters, signal));
      setError("");
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
          : "Unable to load Owner applications."
      );
    } finally {
      if (!signal?.aborted) setLoadingPage(false);
    }
  }, [filters, signOut, token]);

  useEffect(() => {
    const controller = new AbortController();
    void loadStats(controller.signal);
    return () => controller.abort();
  }, [loadStats]);

  useEffect(() => {
    const controller = new AbortController();
    void loadApplications(controller.signal);
    return () => controller.abort();
  }, [loadApplications]);

  useEffect(() => {
    if (pageData && !loadingPage && page > pageData.total_pages) {
      setPage(Math.max(1, pageData.total_pages));
    }
  }, [loadingPage, page, pageData]);

  async function deleteApplication() {
    if (!deleteCandidate || deleteBusy) return;
    if (!token) {
      signOut();
      return;
    }

    setDeleteBusy(true);
    setDeleteError("");
    try {
      await deleteAdminOwnerApplication(
        token,
        deleteCandidate.id,
        deleteCandidate.application_reference
      );
      setDeleteCandidate(null);
      await Promise.all([loadStats(), loadApplications()]);
    } catch (deleteFailure) {
      if (
        deleteFailure instanceof ApiError &&
        [401, 403].includes(deleteFailure.status)
      ) {
        signOut();
        return;
      }
      setDeleteError(
        deleteFailure instanceof Error
          ? deleteFailure.message
          : "The application could not be deleted."
      );
    } finally {
      setDeleteBusy(false);
    }
  }

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
          <button
            aria-pressed={
              key === "total_applications"
                ? !status
                : STAT_FILTERS[key] === status
            }
            className={`rounded-2xl border bg-white p-5 text-left shadow-card transition hover:-translate-y-0.5 hover:border-brand/40 ${
              (key === "total_applications" && !status) ||
              STAT_FILTERS[key] === status
                ? "border-brand ring-1 ring-brand/20"
                : "border-line"
            }`}
            key={key}
            onClick={() => {
              setStatus(STAT_FILTERS[key] ?? "");
              setPage(1);
            }}
            type="button"
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
          </button>
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
            {loadingPage && (
              <p
                aria-live="polite"
                className="border-b border-line bg-slate-50 px-4 py-2 text-xs font-semibold text-muted"
                role="status"
              >
                Updating applications…
              </p>
            )}
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
                        <div className="flex items-center gap-3">
                        <Link
                          className="whitespace-nowrap font-bold text-brand hover:underline"
                          href={`/dashboard/owner-applications/${encodeURIComponent(application.id)}`}
                        >
                          View details
                        </Link>
                          <button
                            className="whitespace-nowrap font-bold text-red-700 hover:underline"
                            onClick={() => {
                              setDeleteError("");
                              setDeleteCandidate(application);
                            }}
                            type="button"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col justify-between gap-3 border-t border-line px-4 py-4 text-xs text-muted sm:flex-row sm:items-center">
              <p>
                Showing{" "}
                {pageData.total === 0
                  ? 0
                  : (pageData.page - 1) * pageData.page_size + 1}
                –
                {Math.min(pageData.page * pageData.page_size, pageData.total)} of{" "}
                {pageData.total} applications
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
                {Array.from(
                  { length: pageData.total_pages },
                  (_, index) => index + 1
                )
                  .filter(
                    (pageNumber) =>
                      pageNumber === 1 ||
                      pageNumber === pageData.total_pages ||
                      Math.abs(pageNumber - pageData.page) <= 1
                  )
                  .map((pageNumber, index, visiblePages) => (
                    <span className="contents" key={pageNumber}>
                      {index > 0 &&
                        pageNumber - visiblePages[index - 1] > 1 && (
                          <span className="px-1 py-2" aria-hidden="true">
                            …
                          </span>
                        )}
                      <button
                        aria-current={
                          pageNumber === pageData.page ? "page" : undefined
                        }
                        className={`min-w-9 rounded-lg border px-3 py-2 font-bold ${
                          pageNumber === pageData.page
                            ? "border-ink bg-ink text-white"
                            : "border-line text-ink hover:bg-slate-50"
                        }`}
                        disabled={loadingPage}
                        onClick={() => setPage(pageNumber)}
                        type="button"
                      >
                        {pageNumber}
                      </button>
                    </span>
                  ))}
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
      {deleteCandidate && (
        <DeleteOwnerApplicationDialog
          application={deleteCandidate}
          busy={deleteBusy}
          error={deleteError}
          onClose={() => {
            if (!deleteBusy) {
              setDeleteCandidate(null);
              setDeleteError("");
            }
          }}
          onConfirm={() => void deleteApplication()}
        />
      )}
    </>
  );
}

export default function OwnerApplicationsPage() {
  return <OwnerApplicationsContent />;
}
