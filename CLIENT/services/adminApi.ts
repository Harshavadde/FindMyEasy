import { ownerFetch } from "../constants/api";

export type AdminListing = {
  id: string;
  name: string;
  property_type: string;
  gender: string;
  description: string | null;
  monthly_price: number;
  total_beds: number;
  available_beds: number;
  filled_beds: number;
  city: string;
  area: string;c
  address: string;
  owner_phone: string | null;
  status: string;
  facilities: string[];
  images: {
    id: string;
    image_url: string;
    image_type: string;
    original_filename?: string | null;
  }[];
};

async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : `Admin request failed (${response.status}).`
    );
  }
  return data as T;
}

export async function getAdminListings(): Promise<AdminListing[]> {
  const response = await ownerFetch("/api/v1/admin/listings", {
    method: "GET",
  });
  return readResponse<AdminListing[]>(response);
}

export async function updateAdminListingStatus(
  listingId: string,
  status: "published" | "rejected"
): Promise<AdminListing> {
  const response = await ownerFetch(
    `/api/v1/admin/listings/${encodeURIComponent(listingId)}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }
  );
  return readResponse<AdminListing>(response);
}
