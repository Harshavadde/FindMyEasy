import type {
  AdminListingContract,
  ListingImageContract,
} from "@shared/contracts/listings";

const API_PREFIX = "/api/backend";
const REQUEST_TIMEOUT_MS = 10_000;
export const ADMIN_TOKEN_KEY = "findeasy_admin_access_token";
export type { AdminListingContract, ListingImageContract };

export type AdminUser = {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  user_role: "SEEKER" | "OWNER" | "ADMIN";
};

export type AuthResult = {
  access_token: string;
  token_type: string;
  user: AdminUser;
};

export type AdminSetupStatus = {
  available: boolean;
};

export type AdminSetupInput = {
  full_name: string;
  phone_number: string;
  email?: string;
  password: string;
  setup_token: string;
};

export type AdminSetupResult = {
  success: boolean;
  message: string;
};

export type OwnerApplicationStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "ADDITIONAL_INFORMATION_REQUIRED"
  | "APPROVED"
  | "REJECTED"
  | "INVITATION_SENT"
  | "INVITATION_ACCEPTED"
  | "EXPIRED";

export type OwnerApplicationRelationship =
  | "PROPERTY_OWNER"
  | "PROPERTY_MANAGER"
  | "AUTHORIZED_REPRESENTATIVE";

export type AdminOwnerApplicationSummary = {
  id: string;
  application_reference: string;
  applicant_name: string;
  applicant_phone: string;
  applicant_email: string | null;
  relationship_type: OwnerApplicationRelationship;
  pg_name: string;
  city: string;
  area: string;
  submitted_at: string;
  status: OwnerApplicationStatus;
  phone_verified: boolean;
};

export type AdminOwnerApplicationPage = {
  items: AdminOwnerApplicationSummary[];
  cities: string[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

export type AdminOwnerApplicationStats = {
  total_applications: number;
  submitted: number;
  under_review: number;
  additional_information_required: number;
  approved: number;
  rejected: number;
  invitations_sent: number;
  invitations_accepted: number;
  expired: number;
};

export type AdminOwnerApplicationDetail = AdminOwnerApplicationSummary & {
  address: string;
  formatted_address: string | null;
  latitude: number;
  longitude: number;
  google_place_id: string | null;
  google_maps_url: string | null;
  owner_user_id: string | null;
  owner_account_created_at: string | null;
  registration_completed_at: string | null;
  last_updated_at: string | null;
  status_history: {
    action: string;
    previous_status: string | null;
    status: string;
    changed_at: string;
    message: string | null;
    internal_note: string | null;
    performed_by_admin_id: string;
  }[];
  history_available: boolean;
};

export type AdminApplicationDecisionResult = {
  application_id: string;
  status: OwnerApplicationStatus;
  updated_at: string;
};

export type AdminOwnerInvitation = {
  id: string;
  application_id: string;
  status: "ACTIVE" | "EXPIRED" | "REVOKED" | "USED";
  invited_phone: string;
  expires_at: string;
  created_at: string;
  created_by_admin_id: string;
  revoked_at: string | null;
  accepted_at: string | null;
  delivery_channel: string | null;
  delivery_status: "NOT_CONFIGURED" | "PENDING" | "DELIVERED" | "FAILED";
};

export type AdminOwnerInvitationCreated = AdminOwnerInvitation & {
  invitation_url: string;
};

export type AdminOwnerApplicationFilters = {
  search?: string;
  status?: OwnerApplicationStatus;
  city?: string;
  relationship_type?: OwnerApplicationRelationship;
  submitted_from?: string;
  submitted_to?: string;
  sort_by?: "submitted_at" | "applicant_name" | "status" | "application_reference";
  sort_order?: "asc" | "desc";
  page: number;
  page_size: number;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
  timeoutMs?: number
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const controller = new AbortController();
  const timeoutId =
    timeoutMs === undefined
      ? undefined
      : setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_PREFIX}${path}`, {
      ...options,
      headers,
      cache: "no-store",
      signal: controller.signal,
    });

    const raw = await response.text();
    let data: unknown;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      const body = data as { detail?: unknown } | null;
      const detail =
        typeof body?.detail === "string"
          ? body.detail
          : `Request failed with status ${response.status}.`;
      throw new ApiError(detail, response.status);
    }

    return data as T;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ApiError(
        "The Admin API did not respond within 10 seconds. Check that FastAPI is running, then retry.",
        408
      );
    }
    if (error instanceof TypeError) {
      throw new Error(
        "Could not reach the Admin API. Check that FastAPI is running and the Next.js API origin is correct."
      );
    }
    throw error;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

export async function login(
  phoneNumber: string,
  password: string
): Promise<AuthResult> {
  const result = await request<AuthResult>("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone_number: phoneNumber,
      password,
    }),
  });

  if (result.user.user_role !== "ADMIN") {
    throw new Error("This account does not have administrator access.");
  }

  return result;
}

export function getAdminSetupStatus(): Promise<AdminSetupStatus> {
  return request<unknown>(
    "/api/v1/auth/admin-setup/status",
    {},
    undefined,
    REQUEST_TIMEOUT_MS
  ).then((result) => {
    if (
      typeof result !== "object" ||
      result === null ||
      typeof (result as { available?: unknown }).available !== "boolean"
    ) {
      throw new Error("The Admin API returned an invalid setup status response.");
    }
    return result as AdminSetupStatus;
  });
}

export function createInitialAdmin(
  input: AdminSetupInput
): Promise<AdminSetupResult> {
  return request<AdminSetupResult>(
    "/api/v1/auth/admin-setup",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    undefined,
    REQUEST_TIMEOUT_MS
  );
}

export function getAdminListings(
  token: string
): Promise<AdminListingContract[]> {
  return request<AdminListingContract[]>("/api/v1/admin/listings", {}, token);
}

export function updateListingStatus(
  token: string,
  listingId: string,
  status: "published" | "rejected"
): Promise<AdminListingContract> {
  return request<AdminListingContract>(
    `/api/v1/admin/listings/${encodeURIComponent(listingId)}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    },
    token
  );
}

