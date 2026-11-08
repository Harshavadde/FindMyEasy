import type {
  AdminListingContract,
  AdminListingSummaryContract,
  ListingImageContract,
} from "@shared/contracts/listings";

const API_PREFIX = "/api/backend";
const REQUEST_TIMEOUT_MS = 10_000;
export type {
  AdminListingContract,
  AdminListingSummaryContract,
  ListingImageContract,
};

export type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone_number: string | null;
  user_role: "SEEKER" | "OWNER" | "ADMIN";
  is_active: boolean;
  created_at: string | null;
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

export type AdminAccountInput = {
  full_name: string;
  phone_number: string;
  email?: string;
  password: string;
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

export type AdminOwnerApplicationDeletionResult = {
  application_id: string;
  application_reference: string;
  deleted_history_records: number;
  deleted_invitation_records: number;
  deleted_linked_owner_account: boolean;
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

export type AdminListingFilters = {
  search?: string;
  status?: "review" | "published" | "rejected";
  city?: string;
  sort_by?: "created_at" | "name" | "city" | "monthly_price" | "status";
  sort_order?: "asc" | "desc";
  page: number;
  page_size: number;
};

export type AdminListingPage = {
  items: AdminListingSummaryContract[];
  cities: string[];
  total: number;
  total_listings: number;
  review_count: number;
  published_count: number;
  rejected_count: number;
  page: number;
  page_size: number;
  total_pages: number;
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

export function normalizeIndianPhoneInput(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 14 && digits.startsWith("0091")) {
    digits = digits.slice(4);
  } else if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  if (digits.length > 10) return "";
  return digits.slice(0, 10);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const externalSignal = options.signal;
  const abortRequest = () => controller.abort();
  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener("abort", abortRequest, { once: true });
  }
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
    if (timedOut) {
      throw new ApiError(
        "The Admin API did not respond within 10 seconds. Check your connection and retry.",
        408
      );
    }
    if (error instanceof TypeError) {
      throw new Error(
        "Could not reach the FindEasy Admin API. Check your connection and hosted API configuration."
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortRequest);
  }
}

const OWNER_APPLICATION_STATS_CACHE_MS = 30_000;
const ownerApplicationStatsCache = new Map<
  string,
  { expiresAt: number; value: AdminOwnerApplicationStats }
>();
const ownerApplicationStatsInFlight = new Map<
  string,
  Promise<AdminOwnerApplicationStats>
>();

export function invalidateAdminReadCache(token?: string) {
  if (token) {
    ownerApplicationStatsCache.delete(token);
    ownerApplicationStatsInFlight.delete(token);
  } else {
    ownerApplicationStatsCache.clear();
    ownerApplicationStatsInFlight.clear();
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
      phone_number: `+91${normalizeIndianPhoneInput(phoneNumber)}`,
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
  token: string,
  filters: AdminListingFilters,
  signal?: AbortSignal
): Promise<AdminListingPage> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }
  return request<AdminListingPage>(
    `/api/v1/admin/listings?${query.toString()}`,
    { signal },
    token
  );
}

export function getAdminAccounts(
  token: string,
  signal?: AbortSignal
): Promise<AdminUser[]> {
  return request<AdminUser[]>("/api/v1/admin/administrators", { signal }, token);
}

export function createAdminAccount(
  token: string,
  input: AdminAccountInput
): Promise<AdminUser> {
  return request<AdminUser>(
    "/api/v1/admin/administrators",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    token
  ).then((result) => {
    invalidateAdminReadCache(token);
    return result;
  });
}

export function disableAdminAccount(
  token: string,
  adminId: string
): Promise<AdminUser> {
  return request<AdminUser>(
    `/api/v1/admin/administrators/${encodeURIComponent(adminId)}/disable`,
    { method: "POST" },
    token
  ).then((result) => {
    invalidateAdminReadCache(token);
    return result;
  });
}

export function getAdminListing(
  token: string,
  listingId: string,
  signal?: AbortSignal
): Promise<AdminListingContract> {
  return request<AdminListingContract>(
    `/api/v1/admin/listings/${encodeURIComponent(listingId)}`,
    { signal },
    token
  );
}

