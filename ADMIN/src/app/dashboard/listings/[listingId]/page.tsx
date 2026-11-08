"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import {
  useAdminConsole,
} from "@/components/AdminConsoleShell";
import { ListingReviewActions } from "@/components/ListingReviewActions";
import {
  ApiError,
  getAdminListing,
  updateListingStatus,
  type AdminListingContract,
} from "@/services/api";

function formatDate(value: string | null) {
  if (!value) return "Unavailable";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Unavailable"
    : parsed.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  return (
    <div className="min-w-0 border-b border-line py-3 last:border-0">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-ink">
        {value === null || value === "" ? "Not provided" : value}
      </p>
    </div>
  );
}

function GalleryImage({ url, alt }: { url: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative aspect-[4/3] bg-slate-100">
      {!failed && (
        <img
          alt={alt}
          className="h-full w-full object-cover"
          decoding="async"
          height={480}
          loading="lazy"
          onError={() => setFailed(true)}
          onLoad={() => setLoaded(true)}
          src={url}
          width={640}
        />
      )}
      {!loaded && !failed && (
        <div
          aria-hidden="true"
          className="absolute inset-0 animate-pulse bg-slate-200"
        />
      )}
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-muted">
          Image unavailable
        </div>
      )}
    </div>
  );
}

