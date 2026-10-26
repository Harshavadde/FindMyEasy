import Constants from "expo-constants";
import {
  getAccessToken,
  getSessionGeneration,
  invalidateSavedSession,
  isSessionEnding,
  trackOwnerRequest,
} from "../services/session";

/**
 * API BASE URL RESOLUTION (in order):
 * 1. EXPO_PUBLIC_API_URL from .env      e.g. EXPO_PUBLIC_API_URL=http://192.168.0.10:8000
 * 2. The IP of the PC running Expo (auto-detected, so it survives IP changes)
 * 3. Local development fallback or the deployed API URL for release builds
 */
const API_PORT = 8000;
const FALLBACK_LAN_IP = "192.168.0.8";
const FALLBACK_API_URL =
  "https://findeasy-api-10137192097.development.catalystappsail.com";

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

function resolveBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/+$/, "");
  }

  const hostUri: string | undefined =
    Constants.expoConfig?.hostUri ??
    (Constants as any).expoGoConfig?.debuggerHost ??
    (Constants as any).manifest?.debuggerHost;

  if (hostUri) {
    const host = hostUri.split(":")[0];
    if (IPV4.test(host)) {
      return `http://${host}:${API_PORT}`;
    }
  }

  return __DEV__
    ? `http://${FALLBACK_LAN_IP}:${API_PORT}`
    : FALLBACK_API_URL;
}

export const API_BASE_URL = resolveBaseUrl();

export type ApiErrorKind = "auth" | "network" | "timeout" | "http";

type OwnerFetchImplementation = (
  url: string,
  options?: RequestInit
) => Promise<Response>;

export async function ownerFetch(
  path: string,
  options: RequestInit = {},
  fetchImplementation: OwnerFetchImplementation = fetch
): Promise<Response> {
  if (isSessionEnding()) {
    throw createSessionAbortError();
  }

  const generation = getSessionGeneration();
  const token = await getAccessToken();

  if (isSessionEnding() || generation !== getSessionGeneration()) {
    throw createSessionAbortError();
  }

  if (!token) {
    await invalidateSavedSession();
    throw new ApiError(
      "auth",
      "Your owner session is not available. Please sign in again."
    );
  }

  const controller = new AbortController();
  const releaseRequest = trackOwnerRequest(controller);
  const callerSignal = options.signal;
  const abortFromCaller = () => controller.abort();

  if (callerSignal?.aborted) {
    controller.abort();
  } else {
    callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  const headers = new Headers(options.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  headers.set("Authorization", `Bearer ${token}`);

  const url = /^https?:\/\//i.test(path)
    ? path
    : `${API_BASE_URL}${path}`;

  try {
    if (controller.signal.aborted) {
      throw createSessionAbortError();
    }

    const response = await fetchImplementation(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (isSessionEnding() || generation !== getSessionGeneration()) {
      throw createSessionAbortError();
    }

    if (response.status === 401) {
      const message = await getUnauthorizedMessage(response);
      await invalidateSavedSession();
      throw new ApiError("http", message, 401);
    }

    return response;
  } finally {
    callerSignal?.removeEventListener("abort", abortFromCaller);
    releaseRequest();
  }
}

function createSessionAbortError(): Error {
  const error = new Error("The request was canceled because the session ended.");
  error.name = "AbortError";
  return error;
}

export class ApiError extends Error {
  kind: ApiErrorKind;
  status?: number;

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

/** Turns FastAPI error bodies (string or 422 array) into readable text. */
function extractMessage(data: any, raw: string, status: number): string {
  const detail = data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item: any) => {
        const field = Array.isArray(item?.loc)
          ? item.loc.filter((p: any) => p !== "body").join(".")
          : "";
        return field ? `${field}: ${item?.msg}` : String(item?.msg ?? "");
      })
      .filter(Boolean)
      .join("\n");
  }

  return raw || `Request failed with status ${status}.`;
}

async function getUnauthorizedMessage(response: Response): Promise<string> {
  const raw = await response.clone().text();
  let data: any = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  const detail = data?.detail;
  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return extractMessage(data, "", response.status);
  }

  return "Your session has expired or is invalid. Please sign in again.";
}

export async function postJson<T = any>(
  path: string,
  body: unknown,
  timeoutMs = 15000
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new ApiError(
        "timeout",
        `The server at ${API_BASE_URL} did not respond in ${timeoutMs / 1000
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
    throw new ApiError(
      "http",
      extractMessage(data, raw, response.status),
      response.status
    );
  }

  return data as T;
}


export async function getJson<T = any>(
  path: string,
  timeoutMs = 15000,
  headers: Record<string, string> = {}
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
        ...headers,
      },
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new ApiError(
        "timeout",
        `The server at ${API_BASE_URL} did not respond in ${timeoutMs / 1000
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
    throw new ApiError(
      "http",
      extractMessage(data, raw, response.status),
      response.status
    );
  }

  return data as T;
}