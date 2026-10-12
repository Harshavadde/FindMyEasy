
import { API_BASE_URL, ApiError } from "../constants/api";
import { getSavedToken } from "./auth";
import type { Listing } from "../types/listing";

type FavoriteItem = {
  listing_id: string;
  created_at: string;
  listing: Listing;
};

type FavoriteActionResponse = {
  message: string;
  listing_id: string;
};

async function favoriteRequest<T>(
  path: string,
  method: "GET" | "POST" | "DELETE" = "GET"
): Promise<T> {
  const token = await getSavedToken();

  if (!token) {
    throw new Error("Please log in to manage your favorites.");
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new Error("Unable to reach the server. Please try again.");
  }

  const raw = await response.text();
  let data: any = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const detail =
      typeof data?.detail === "string"
        ? data.detail
        : `Favorites request failed (${response.status}).`;

    throw new ApiError("http", detail, response.status);
  }

  return data as T;
}

export async function addFavorite(
  listingId: string
): Promise<FavoriteActionResponse> {
  return favoriteRequest<FavoriteActionResponse>(
    `/api/v1/favorites/${encodeURIComponent(listingId)}`,
    "POST"
  );
}

export async function removeFavorite(
  listingId: string
): Promise<FavoriteActionResponse> {
  return favoriteRequest<FavoriteActionResponse>(
    `/api/v1/favorites/${encodeURIComponent(listingId)}`,
    "DELETE"
  );
}

export async function getFavoriteIds(): Promise<string[]> {
  const favorites = await favoriteRequest<FavoriteItem[]>(
    "/api/v1/favorites"
  );

  return favorites.map((favorite) => favorite.listing_id);
}

export async function getFavoriteListings(): Promise<Listing[]> {
  const favorites = await favoriteRequest<FavoriteItem[]>(
    "/api/v1/favorites"
  );

  return favorites.map((favorite) => favorite.listing);
}
