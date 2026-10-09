import { API_BASE_URL } from "../constants/api";

import type {
  HostelMember,
  MemberStats,
} from "../types/member";

export type AddMemberInput = {
  ownerPhone: string;

  name: string;
  phone: string;

  sharingId: string;
  roomNumber: string;

  amountToPay: number;
  amountPaid: number;

  foodPreference: "veg" | "non_veg";

  joiningDate: string;
  leavingDate?: string;

  aadhaarPhotoUri?: string;
};

/**
 * Get all members of a listing.
 */
export async function getMembers(
  listingId: string,
  ownerPhone: string,
): Promise<HostelMember[]> {
  const url =
    `${API_BASE_URL}/api/v1/owner/listings/` +
    `${listingId}/members` +
    `?owner_phone=${encodeURIComponent(ownerPhone)}`;

  const response = await fetch(url);

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.detail || "Failed to load members.",
    );
  }

  return data;
}


/**
 * Get member dashboard statistics.
 */
export async function getMemberStats(
  listingId: string,
  ownerPhone: string,
): Promise<MemberStats> {
  const url =
    `${API_BASE_URL}/api/v1/owner/listings/` +
    `${listingId}/members/stats` +
    `?owner_phone=${encodeURIComponent(ownerPhone)}`;

  const response = await fetch(url);

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.detail || "Failed to load member statistics.",
    );
  }

  return data;
}


/**
 * Add a new member.
 *
 * Uses multipart/form-data because Aadhaar
 * photo is optional.
 */
export async function addMember(
  listingId: string,
  input: AddMemberInput,
): Promise<HostelMember> {
  const formData = new FormData();

  formData.append(
    "owner_phone",
    input.ownerPhone,
  );

  formData.append(
    "name",
    input.name,
  );

  formData.append(
    "phone",
    input.phone,
  );

  formData.append(
    "sharing_id",
    input.sharingId,
  );

  formData.append(
    "room_number",
    input.roomNumber,
  );

  formData.append(
    "amount_to_pay",
    String(input.amountToPay),
  );

  formData.append(
    "amount_paid",
    String(input.amountPaid),
  );

  formData.append(
    "food_preference",
    input.foodPreference,
  );

  formData.append(
    "joining_date",
    input.joiningDate,
  );

  if (input.leavingDate) {
    formData.append(
      "leaving_date",
      input.leavingDate,
    );
  }

  if (input.aadhaarPhotoUri) {
    const filename =
      input.aadhaarPhotoUri.split("/").pop() ||
      `aadhaar_${Date.now()}.jpg`;

    const extension =
      filename.split(".").pop()?.toLowerCase();

    let mimeType = "image/jpeg";

    if (extension === "png") {
      mimeType = "image/png";
    } else if (extension === "webp") {
      mimeType = "image/webp";
    }

    formData.append(
      "aadhaar_photo",
      {
        uri: input.aadhaarPhotoUri,
        name: filename,
        type: mimeType,
      } as any,
    );
  }

  const url =
    `${API_BASE_URL}/api/v1/owner/listings/` +
    `${listingId}/members`;

  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.detail || "Failed to add member.",
    );
  }

  return data;
}


/**
 * Get one member.
 */
export async function getMember(
  listingId: string,
  memberId: string,
  ownerPhone: string,
): Promise<HostelMember> {
  const url =
    `${API_BASE_URL}/api/v1/owner/listings/` +
    `${listingId}/members/${memberId}` +
    `?owner_phone=${encodeURIComponent(ownerPhone)}`;

  const response = await fetch(url);

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.detail || "Failed to load member.",
    );
  }

  return data;
}



/**
 * Update an existing member.
 * Uses multipart/form-data so a new Aadhaar photo is optional.
 */

export async function updateMember(
  listingId: string,
  memberId: string,
  input: AddMemberInput,
): Promise<HostelMember> {
  const formData = new FormData();

  formData.append("owner_phone", input.ownerPhone);
  formData.append("name", input.name);
  formData.append("phone", input.phone);
  formData.append("sharing_id", input.sharingId);
  formData.append("room_number", input.roomNumber);
  formData.append("amount_to_pay", String(input.amountToPay));
  formData.append("amount_paid", String(input.amountPaid));
  formData.append("food_preference", input.foodPreference);
  formData.append("joining_date", input.joiningDate);

  if (input.leavingDate) {
    formData.append("leaving_date", input.leavingDate);
  }

  if (input.aadhaarPhotoUri) {
    const filename =
      input.aadhaarPhotoUri.split("/").pop() ||
      `aadhaar_${Date.now()}.jpg`;

    const extension = filename.split(".").pop()?.toLowerCase();

    const mimeType =
      extension === "png"
        ? "image/png"
        : extension === "webp"
          ? "image/webp"
          : "image/jpeg";

    formData.append(
      "aadhaar_photo",
      {
        uri: input.aadhaarPhotoUri,
        name: filename,
        type: mimeType,
      } as any,
    );
  }

  const url =
    `${API_BASE_URL}/api/v1/owner/listings/` +
    `${encodeURIComponent(listingId)}/members/` +
    `${encodeURIComponent(memberId)}` +
    `?owner_phone=${encodeURIComponent(input.ownerPhone)}`;

  const response = await fetch(url, {
    method: "PUT",
    body: formData,
  });

  let data: any = null;

  try {
    const responseText = await response.text();
    data = responseText ? JSON.parse(responseText) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const detail = data?.detail;
    let message = "Failed to update member.";

    if (typeof detail === "string") {
      message = detail;
    } else if (Array.isArray(detail)) {
      message = detail
        .map((item: any) => {
          const field = Array.isArray(item.loc)
            ? item.loc.slice(1).join(".")
            : "";

          const reason =
            item.msg ?? JSON.stringify(item);

          return field ? `${field}: ${reason}` : reason;
        })
        .join("\n");
    } else if (detail && typeof detail === "object") {
      message = JSON.stringify(detail);
    } else if (typeof data?.message === "string") {
      message = data.message;
    } else if (data) {
      message = JSON.stringify(data);
    } else {
      message = `Update failed with HTTP ${response.status}.`;
    }

    throw new Error(message);
  }

  return data as HostelMember;
}




/**
 * Delete a member.
 */
export async function deleteMember(
  listingId: string,
  memberId: string,
  ownerPhone: string,
): Promise<{ message: string }> {
  const url =
    `${API_BASE_URL}/api/v1/owner/listings/` +
    `${listingId}/members/${memberId}` +
    `?owner_phone=${encodeURIComponent(ownerPhone)}`;

  const response = await fetch(url, {
    method: "DELETE",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.detail || "Failed to delete member.",
    );
  }

  return data;
}