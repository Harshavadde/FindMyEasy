"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ApiError,
  getCurrentAdmin,
  invalidateAdminReadCache,
  type AdminListingFilters,
  type AdminUser,
  type OwnerApplicationRelationship,
  type OwnerApplicationStatus,
} from "@/services/api";
import {
  clearAdminToken,
  getAdminToken,
} from "@/services/tokenStorage";

export type AdminSection = "owner-applications" | "listings" | "profile";

type AdminConsoleContextValue = {
  token: string;
  user: AdminUser;
  signOut: () => void;
  getReviewViewState: () => AdminReviewViewState;
  saveReviewViewState: (state: AdminReviewViewState) => void;
};

export type AdminReviewViewState = {
  listings?: {
    search: string;
    status: AdminListingFilters["status"] | "";
    city: string;
    sortBy: AdminListingFilters["sort_by"];
    sortOrder: AdminListingFilters["sort_order"];
    page: number;
  };
  ownerApplications?: {
    search: string;
    status: OwnerApplicationStatus | "";
    city: string;
    relationship: OwnerApplicationRelationship | "";
    submittedFrom: string;
    submittedTo: string;
    sortBy: "submitted_at" | "applicant_name" | "status" | "application_reference";
    sortOrder: "asc" | "desc";
    page: number;
  };
};

const AdminConsoleContext = createContext<AdminConsoleContextValue | null>(null);

export function useAdminConsole() {
  const context = useContext(AdminConsoleContext);
  if (!context) {
    throw new Error("useAdminConsole must be used within AdminConsoleShell.");
  }
  return context;
}

export function AdminConsoleShell({
  activeSection,
  title,
  children,
}: {
  activeSection: AdminSection;
  title: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const reviewViewState = useRef<AdminReviewViewState>({});

  const signOut = useCallback(() => {
    invalidateAdminReadCache();
    clearAdminToken();
    router.replace("/login?role=admin");
  }, [router]);

  const verifySession = useCallback(async (signal?: AbortSignal) => {
    setIsCheckingSession(true);
    setSessionError("");
    try {
      const savedToken = getAdminToken();
      if (!savedToken) {
        router.replace("/login?role=admin");
        return;
      }

      const currentUser = await getCurrentAdmin(savedToken, signal);
      if (signal?.aborted) return;
      if (currentUser.user_role !== "ADMIN") {
        signOut();
        return;
      }
      setToken(savedToken);
      setUser(currentUser);
    } catch (error) {
      if (signal?.aborted) return;
      if (
        (error instanceof ApiError && [401, 403].includes(error.status)) ||
        (error instanceof Error && /administrator access/i.test(error.message))
      ) {
        signOut();
      } else {
        setSessionError(
          error instanceof Error
            ? error.message
            : "Unable to verify your Admin session."
        );
      }
    } finally {
      if (!signal?.aborted) setIsCheckingSession(false);
    }
  }, [router, signOut]);

  const getReviewViewState = useCallback(
    () => reviewViewState.current,
    []
  );
  const saveReviewViewState = useCallback((state: AdminReviewViewState) => {
    reviewViewState.current = state;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void verifySession(controller.signal);
    return () => controller.abort();
  }, [verifySession]);

  const contextValue = useMemo(
    () =>
      user && token
        ? { token, user, signOut, getReviewViewState, saveReviewViewState }
        : null,
    [getReviewViewState, saveReviewViewState, signOut, token, user]
  );

  if (isCheckingSession) {
    return (
      <main
        aria-label="Verifying administrator session"
        className="min-h-screen bg-slate-50 p-6"
      >
        <div className="mx-auto max-w-5xl">
          <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-200" />
          <div className="mt-8 h-10 w-64 animate-pulse rounded-lg bg-slate-200" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                className="h-28 animate-pulse rounded-2xl bg-white"
                key={index}
              />
            ))}
          </div>
          <p className="mt-6 text-sm font-semibold text-muted">
            Verifying administrator session...
          </p>
        </div>
      </main>
    );
  }

  if (sessionError) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <section className="w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-card">
          <h1 className="text-lg font-extrabold text-ink">
            Could not verify your session
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">{sessionError}</p>
          <button
            className="mt-5 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white"
            onClick={() => void verifySession()}
            type="button"
          >
            Retry
          </button>
        </section>
      </main>
    );
  }

  if (!contextValue || !user) return null;

  return (
    <AdminConsoleContext.Provider value={contextValue}>
      <div className="min-h-screen md:h-screen md:overflow-hidden">
        <aside className="sticky top-0 z-30 flex max-h-screen w-full flex-col bg-ink px-5 py-4 text-white md:fixed md:inset-y-0 md:left-0 md:w-64 md:overflow-y-auto md:px-6 md:py-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand font-black">
              F
            </div>
            <div>
              <p className="font-extrabold">FindEasy</p>
              <p className="text-[10px] font-bold tracking-widest text-slate-400">
                ADMIN CONSOLE
              </p>
            </div>
          </div>

          <nav
            aria-label="Admin modules"
            className="mt-5 flex gap-2 overflow-x-auto md:mt-10 md:flex-col md:overflow-x-hidden"
          >
            <Link
              aria-current={
                activeSection === "owner-applications" ? "page" : undefined
              }
              className={`shrink-0 rounded-xl px-4 py-3 text-sm font-bold ${
                activeSection === "owner-applications"
                  ? "bg-white/10 text-white"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
              href="/dashboard/owner-applications"
            >
              <span aria-hidden="true" className="mr-2">◉</span>
              Initial Request Review
            </Link>
            <Link
              aria-current={activeSection === "listings" ? "page" : undefined}
              className={`shrink-0 rounded-xl px-4 py-3 text-sm font-bold ${
                activeSection === "listings"
                  ? "bg-white/10 text-white"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
              href="/dashboard"
            >
              <span aria-hidden="true" className="mr-2">▦</span>
              Listing Review
            </Link>
          </nav>

          <details className="group mt-5 border-t border-white/10 pt-4 md:mt-auto">
            <summary
              aria-label="Administrator profile menu"
              className="flex cursor-pointer list-none items-center gap-3 rounded-xl p-2 hover:bg-white/10 [&::-webkit-details-marker]:hidden"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-extrabold">
                {(user.full_name || "Admin")
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase())
                  .join("")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">
                  {user.full_name || "Administrator"}
                </span>
                <span className="block text-xs text-slate-300">Administrator</span>
              </span>
              <span aria-hidden="true" className="text-slate-300">⌄</span>
            </summary>
            <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-2">
              <Link
                className="block rounded-lg px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10"
                href="/dashboard/profile"
              >
                View profile
              </Link>
              <Link
                className="block rounded-lg px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10"
                href="/dashboard/profile#account-details"
              >
                Account details
              </Link>
              <button
                className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-100 hover:bg-white/10"
                onClick={signOut}
                type="button"
              >
                Sign out
              </button>
            </div>
          </details>
        </aside>

        <main className="min-w-0 md:ml-64 md:h-screen md:overflow-y-auto">
          <header className="flex min-h-[68px] items-center justify-between border-b border-line bg-white px-5 md:px-8">
            <p className="text-xs font-medium text-muted">
              FindEasy / Admin / {title}
            </p>
          </header>
          <div className="mx-auto max-w-[1600px] px-4 py-7 md:px-8">
            {children}
          </div>
        </main>
      </div>
    </AdminConsoleContext.Provider>
  );
}
