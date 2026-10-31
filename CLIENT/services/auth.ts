
import { API_BASE_URL, getJson, postJson } from "../constants/api";
import {
  clearSavedSession,
  getAccessToken,
  getSavedUserRole as readSavedUserRole,
  saveAccessToken,
  saveUserRole as persistUserRole,
} from "./session";

export type UserRole = "user" | "owner";

export type AuthUser = {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  user_role: "SEEKER" | "OWNER";
  phone: string | null;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};

export function normalizeIndianPhoneNumber(value: string): string {
  const phoneNumber = value.trim();

  if (/^[6-9]\d{9}$/.test(phoneNumber)) {
    return `+91${phoneNumber}`;
  }
  if (/^\+91[6-9]\d{9}$/.test(phoneNumber)) {
    return phoneNumber;
  }

  throw new Error(
    "Enter a valid Indian mobile number as 10 digits or +91 followed by 10 digits."
  );
}

export function getIndianPhoneInputValue(value: string): string {
  const trimmedValue = value.trim();
  const nationalNumber = trimmedValue.startsWith("+91")
    ? trimmedValue.slice(3)
    : trimmedValue;

  return nationalNumber.replace(/\D/g, "").slice(0, 10);
}

async function authenticateWithPhonePassword(
  path: "/api/v1/auth/register" | "/api/v1/auth/login",
  data: {
    phone_number: string;
    password: string;
    full_name?: string;
    user_role?: "SEEKER" | "OWNER";
  }
): Promise<AuthResponse> {
  const result = await postJson<AuthResponse>(path, {
    ...data,
    phone_number: normalizeIndianPhoneNumber(data.phone_number),
  });
  await saveAccessToken(result.access_token);
  return result;
}

export async function registerWithPhonePassword(data: {
  phone_number: string;
  password: string;
  full_name: string;
  user_role: "SEEKER" | "OWNER";
}): Promise<AuthResponse> {
  return authenticateWithPhonePassword("/api/v1/auth/register", data);
}

export async function loginWithPhonePassword(data: {
  phone_number: string;
  password: string;
}): Promise<AuthResponse> {
  return authenticateWithPhonePassword("/api/v1/auth/login", data);
}

export async function getCurrentUser(): Promise<AuthUser> {
  const token = await getSavedToken();

  if (!token) {
    throw new Error("No saved login session.");
  }

  return getJson<AuthUser>("/api/v1/auth/me", 15000, {
    Authorization: `Bearer ${token}`,
  });
}

export async function getSavedToken(): Promise<string | null> {
  return getAccessToken();
}

export async function saveUserRole(role: UserRole): Promise<void> {
  await persistUserRole(role);
}

export async function getSavedUserRole(): Promise<UserRole | null> {
  return readSavedUserRole();
}

export async function logoutUser(): Promise<void> {
  await clearSavedSession();
}

export async function updateCurrentUser(
  fullName: string,
  phone?: string | null
): Promise<AuthUser> {
  const token = await getSavedToken();

  if (!token) {
    throw new Error("Please log in to update your profile.");
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        full_name: fullName.trim(),
        ...(phone !== undefined ? { phone } : {}),
      }),
    });
  } catch {
    throw new Error("Unable to reach the server. Please try again.");
  }

  const raw = await response.text();
  let data: any = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    // Keep data null if the server response is not JSON.
  }

  if (!response.ok) {
    const detail =
      typeof data?.detail === "string"
        ? data.detail
        : "Unable to update your profile.";

    throw new Error(detail);
  }

  if (phone !== undefined && data.phone !== phone) {
    throw new Error(
      "The server did not save your phone number. Please try again or contact support."
    );
  }

  return data as AuthUser;
}
