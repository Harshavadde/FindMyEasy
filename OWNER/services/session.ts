import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

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

function getStoredSecret(key: string): Promise<string | null> {
  return Platform.OS === "web"
    ? Promise.resolve(globalThis.sessionStorage.getItem(key))
    : SecureStore.getItemAsync(key);
}

function setStoredSecret(key: string, value: string): Promise<void> {
  return Platform.OS === "web"
    ? Promise.resolve(globalThis.sessionStorage.setItem(key, value))
    : SecureStore.setItemAsync(key, value);
}

function deleteStoredSecret(key: string): Promise<void> {
  return Platform.OS === "web"
    ? Promise.resolve(globalThis.sessionStorage.removeItem(key))
    : SecureStore.deleteItemAsync(key);
}

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

  return getStoredSecret(TOKEN_KEY);
}

export async function saveAccessToken(token: string): Promise<void> {
  if (sessionEnding) {
    throw new Error("A sign-out is already in progress.");
  }

  const generation = sessionGeneration;
  await setStoredSecret(TOKEN_KEY, token);
  await AsyncStorage.removeItem(CLEARED_SESSION_KEY);

  if (generation !== sessionGeneration || sessionEnding) {
    await deleteStoredSecret(TOKEN_KEY);
    throw new Error("Login was canceled because the session changed.");
  }

  sessionDisabled = false;
  authFailureNotified = false;
  sessionGeneration += 1;
}

export async function saveUserRole(
  role: "user" | "owner" | "admin"
): Promise<void> {
  if (isSessionEnding()) {
    throw new Error("A sign-out is already in progress.");
  }

  const generation = sessionGeneration;
  await setStoredSecret(ROLE_KEY, role);

  if (generation !== sessionGeneration || sessionEnding) {
    await deleteStoredSecret(ROLE_KEY);
    throw new Error("Login was canceled because the session changed.");
  }
}

export async function getSavedUserRole(): Promise<
  "user" | "owner" | "admin" | null
> {
  if (isSessionEnding()) {
    return null;
  }

  const clearedMarker = await AsyncStorage.getItem(CLEARED_SESSION_KEY);
  if (clearedMarker === "1" || isSessionEnding()) {
    return null;
  }

  const value = await getStoredSecret(ROLE_KEY);
  return value === "user" || value === "owner" || value === "admin"
    ? value
    : null;
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
    deleteStoredSecret(TOKEN_KEY),
    deleteStoredSecret(ROLE_KEY),
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
