import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { ApiError } from "../constants/api";
import { getPublicListings } from "../services/api";
import {
  getSessionGeneration,
  isSessionEnding,
  subscribeToSessionInvalidation,
} from "../services/session";
import {
  getCurrentUser,
  getSavedToken,
  getSavedUserRole,
  logoutUser,
  saveUserRole,
  type AuthUser,
  type UserRole,
} from "../services/auth";

type SessionStatus = "loading" | "authenticated" | "unauthenticated";

const SESSION_RESTORE_TIMEOUT_MS = 20000;

type AuthContextValue = {
  status: SessionStatus;
  user: AuthUser | null;
  role: UserRole | null;
  restoreSession: () => Promise<void>;
  completeLogin: (user: AuthUser, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function preloadUserListings() {
  void getPublicListings().catch((error: unknown) => {
    console.warn("Unable to preload listings:", error);
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const restoreAttempt = useRef(0);

  const restoreSession = useCallback(async () => {
    const attempt = ++restoreAttempt.current;
    const generation = getSessionGeneration();
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const isCurrentAttempt = () => attempt === restoreAttempt.current;

    const finishUnauthenticated = () => {
      if (!isCurrentAttempt()) {
        return;
      }

      settled = true;
      setUser(null);
      setRole(null);
      setStatus("unauthenticated");
    };

    setStatus("loading");

    try {
      const restoration = (async () => {
        const token = await getSavedToken();

        if (!isCurrentAttempt()) {
          return;
        }

        if (!token || isSessionEnding()) {
          finishUnauthenticated();
          return;
        }

        // A missing role can occur for a session created before role persistence.
        const savedRole = await getSavedUserRole();

        if (savedRole !== "owner") {
          preloadUserListings();
        }

        const currentUser = await getCurrentUser();

        if (!isCurrentAttempt()) {
          return;
        }

        if (
          generation !== getSessionGeneration() ||
          isSessionEnding()
        ) {
          finishUnauthenticated();
          return;
        }

        settled = true;
        setUser(currentUser);
        setRole(savedRole ?? "user");
        setStatus("authenticated");
      })();

      await Promise.race([
        restoration,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            if (isCurrentAttempt()) {
              finishUnauthenticated();
              restoreAttempt.current += 1;
            }

            reject(new Error("Session restoration timed out."));
          }, SESSION_RESTORE_TIMEOUT_MS);
        }),
      ]);
    } catch (error) {
      if (!isCurrentAttempt()) {
        return;
      }

      finishUnauthenticated();

      if (
        error instanceof ApiError &&
        error.kind === "http" &&
        error.status === 401
      ) {
        void logoutUser().catch((cleanupError) => {
          console.error(
            "Unable to clear the invalid saved session.",
            cleanupError
          );
        });
      }
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }

      if (isCurrentAttempt() && !settled) {
        finishUnauthenticated();
      }
    }
  }, []);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  useEffect(
    () =>
      subscribeToSessionInvalidation(() => {
        restoreAttempt.current += 1;
        setUser(null);
        setRole(null);
        setStatus("unauthenticated");
      }),
    []
  );

  const completeLogin = useCallback(
    async (loggedInUser: AuthUser, selectedRole: UserRole) => {
      await saveUserRole(selectedRole);

      // Invalidate any session restoration started before this login.
      restoreAttempt.current += 1;

      if (selectedRole === "user") {
        preloadUserListings();
      }

      setUser(loggedInUser);
      setRole(selectedRole);
      setStatus("authenticated");
    },
    []
  );

  const logout = useCallback(async () => {
    restoreAttempt.current += 1;
    const cleanup = logoutUser();

    try {
      await cleanup;
    } finally {
      setUser(null);
      setRole(null);
      setStatus("unauthenticated");
    }
  }, []);

  const value = useMemo(
    () => ({
      status,
      user,
      role,
      restoreSession,
      completeLogin,
      logout,
    }),
    [status, user, role, restoreSession, completeLogin, logout]
  );

  if (status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.message}>
          Restoring your FindEasy session...
        </Text>
      </View>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  message: {
    color: "#64748B",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 21,
  },
});
