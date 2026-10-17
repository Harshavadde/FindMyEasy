
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { ApiError } from "../constants/api";
import {
  getCurrentUser,
  getSavedToken,
  getSavedUserRole,
  logoutUser,
  saveUserRole,
  type AuthUser,
  type UserRole,
} from "../services/auth";

type SessionStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "offline";

type AuthContextValue = {
  status: SessionStatus;
  user: AuthUser | null;
  role: UserRole | null;
  restoreSession: () => Promise<void>;
  completeLogin: (user: AuthUser, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);

  const restoreSession = useCallback(async () => {
    setStatus("loading");

    try {
      const token = await getSavedToken();

      if (!token) {
        setUser(null);
        setRole(null);
        setStatus("unauthenticated");
        return;
      }

      // A missing role can occur for a session created before role persistence.
      const savedRole = await getSavedUserRole();
      const currentUser = await getCurrentUser();

      setUser(currentUser);
      setRole(savedRole ?? "user");
      setStatus("authenticated");
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.kind === "http" &&
        error.status === 401
      ) {
        await logoutUser();
        setUser(null);
        setRole(null);
        setStatus("unauthenticated");
        return;
      }

      // Do not destroy a saved session for network, timeout, or server errors.
      setStatus("offline");
    }
  }, []);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  const completeLogin = useCallback(
    async (loggedInUser: AuthUser, selectedRole: UserRole) => {
      await saveUserRole(selectedRole);
      setUser(loggedInUser);
      setRole(selectedRole);
      setStatus("authenticated");
    },
    []
  );

  const logout = useCallback(async () => {
    // Clear secure storage first; only then mark the app logged out.
    await logoutUser();
    setUser(null);
    setRole(null);
    setStatus("unauthenticated");
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
        <Text style={styles.message}>Restoring your FindEasy session...</Text>
      </View>
    );
  }

  if (status === "offline") {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Unable to verify your session</Text>
        <Text style={styles.message}>
          Check your internet connection or try again when the server is available.
          Your saved login has not been deleted.
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => void restoreSession()}
        >
          <Text style={styles.buttonText}>Retry</Text>
        </Pressable>
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
  title: {
    color: "#0F172A",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  message: {
    color: "#64748B",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 21,
  },
  button: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 20,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
