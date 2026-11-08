"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useAdminConsole } from "@/components/AdminConsoleShell";
import { ListingReviewActions } from "@/components/ListingReviewActions";
import {
  ApiError,
  getAdminListings,
  updateListingStatus,
  type AdminListingFilters,
  type AdminListingPage,
  type AdminListingSummaryContract,
} from "@/services/api";

const STATUS_OPTIONS: {
  value: NonNullable<AdminListingFilters["status"]> | "";
  label: string;
}[] = [
  { value: "", label: "All statuses" },
  { value: "review", label: "Needs review" },
  { value: "published", label: "Published" },
  { value: "rejected", label: "Rejected" },
];

function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Unavailable"
    : parsed.toLocaleDateString("en-IN", {
        dateStyle: "medium",
      });
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function ListingStatusBadge({ status }: { status: string }) {
  const color =
    status === "published"
      ? "bg-emerald-50 text-emerald-700"
      : status === "rejected"
        ? "bg-red-50 text-red-700"
        : "bg-amber-50 text-amber-800";
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-extrabold capitalize ${color}`}
    >
      {statusLabel(status)}
    </span>
  );
}

function ListingThumbnail({
  listing,
}: {
  listing: AdminListingSummaryContract;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const imageUrl = listing.preview_image_url;
  return (
    <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-slate-100">
      {imageUrl && !failed ? (
        <img
          alt={`${listing.name} property`}
          className="h-full w-full object-cover"
          decoding="async"
          height={160}
          loading="lazy"
          onError={() => setFailed(true)}
          onLoad={() => setLoaded(true)}
          src={imageUrl}
          width={224}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-xs font-bold text-muted">
          No image
        </div>
      )}
      {imageUrl && !loaded && !failed && (
        <div
          aria-hidden="true"
          className="absolute inset-0 animate-pulse bg-slate-200"
        />
      )}
    </div>
  );
}

function ListingReviewContent() {
  const { token, signOut, getReviewViewState, saveReviewViewState } =
    useAdminConsole();
  const [pageData, setPageData] = useState<AdminListingPage | null>(null);
  const [search, setSearch] = useState(
    () => getReviewViewState().listings?.search ?? ""
  );
  const [debouncedSearch, setDebouncedSearch] = useState(
    () => getReviewViewState().listings?.search ?? ""
  );
  const [status, setStatus] =
    useState<AdminListingFilters["status"] | "">(
      () => getReviewViewState().listings?.status ?? ""
    );
  const [city, setCity] = useState(
    () => getReviewViewState().listings?.city ?? ""
  );
  const [sortBy, setSortBy] =
    useState<AdminListingFilters["sort_by"]>(
      () => getReviewViewState().listings?.sortBy ?? "created_at"
    );
  const [sortOrder, setSortOrder] =
    useState<AdminListingFilters["sort_order"]>(
      () => getReviewViewState().listings?.sortOrder ?? "desc"
    );
  const [page, setPage] = useState(
    () => getReviewViewState().listings?.page ?? 1
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyListingId, setBusyListingId] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    saveReviewViewState({
      ...getReviewViewState(),
      listings: { search, status, city, sortBy, sortOrder, page },
    });
  }, [
    city,
    getReviewViewState,
    page,
    saveReviewViewState,
    search,
    sortBy,
    sortOrder,
    status,
  ]);

  const filters = useMemo<AdminListingFilters>(
    () => ({
      search: debouncedSearch.trim() || undefined,
      status: status || undefined,
      city: city || undefined,
      sort_by: sortBy,
      sort_order: sortOrder,
      page,
      page_size: 10,
    }),
    [city, debouncedSearch, page, sortBy, sortOrder, status]
  );

  const loadListings = useCallback(async (signal?: AbortSignal) => {
    if (!token) {
      signOut();
      return;
    }
    setLoading(true);
    setError("");
    try {
      setPageData(await getAdminListings(token, filters, signal));
    } catch (loadError) {
      if (signal?.aborted) return;
      setPageData(null);
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
          : "Unable to load property listings."
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [filters, signOut, token]);

  useEffect(() => {
    const controller = new AbortController();
    void loadListings(controller.signal);
    return () => controller.abort();
  }, [loadListings]);

  async function handleDecision(
    listing: AdminListingSummaryContract,
    nextStatus: "published" | "rejected",
    reason?: string
  ) {
    if (!token || busyListingId) return false;
    setBusyListingId(listing.id);
    setActionError("");
    setNotice("");
    try {
      await updateListingStatus(token, listing.id, nextStatus, reason);
      setNotice(
        nextStatus === "published"
          ? `${listing.name} was approved and published.`
          : `${listing.name} was rejected.`
      );
      await loadListings();
      return true;
    } catch (actionFailure) {
      if (
        actionFailure instanceof ApiError &&
        [401, 403].includes(actionFailure.status)
      ) {
        signOut();
        return false;
      }
      setActionError(
        actionFailure instanceof Error
          ? actionFailure.message
          : "Unable to update the listing review."
      );
      return false;
    } finally {
      setBusyListingId("");
    }
  }

  function changeFilter(action: () => void) {
    action();
    setPage(1);
  }

  return (
    <div>
      <div className="mx-auto max-w-7xl px-5 py-7 md:px-8 md:py-9">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-brand">
              Listing review
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-ink">
              Properties
            </h1>
            <p className="mt-2 text-sm text-muted">
              Review property details, images, and owner-submitted information.
            </p>
          </div>
          <button
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-ink hover:bg-slate-50 disabled:opacity-50"
            disabled={loading}
            onClick={() => void loadListings()}
            type="button"
          >
            Refresh
          </button>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["All listings", pageData?.total_listings ?? 0, ""],
            ["Needs review", pageData?.review_count ?? 0, "review"],
            ["Published", pageData?.published_count ?? 0, "published"],
            ["Rejected", pageData?.rejected_count ?? 0, "rejected"],
          ].map(([label, count, filter]) => (
            <button
              aria-pressed={status === filter}
              className={`rounded-2xl border p-4 text-left shadow-sm transition ${
                status === filter
                  ? "border-brand bg-brand/5"
                  : "border-line bg-white hover:border-slate-300"
              }`}
              key={label}
              onClick={() =>
                changeFilter(() =>
                  setStatus(filter as AdminListingFilters["status"] | "")
                )
              }
              type="button"
            >
              <span className="block text-xs font-bold text-muted">{label}</span>
              <span className="mt-1 block text-2xl font-black text-ink">
                {loading ? "…" : count}
              </span>
            </button>
          ))}
        </div>

        <section className="mt-6 rounded-2xl border border-line bg-white p-4 shadow-sm md:p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="text-xs font-bold text-muted xl:col-span-2">
              Search
              <input
                className="mt-1.5 w-full rounded-xl border border-line px-3 py-2.5 text-sm font-medium text-ink outline-none focus:border-brand"
                onChange={(event) =>
                  changeFilter(() => setSearch(event.target.value))
                }
                placeholder="Property, owner, area, or city"
                value={search}
              />
            </label>
            <label className="text-xs font-bold text-muted">
              Status
              <select
                className="mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
                onChange={(event) =>
                  changeFilter(() =>
                    setStatus(
                      event.target.value as AdminListingFilters["status"] | ""
                    )
                  )
                }
                value={status}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-muted">
              City
              <select
                className="mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
                onChange={(event) =>
                  changeFilter(() => setCity(event.target.value))
                }
                value={city}
              >
                <option value="">All cities</option>
                {(pageData?.cities ?? []).map((cityName) => (
                  <option key={cityName} value={cityName}>
                    {cityName}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-muted">
              Sort by
              <select
                className="mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
                onChange={(event) =>
                  changeFilter(() =>
                    setSortBy(
                      event.target.value as AdminListingFilters["sort_by"]
                    )
                  )
                }
                value={sortBy}
              >
                <option value="created_at">Date added</option>
                <option value="name">Property name</option>
                <option value="city">City</option>
                <option value="monthly_price">Monthly price</option>
                <option value="status">Status</option>
              </select>
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              className="rounded-lg px-3 py-2 text-xs font-bold text-muted hover:bg-slate-50 hover:text-ink"
              onClick={() =>
                changeFilter(() =>
                  setSortOrder((current) =>
                    current === "asc" ? "desc" : "asc"
                  )
                )
              }
              type="button"
            >
              Sort {sortOrder === "asc" ? "ascending" : "descending"}
            </button>
          </div>
        </section>

        {error && (
          <div
            className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </div>
        )}
        {actionError && (
          <div
            className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {actionError}
          </div>
        )}
        {notice && (
          <div
            className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            role="status"
          >
            {notice}
          </div>
        )}

        <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-extrabold text-ink">Property queue</h2>
            <span className="text-xs font-semibold text-muted">
              {loading
                ? "Loading results..."
                : `${pageData?.total ?? 0} result${pageData?.total === 1 ? "" : "s"}`}
            </span>
          </div>
          {loading ? (
            <div aria-label="Loading properties" className="space-y-3 p-5">
              {Array.from({ length: 5 }, (_, index) => (
                <div
                  className="h-24 animate-pulse rounded-xl bg-slate-100"
                  key={index}
                />
              ))}
            </div>
          ) : error && !pageData ? (
            <div className="px-5 py-12 text-center">
              <p className="font-bold text-ink">Properties could not be loaded</p>
              <button
                className="mt-3 rounded-lg border border-line px-4 py-2 text-sm font-bold text-ink"
                onClick={() => void loadListings()}
                type="button"
              >
                Retry
              </button>
            </div>
          ) : !pageData?.items.length ? (
            <div className="px-5 py-12 text-center">
              <p className="font-bold text-ink">No properties found</p>
              <p className="mt-1 text-sm text-muted">
                Change or clear the filters to see more listings.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {pageData.items.map((listing) => (
                <article
                  className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5"
                  key={listing.id}
                >
                  <ListingThumbnail listing={listing} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-extrabold text-ink">
                        {listing.name}
                      </h3>
                      <ListingStatusBadge status={listing.status} />
                    </div>
                    <p className="mt-1 truncate text-sm text-muted">
                      {[listing.area, listing.city].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-muted">
                      {listing.owner_name || "Owner unavailable"} ·{" "}
                      {listing.total_beds} beds · ₹
                      {listing.monthly_price.toLocaleString("en-IN")}/month ·{" "}
                      Added {formatDate(listing.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      className="rounded-lg border border-line px-3 py-2 text-xs font-extrabold text-ink hover:bg-slate-50"
                      href={`/dashboard/listings/${encodeURIComponent(listing.id)}`}
                    >
                      View details
                    </Link>
                    <ListingReviewActions
                      busy={busyListingId === listing.id}
                      listing={listing}
                      onDecision={(nextStatus, reason) =>
                        handleDecision(listing, nextStatus, reason)
                      }
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-muted">
            Page {pageData?.page ?? page} of {pageData?.total_pages ?? 1}
          </p>
          <div className="flex gap-2">
            <button
              className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-ink disabled:cursor-not-allowed disabled:opacity-40"
              disabled={loading || page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              Previous
            </button>
            <button
              className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-ink disabled:cursor-not-allowed disabled:opacity-40"
              disabled={
                loading || page >= (pageData?.total_pages ?? 1)
              }
              onClick={() => setPage((current) => current + 1)}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ListingReviewPage() {
  return <ListingReviewContent />;
}
