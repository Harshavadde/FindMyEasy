import { API_BASE_URL, ApiError } from "../constants/api";
import type { Listing } from "../types/listing";

async function request<T>(
  path: string,
  timeoutMs = 15000
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new ApiError(
        "timeout",
        `The server at ${API_BASE_URL} did not respond in ${
          timeoutMs / 1000
        } seconds.`
      );
    }

    throw new ApiError(
      "network",
      `Cannot reach the server at ${API_BASE_URL}.`
    );
  } finally {
    clearTimeout(timer);
  }

  const raw = await response.text();

  let data: any = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const detail = data?.detail;

    throw new ApiError(
      "http",
      typeof detail === "string"
        ? detail
        : raw || `Request failed with status ${response.status}.`,
      response.status
    );
  }

  return data as T;
}

export type PublicListingsResponse = {
  success: boolean;
  count: number;
  listings: Listing[];
};

export async function getPublicListings(
  params: {
    city?: string;
    area?: string;
    property_type?: string;
    gender?: string;
    min_price?: number;
    max_price?: number;
  } = {}
): Promise<Listing[]> {
  const searchParams = new URLSearchParams();

  if (params.city?.trim()) {
    searchParams.set(
      "city",
      params.city.trim()
    );
  }

  if (params.area?.trim()) {
    searchParams.set(
      "area",
      params.area.trim()
    );
  }

  if (params.property_type?.trim()) {
    searchParams.set(
      "property_type",
      params.property_type.trim()
    );
  }

  if (params.gender?.trim()) {
    searchParams.set(
      "gender",
      params.gender.trim()
    );
  }

  if (params.min_price !== undefined) {
    searchParams.set(
      "min_price",
      String(params.min_price)
    );
  }

  if (params.max_price !== undefined) {
    searchParams.set(
      "max_price",
      String(params.max_price)
    );
  }

  const query = searchParams.toString();

  const result =
    await request<PublicListingsResponse>(
      `/api/v1/listings${query ? `?${query}` : ""}`
    );

  return result.listings;
}

export async function getPublicListing(
  listingId: string
): Promise<Listing> {
  return request<Listing>(
    `/api/v1/listings/${encodeURIComponent(listingId)}`
  );
}