
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
  email: string;
  full_name: string | null;
  phone: string | null;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};

export async function registerUser(data: {
  full_name: string;
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return postJson<AuthResponse>("/api/v1/auth/register", data);
}

export async function loginUser(data: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const result = await postJson<AuthResponse>("/api/v1/auth/login", data);
  await saveAccessToken(result.access_token);
  return result;
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
  phone: string | null
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
        phone,
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

  if (
    typeof data?.phone !== "string" &&
    !(phone === null && data?.phone === null)
  ) {
    throw new Error(
      "Phone numbers are not supported by the server yet. Deploy or restart the updated backend, then try again."
    );
  }

  if (data.phone !== phone) {
    throw new Error(
      "The server did not save your phone number. Please try again or contact support."
    );
  }

  return data as AuthUser;
}
