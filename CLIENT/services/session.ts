import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

export const TOKEN_KEY = "findeasy_access_token";
export const ROLE_KEY = "findeasy_user_role";
export const OWNER_PROFILE_KEY = "findmyeasy_owner_profile";

const CLEARED_SESSION_KEY = "findeasy_session_cleared";

type SessionInvalidationListener = () => void;

let sessionGeneration = 0;
let sessionEnding = false;
let sessionDisabled = false;
let logoutPromise: Promise<void> | null = null;
let authFailureNotified = false;

const activeOwnerRequests = new Set<AbortController>();
const sessionInvalidationListeners = new Set<SessionInvalidationListener>();

export function getSessionGeneration(): number {
  return sessionGeneration;
}

export function isSessionEnding(): boolean {
  return sessionEnding || sessionDisabled;
}

export function subscribeToSessionInvalidation(
  listener: SessionInvalidationListener
): () => void {
  sessionInvalidationListeners.add(listener);
  return () => sessionInvalidationListeners.delete(listener);
}

export function trackOwnerRequest(controller: AbortController): () => void {
  if (isSessionEnding()) {
    controller.abort();
    return () => undefined;
  }

  activeOwnerRequests.add(controller);
  return () => activeOwnerRequests.delete(controller);
}

export async function getAccessToken(): Promise<string | null> {
  if (isSessionEnding()) {
    return null;
  }

  const clearedMarker = await AsyncStorage.getItem(CLEARED_SESSION_KEY);
  if (clearedMarker === "1") {
    sessionDisabled = true;
    return null;
  }

  if (isSessionEnding()) {
    return null;
  }

  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveAccessToken(token: string): Promise<void> {
  if (sessionEnding) {
    throw new Error("A sign-out is already in progress.");
  }

  const generation = sessionGeneration;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await AsyncStorage.removeItem(CLEARED_SESSION_KEY);

  if (generation !== sessionGeneration || sessionEnding) {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    throw new Error("Login was canceled because the session changed.");
  }

  sessionDisabled = false;
  authFailureNotified = false;
  sessionGeneration += 1;
}

export async function saveUserRole(role: "user" | "owner"): Promise<void> {
  if (isSessionEnding()) {
    throw new Error("A sign-out is already in progress.");
  }

  const generation = sessionGeneration;
  await SecureStore.setItemAsync(ROLE_KEY, role);

  if (generation !== sessionGeneration || sessionEnding) {
    await SecureStore.deleteItemAsync(ROLE_KEY);
    throw new Error("Login was canceled because the session changed.");
  }
}

export async function getSavedUserRole(): Promise<"user" | "owner" | null> {
  if (isSessionEnding()) {
    return null;
  }

  const clearedMarker = await AsyncStorage.getItem(CLEARED_SESSION_KEY);
  if (clearedMarker === "1" || isSessionEnding()) {
    return null;
  }

  const value = await SecureStore.getItemAsync(ROLE_KEY);
  return value === "user" || value === "owner" ? value : null;
}

export function clearSavedSession(): Promise<void> {
  if (logoutPromise) {
    return logoutPromise;
  }

  sessionEnding = true;
  sessionDisabled = true;
  sessionGeneration += 1;

  for (const controller of activeOwnerRequests) {
    controller.abort();
  }
  activeOwnerRequests.clear();

  logoutPromise = Promise.allSettled([
    AsyncStorage.setItem(CLEARED_SESSION_KEY, "1"),
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(ROLE_KEY),
    AsyncStorage.removeItem(OWNER_PROFILE_KEY),
  ])
    .then((results) => {
      if (results.some((result) => result.status === "rejected")) {
        throw new Error("Unable to clear all saved session data.");
      }
    })
    .finally(() => {
      sessionEnding = false;
      sessionGeneration += 1;
      logoutPromise = null;
    });

  return logoutPromise;
}

export async function invalidateSavedSession(): Promise<void> {
  const cleanup = clearSavedSession();
  const shouldNotify = !authFailureNotified;
  authFailureNotified = true;

  try {
    await cleanup;
  } finally {
    if (shouldNotify) {
      for (const listener of sessionInvalidationListeners) {
        listener();
      }
    }
  }
}
