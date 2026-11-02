const ADMIN_TOKEN_KEY = "findeasy_admin_access_token";

function getBrowserSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.sessionStorage;
  } catch {
    throw new Error("Browser session storage is unavailable.");
  }
}

export function getAdminToken(): string | null {
  const storage = getBrowserSessionStorage();
  return storage?.getItem(ADMIN_TOKEN_KEY) ?? null;
}

export function saveAdminToken(token: string): void {
  const storage = getBrowserSessionStorage();
  if (!storage) {
    throw new Error("Admin tokens can only be saved in a browser.");
  }
  storage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  const storage = getBrowserSessionStorage();
  if (!storage) {
    throw new Error("Admin tokens can only be cleared in a browser.");
  }
  storage.removeItem(ADMIN_TOKEN_KEY);
}
