
import { API_BASE_URL } from "../constants/api";
import type { Listing } from "../types/listing";

const BASE = String(API_BASE_URL ?? "").replace(/\/$/, "");

export function resolveImageUrl(raw?: string | null): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;

  const url = raw.trim();

  if (/^(file:|data:)/i.test(url)) return url;

  if (/^https?:\/\//i.test(url)) {
    return url.replace(
      /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i,
      BASE
    );
  }

  return BASE ? `${BASE}/${url.replace(/^\/+/, "")}` : null;
}

export function getCoverUrl(listing: Listing): string | null {
  const images = listing.images ?? [];

  const hasUrl = (image: { url?: string | null }) =>
    typeof image.url === "string" && image.url.trim().length > 0;

  const cover =
    images.find(
      (image) =>
        hasUrl(image) &&
        image.image_type?.trim().toUpperCase() === "COVER"
    ) ?? images.find(hasUrl);

  return resolveImageUrl(cover?.url);
}