function PropertyDetailContent() {
  const { token, signOut } = useAdminConsole();
  const params = useParams<{ listingId: string }>();
  const listingId = params.listingId;
  const [listing, setListing] = useState<AdminListingContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!token) {
      signOut();
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await getAdminListing(token, listingId, signal);
      if (!signal?.aborted) setListing(result);
    } catch (loadError) {
      if (signal?.aborted) return;
      setListing(null);
      if (
        loadError instanceof ApiError &&
        [401, 403].includes(loadError.status)
      ) {
        signOut();
        return;
      }
      setError(
        loadError instanceof ApiError && loadError.status === 404
          ? "This property listing could not be found."
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load property details."
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [listingId, signOut, token]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function handleDecision(
    status: "published" | "rejected",
    reason?: string
  ) {
    if (!token || !listing || busy) return false;
    setBusy(true);
    setActionError("");
    setNotice("");
    try {
      await updateListingStatus(token, listing.id, status, reason);
      setNotice(
        status === "published"
          ? "The property was approved and published."
          : "The property was rejected."
      );
      await load();
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
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mx-auto max-w-6xl px-5 py-7 md:px-8 md:py-9">
        <Link
          className="text-sm font-bold text-brand hover:underline"
          href="/dashboard"
        >
          ← Back to property review
        </Link>

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
        {loading ? (
          <div className="py-16 text-center text-sm font-semibold text-muted">
            Loading property details...
          </div>
        ) : listing ? (
          <>
            <section className="mt-5 rounded-2xl border border-line bg-white p-5 shadow-sm md:p-7">
              <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-widest text-brand">
                    Listing review
                  </p>
                  <h1 className="mt-2 text-3xl font-black tracking-tight text-ink">
                    {listing.name}
                  </h1>
                  <p className="mt-2 text-sm text-muted">
                    {[listing.area, listing.city].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-muted">
                    Submitted {formatDate(listing.created_at)} · Updated{" "}
                    {formatDate(listing.updated_at)}
                  </p>
                </div>
                <ListingReviewActions
                  busy={busy}
                  listing={listing}
                  onDecision={handleDecision}
                />
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailField
                  label="Review status"
                  value={listing.status.replaceAll("_", " ")}
                />
                <DetailField
                  label="Monthly price"
                  value={`₹${listing.monthly_price.toLocaleString("en-IN")}`}
                />
                <DetailField label="Total beds" value={listing.total_beds} />
                <DetailField
                  label="Available beds"
                  value={listing.available_beds}
                />
              </div>
            </section>

            {listing.images.length > 0 && (
              <section className="mt-5 rounded-2xl border border-line bg-white p-5 shadow-sm md:p-7">
                <h2 className="text-lg font-extrabold text-ink">
                  Property images ({listing.images.length})
                </h2>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {listing.images.map((image) => {
                    const imageUrl = image.image_url ?? image.url;
                    return (
                      <figure
                        className="overflow-hidden rounded-xl border border-line bg-slate-50"
                        key={image.id}
                      >
                        {imageUrl ? (
                          <GalleryImage
                            alt={image.original_filename || "Property image"}
                            url={imageUrl}
                          />
                        ) : (
                          <div className="flex aspect-[4/3] items-center justify-center text-sm font-semibold text-muted">
                            Image unavailable
                          </div>
                        )}
                        <figcaption className="px-3 py-2 text-xs font-semibold capitalize text-muted">
                          {image.image_type.replaceAll("_", " ")}
                          {image.original_filename
                            ? ` · ${image.original_filename}`
                            : ""}
                        </figcaption>
                      </figure>
                    );
                  })}
                </div>
              </section>
            )}

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <section className="rounded-2xl border border-line bg-white p-5 shadow-sm md:p-7">
                <h2 className="text-lg font-extrabold text-ink">
                  Location and property
                </h2>
                <div className="mt-3">
                  <DetailField label="Address" value={listing.address} />
                  <DetailField label="Area" value={listing.area} />
                  <DetailField label="City" value={listing.city} />
                  <DetailField
                    label="Property type"
                    value={listing.property_type}
                  />
                  <DetailField
                    label="Gender preference"
                    value={listing.gender}
                  />
                  <DetailField label="Latitude" value={listing.latitude} />
                  <DetailField label="Longitude" value={listing.longitude} />
                  <DetailField
                    label="Description"
                    value={listing.description}
                  />
                  <DetailField
                    label="Security deposit"
                    value={
                      listing.security_deposit === null
                        ? null
                        : `₹${listing.security_deposit.toLocaleString("en-IN")}`
                    }
                  />
                  {listing.latitude !== null &&
                    listing.longitude !== null && (
                      <a
                        className="mt-3 inline-block text-sm font-bold text-brand hover:underline"
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${listing.latitude},${listing.longitude}`)}`}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open location in Maps
                      </a>
                    )}
                </div>
              </section>

              <section className="rounded-2xl border border-line bg-white p-5 shadow-sm md:p-7">
                <h2 className="text-lg font-extrabold text-ink">
                  Owner-submitted details
                </h2>
                <div className="mt-3">
                  <DetailField label="Owner name" value={listing.owner_name} />
                  <DetailField label="Owner email" value={listing.owner_email} />
                  <DetailField
                    label="Owner phone"
                    value={listing.owner_phone}
                  />
                  <DetailField
                    label="Owner role"
                    value={listing.owner_user_role}
                  />
                  <DetailField
                    label="Owner account active"
                    value={
                      listing.owner_is_active === null
                        ? null
                        : listing.owner_is_active
                          ? "Yes"
                          : "No"
                    }
                  />
                  <DetailField label="AC type" value={listing.ac_type} />
                  <DetailField
                    label="Food available"
                    value={listing.food_available}
                  />
                  <DetailField label="Food type" value={listing.food_type} />
                  <DetailField
                    label="Breakfast"
                    value={
                      listing.breakfast_start_time || listing.breakfast_end_time
                        ? `${listing.breakfast_start_time || "Not set"} – ${listing.breakfast_end_time || "Not set"}`
                        : null
                    }
                  />
                  <DetailField
                    label="Lunch"
                    value={
                      listing.lunch_start_time || listing.lunch_end_time
                        ? `${listing.lunch_start_time || "Not set"} – ${listing.lunch_end_time || "Not set"}`
                        : null
                    }
                  />
                  <DetailField
                    label="Dinner"
                    value={
                      listing.dinner_start_time || listing.dinner_end_time
                        ? `${listing.dinner_start_time || "Not set"} – ${listing.dinner_end_time || "Not set"}`
                        : null
                    }
                  />
                  <DetailField
                    label="Restrictions"
                    value={listing.restrictions}
                  />
                  <DetailField
                    label="Facilities"
                    value={listing.facilities.join(", ") || null}
                  />
                </div>
              </section>
            </div>

            <section className="mt-5 rounded-2xl border border-line bg-white p-5 shadow-sm md:p-7">
              <h2 className="text-lg font-extrabold text-ink">
                Room sharing options ({listing.sharing.length})
              </h2>
              {listing.sharing.length ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {listing.sharing.map((sharing) => (
                    <article
                      className="rounded-xl border border-line bg-slate-50 p-4"
                      key={sharing.id}
                    >
                      <h3 className="font-extrabold capitalize text-ink">
                        {sharing.sharing_type.replaceAll("_", " ")} sharing
                      </h3>
                      <div className="mt-2 space-y-1 text-sm text-muted">
                        <p>
                          ₹{sharing.monthly_price.toLocaleString("en-IN")} / month
                        </p>
                        <p>
                          {sharing.available_beds} of {sharing.total_beds} beds
                          available
                        </p>
                        <p>AC: {sharing.ac_type}</p>
                        {sharing.floor && <p>Floor: {sharing.floor}</p>}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted">
                  No room sharing details were provided.
                </p>
              )}
            </section>

            {listing.status === "rejected" && listing.rejection_reason && (
              <section className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5">
                <h2 className="font-extrabold text-red-900">
                  Previous rejection reason
                </h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-red-800">
                  {listing.rejection_reason}
                </p>
              </section>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminListingDetailPage() {
  return <PropertyDetailContent />;
}
