"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ApiError,
  getCurrentAdmin,
  type AdminUser,
} from "@/services/api";
import {
  clearAdminToken,
  getAdminToken,
} from "@/services/tokenStorage";

type AdminSection = "owner-applications" | "listings";

type AdminConsoleContextValue = {
  token: string;
  user: AdminUser;
  signOut: () => void;
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

  const signOut = useCallback(() => {
    clearAdminToken();
    router.replace("/login?role=admin");
  }, [router]);

  const verifySession = useCallback(async () => {
    setIsCheckingSession(true);
    setSessionError("");
    try {
      const savedToken = getAdminToken();
      if (!savedToken) {
        router.replace("/login?role=admin");
        return;
      }

      const currentUser = await getCurrentAdmin(savedToken);
      if (currentUser.user_role !== "ADMIN") {
        signOut();
        return;
      }
      setToken(savedToken);
      setUser(currentUser);
    } catch (error) {
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
      setIsCheckingSession(false);
    }
  }, [router, signOut]);

  useEffect(() => {
    void verifySession();
  }, [verifySession]);

  const contextValue = useMemo(
    () => (user && token ? { token, user, signOut } : null),
    [signOut, token, user]
  );

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm font-semibold text-muted">
        Verifying administrator session...
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
      <div className="min-h-screen md:flex">
        <aside className="bg-ink px-5 py-5 text-white md:flex md:w-60 md:shrink-0 md:flex-col md:px-6 md:py-8">
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
            className="mt-6 flex gap-2 overflow-x-auto md:mt-10 md:flex-col"
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
              <span aria-hidden="true" className="mr-2">
                ◉
              </span>
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
              <span aria-hidden="true" className="mr-2">
                ▦
              </span>
              Listing Review
            </Link>
          </nav>

          <p className="mt-6 hidden text-xs leading-5 text-slate-300 md:mt-auto md:block">
            Signed in as
            <br />
            <strong className="text-white">
              {user.full_name || "Administrator"}
            </strong>
          </p>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="flex min-h-[68px] items-center justify-between border-b border-line bg-white px-5 md:px-8">
            <p className="text-xs font-medium text-muted">
              FindEasy / Admin / {title}
            </p>
            <div className="flex items-center gap-3">
              <span className="hidden text-xs font-semibold text-muted sm:inline">
                {user.full_name || "Administrator"}
              </span>
              <button
                className="rounded-lg px-3 py-2 text-xs font-bold text-ink hover:bg-slate-50"
                onClick={signOut}
                type="button"
              >
                Sign out
              </button>
            </div>
          </header>
          <div className="mx-auto max-w-[1600px] px-4 py-7 md:px-8">
            {children}
          </div>
        </main>
      </div>
    </AdminConsoleContext.Provider>
  );
}