export function getAdminOwnerApplicationStats(
  token: string
): Promise<AdminOwnerApplicationStats> {
  return request<AdminOwnerApplicationStats>(
    "/api/v1/admin/owner-applications/stats",
    {},
    token
  );
}

export function getAdminOwnerApplications(
  token: string,
  filters: AdminOwnerApplicationFilters
): Promise<AdminOwnerApplicationPage> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }
  return request<AdminOwnerApplicationPage>(
    `/api/v1/admin/owner-applications?${query.toString()}`,
    {},
    token
  );
}

export function getAdminOwnerApplication(
  token: string,
  applicationId: string
): Promise<AdminOwnerApplicationDetail> {
  return request<AdminOwnerApplicationDetail>(
    `/api/v1/admin/owner-applications/${encodeURIComponent(applicationId)}`,
    {},
    token
  );
}

export function approveAdminOwnerApplication(
  token: string,
  applicationId: string
): Promise<AdminApplicationDecisionResult> {
  return request<AdminApplicationDecisionResult>(
    `/api/v1/admin/owner-applications/${encodeURIComponent(applicationId)}/approve`,
    { method: "POST" },
    token
  );
}

export function rejectAdminOwnerApplication(
  token: string,
  applicationId: string,
  input: { reason: string; internal_note?: string }
): Promise<AdminApplicationDecisionResult> {
  return request<AdminApplicationDecisionResult>(
    `/api/v1/admin/owner-applications/${encodeURIComponent(applicationId)}/reject`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    token
  );
}

export function requestAdminOwnerApplicationInformation(
  token: string,
  applicationId: string,
  message: string
): Promise<AdminApplicationDecisionResult> {
  return request<AdminApplicationDecisionResult>(
    `/api/v1/admin/owner-applications/${encodeURIComponent(applicationId)}/request-information`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    },
    token
  );
}

export function getAdminOwnerInvitations(
  token: string,
  applicationId: string
): Promise<{ items: AdminOwnerInvitation[] }> {
  return request<{ items: AdminOwnerInvitation[] }>(
    `/api/v1/admin/owner-applications/${encodeURIComponent(applicationId)}/invitations`,
    {},
    token
  );
}

export function createAdminOwnerInvitation(
  token: string,
  applicationId: string
): Promise<AdminOwnerInvitationCreated> {
  return request<AdminOwnerInvitationCreated>(
    `/api/v1/admin/owner-applications/${encodeURIComponent(applicationId)}/invitations`,
    { method: "POST" },
    token
  );
}

export function revokeAdminOwnerInvitation(
  token: string,
  invitationId: string
): Promise<AdminOwnerInvitation> {
  return request<AdminOwnerInvitation>(
    `/api/v1/admin/owner-applications/invitations/${encodeURIComponent(invitationId)}/revoke`,
    { method: "POST" },
    token
  );
}

export function getCurrentAdmin(token: string): Promise<AdminUser> {
  return request<AdminUser>("/api/v1/auth/me", {}, token);
}

export function apiImageUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_PREFIX}${value.startsWith("/") ? "" : "/"}${value}`;
}
