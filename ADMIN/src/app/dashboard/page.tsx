"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ApiError,
  apiImageUrl,
  getAdminListings,
  updateListingStatus,
  type AdminListingContract,
} from "@/services/api";
import {
  AdminConsoleShell,
  useAdminConsole,
} from "@/components/AdminConsoleShell";

type ListingFilter = "all" | "review" | "published" | "rejected";

function isReviewable(status: string) {
  return status === "draft" || status === "pending";
}

function formatPrice(value: number) {
  return `₹${Number(value).toLocaleString("en-IN")} / month`;
}

function StatusBadge({ status }: { status: string }) {
  const palette =
    status === "published"
      ? "bg-emerald-50 text-emerald-700"
      : status === "rejected"
        ? "bg-red-50 text-red-700"
        : "bg-amber-50 text-amber-700";

  return (
    <span className={`rounded-full px-3 py-1.5 text-xs font-extrabold capitalize ${palette}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function ListingCard({
  listing,
  busy,
  onStatus,
}: {
  listing: AdminListingContract;
  busy: boolean;
  onStatus: (
    listing: AdminListingContract,
    status: "published" | "rejected"
  ) => void;
}) {
  const image =
    listing.images.find((item) => item.image_type.toUpperCase() === "COVER") ??
    listing.images[0];
  const imageSource = image?.image_url ?? image?.url;

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      {imageSource ? (
        // Image URLs may come from the configured object store or the API.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={`${listing.name} property`}
          className="h-48 w-full bg-slate-100 object-cover"
          src={apiImageUrl(imageSource)}
        />
      ) : (
        <div className="flex h-32 items-center justify-center bg-slate-100 text-xs font-bold tracking-wider text-slate-400">
          PROPERTY PHOTOS NOT ADDED
        </div>
      )}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-ink">{listing.name}</h2>
            <p className="mt-1 text-xs font-semibold text-muted">
              {listing.property_type} · {listing.gender}
            </p>
          </div>
          <StatusBadge status={listing.status} />
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          {[listing.area, listing.city, listing.address]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
            {formatPrice(listing.monthly_price)}
          </span>
          <span className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
            {listing.available_beds} / {listing.total_beds} available
          </span>
          <span className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
            Owner {listing.owner_phone || "not provided"}
          </span>
        </div>
        {listing.description && (
          <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted">
            {listing.description}
          </p>
        )}
        <div className="mt-5 flex gap-3">
          {listing.status !== "published" && (
            <button
              className="flex-1 rounded-xl bg-emerald-700 px-3 py-3 text-sm font-extrabold text-white hover:bg-emerald-800 disabled:opacity-50"
              disabled={busy}
              onClick={() => onStatus(listing, "published")}
              type="button"
            >
              {busy ? "Saving..." : "Approve & publish"}
            </button>
          )}
          {listing.status !== "rejected" && (
            <button
              className="flex-1 rounded-xl border border-red-200 px-3 py-3 text-sm font-extrabold text-red-700 hover:bg-red-50 disabled:opacity-50"
              disabled={busy}
              onClick={() => onStatus(listing, "rejected")}
              type="button"
            >
              Reject
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function AdminDashboardContent() {
  const { token, signOut } = useAdminConsole();
  const [listings, setListings] = useState<AdminListingContract[]>([]);
  const [filter, setFilter] = useState<ListingFilter>("review");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) {
      signOut();
      return;
    }

    try {
      const result = await getAdminListings(token);
      setListings(result);
      setError("");
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Unable to load listings.";
      if (
        (loadError instanceof ApiError &&
          [401, 403].includes(loadError.status)) ||
        /administrator access/i.test(message)
      ) {
        signOut();
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [signOut, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(
    () => ({
      review: listings.filter((item) => isReviewable(item.status)).length,
      published: listings.filter((item) => item.status === "published").length,
      rejected: listings.filter((item) => item.status === "rejected").length,
    }),
    [listings]
  );

  const visibleListings = useMemo(() => {
    const query = search.trim().toLowerCase();
    return listings.filter((listing) => {
      const statusMatches =
        filter === "all" ||
        (filter === "review" && isReviewable(listing.status)) ||
        listing.status === filter;
      const searchMatches =
        !query ||
        [listing.name, listing.city, listing.area, listing.address, listing.owner_phone]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      return statusMatches && searchMatches;
    });
  }, [filter, listings, search]);

  async function changeStatus(
    listing: AdminListingContract,
    status: "published" | "rejected"
  ) {
    if (!token) {
      signOut();
      return;
    }
    setBusyId(listing.id);
    try {
      const updated = await updateListingStatus(token, listing.id, status);
      setListings((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (updateError) {
      if (
        updateError instanceof ApiError &&
        [401, 403].includes(updateError.status)
      ) {
        signOut();
        return;
      }
      setError(
        updateError instanceof Error ? updateError.message : "Unable to update listing."
      );
    } finally {
      setBusyId(null);
    }
  }

  const filters: { key: ListingFilter; label: string }[] = [
    { key: "review", label: `Needs review · ${counts.review}` },
    { key: "all", label: `All listings · ${listings.length}` },
    { key: "published", label: `Published · ${counts.published}` },
    { key: "rejected", label: `Rejected · ${counts.rejected}` },
  ];

  return (
    <div>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-2xl font-extrabold text-ink">Listing review</h1>
              <p className="mt-1 text-sm text-muted">
                Review partner properties and manage marketplace visibility.
              </p>
            </div>
            <button
              className="rounded-xl border border-line bg-white px-4 py-3 text-sm font-bold hover:bg-slate-50"
              onClick={() => {
                setLoading(true);
                void load();
              }}
              type="button"
            >
              Refresh data
            </button>
          </div>

          <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["NEEDS REVIEW", counts.review, "Draft and pending applications"],
              ["PUBLISHED", counts.published, "Visible in marketplace"],
              ["REJECTED", counts.rejected, "Not visible to seekers"],
              ["TOTAL PROPERTIES", listings.length, "Loaded from the database"],
            ].map(([label, count, detail]) => (
              <div
                className="rounded-2xl border border-line bg-white p-5"
                key={label}
              >
                <p className="text-xs font-bold text-muted">{label}</p>
                <p className="mt-3 text-3xl font-extrabold text-ink">{count}</p>
                <p className="mt-1 text-xs text-muted">{detail}</p>
              </div>
            ))}
          </section>

          <section className="mt-7 rounded-2xl border border-line bg-white p-5">
            <h2 className="font-extrabold text-ink">Partner listings</h2>
            <p className="mt-1 text-xs text-muted">
              Listing information is loaded from the shared FastAPI database.
            </p>
            <input
              aria-label="Search listings"
              className="mt-5 h-11 w-full rounded-xl border border-line px-4 text-sm outline-none focus:border-brand"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search property, location or owner phone"
              value={search}
            />
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {filters.map((item) => (
                <button
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${
                    filter === item.key
                      ? "bg-ink text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  key={item.key}
                  onClick={() => setFilter(item.key)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>

          {error && (
            <div
              aria-live="polite"
              className="mt-5 flex items-center justify-between rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
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

          {loading ? (
            <p className="py-16 text-center text-sm font-medium text-muted">
              Loading listings from FindEasy...
            </p>
          ) : visibleListings.length ? (
            <section className="mt-5 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {visibleListings.map((listing) => (
                <ListingCard
                  busy={busyId === listing.id}
                  key={listing.id}
                  listing={listing}
                  onStatus={changeStatus}
                />
              ))}
            </section>
          ) : (
            <div className="mt-5 rounded-2xl border border-line bg-white px-5 py-14 text-center">
              <p className="font-extrabold text-ink">No listings in this view</p>
              <p className="mt-2 text-sm text-muted">
                Try another status filter or search term.
              </p>
            </div>
          )}
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <AdminConsoleShell activeSection="listings" title="Listing Review">
      <AdminDashboardContent />
    </AdminConsoleShell>
  );
}