export function updateListingStatus(
  token: string,
  listingId: string,
  status: "published" | "rejected",
  rejectionReason?: string
): Promise<AdminListingContract> {
  return request<AdminListingContract>(
    `/api/v1/admin/listings/${encodeURIComponent(listingId)}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        ...(status === "rejected"
          ? { rejection_reason: rejectionReason }
          : {}),
      }),
    },
    token
  ).then((result) => {
    invalidateAdminReadCache(token);
    return result;
  });
}

export function getAdminOwnerApplicationStats(
  token: string
): Promise<AdminOwnerApplicationStats> {
  const cached = ownerApplicationStatsCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.value);
  }
  const existing = ownerApplicationStatsInFlight.get(token);
  if (existing) return existing;
  const pending = request<AdminOwnerApplicationStats>(
    "/api/v1/admin/owner-applications/stats",
    {},
    token
  ).then((result) => {
    if (ownerApplicationStatsInFlight.get(token) === pending) {
      ownerApplicationStatsCache.set(token, {
        expiresAt: Date.now() + OWNER_APPLICATION_STATS_CACHE_MS,
        value: result,
      });
    }
    return result;
  });
  ownerApplicationStatsInFlight.set(token, pending);
  return pending.finally(() => {
    if (ownerApplicationStatsInFlight.get(token) === pending) {
      ownerApplicationStatsInFlight.delete(token);
    }
  });
}

export function getAdminOwnerApplications(
  token: string,
  filters: AdminOwnerApplicationFilters,
  signal?: AbortSignal
): Promise<AdminOwnerApplicationPage> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }
  return request<AdminOwnerApplicationPage>(
    `/api/v1/admin/owner-applications?${query.toString()}`,
    { signal },
    token
  );
}

export function getAdminOwnerApplication(
  token: string,
  applicationId: string,
  signal?: AbortSignal
): Promise<AdminOwnerApplicationDetail> {
  return request<AdminOwnerApplicationDetail>(
    `/api/v1/admin/owner-applications/${encodeURIComponent(applicationId)}`,
    { signal },
    token
  );
}

export function deleteAdminOwnerApplication(
  token: string,
  applicationId: string,
  applicationReference: string
): Promise<AdminOwnerApplicationDeletionResult> {
  return request<AdminOwnerApplicationDeletionResult>(
    `/api/v1/admin/owner-applications/${encodeURIComponent(applicationId)}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ application_reference: applicationReference }),
    },
    token
  ).then((result) => {
    invalidateAdminReadCache(token);
    return result;
  });
}

export function approveAdminOwnerApplication(
  token: string,
  applicationId: string
): Promise<AdminApplicationDecisionResult> {
  return request<AdminApplicationDecisionResult>(
    `/api/v1/admin/owner-applications/${encodeURIComponent(applicationId)}/approve`,
    { method: "POST" },
    token
  ).then((result) => {
    invalidateAdminReadCache(token);
    return result;
  });
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
  ).then((result) => {
    invalidateAdminReadCache(token);
    return result;
  });
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
  ).then((result) => {
    invalidateAdminReadCache(token);
    return result;
  });
}

export function getAdminOwnerInvitations(
  token: string,
  applicationId: string,
  signal?: AbortSignal
): Promise<{ items: AdminOwnerInvitation[] }> {
  return request<{ items: AdminOwnerInvitation[] }>(
    `/api/v1/admin/owner-applications/${encodeURIComponent(applicationId)}/invitations`,
    { signal },
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
  ).then((result) => {
    invalidateAdminReadCache(token);
    return result;
  });
}

export function revokeAdminOwnerInvitation(
  token: string,
  invitationId: string
): Promise<AdminOwnerInvitation> {
  return request<AdminOwnerInvitation>(
    `/api/v1/admin/owner-applications/invitations/${encodeURIComponent(invitationId)}/revoke`,
    { method: "POST" },
    token
  ).then((result) => {
    invalidateAdminReadCache(token);
    return result;
  });
}

export function getCurrentAdmin(
  token: string,
  signal?: AbortSignal
): Promise<AdminUser> {
  return request<AdminUser>("/api/v1/auth/me", { signal }, token);
}

export function apiImageUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_PREFIX}${value.startsWith("/") ? "" : "/"}${value}`;
}
