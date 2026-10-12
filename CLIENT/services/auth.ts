
import * as SecureStore from "expo-secure-store";
import { postJson, getJson } from "../constants/api";

const TOKEN_KEY = "findeasy_access_token";

export type AuthUser = {
  id: string;
  email: string;
  full_name: string | null;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};

export async function registerUser(data: {
  full_name?: string;
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const result = await postJson<AuthResponse>(
    "/api/v1/auth/register",
    data
  );

  return result;
}

export async function loginUser(data: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const result = await postJson<AuthResponse>(
    "/api/v1/auth/login",
    data
  );

  await SecureStore.setItemAsync(TOKEN_KEY, result.access_token);
  return result;
}

export async function getCurrentUser(): Promise<AuthUser> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);

  if (!token) {
    throw new Error("No saved login session.");
  }

  return getJson<AuthUser>("/api/v1/auth/me", 15000, {
    Authorization: `Bearer ${token}`,
  });
}

export async function getSavedToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function logoutUser(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
