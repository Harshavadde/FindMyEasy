import "../global.css";
import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../contexts/AuthContext";

function SessionRouter() {
  const { status, role, logout } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    const firstSegment = segments[0];
    const inAuth = firstSegment === "(auth)";
    const inUser = firstSegment === "(user)";

    if (status === "unauthenticated" && inUser) {
      router.replace("/(auth)/login");
      return;
    }

    if (status === "authenticated") {
      if (role !== "user") {
        void logout()
          .then(() => router.replace("/(auth)/login"))
          .catch((error: unknown) => {
            console.error("Unable to clear a non-user session.", error);
            router.replace("/(auth)/login");
          });
        return;
      }
      if (inAuth || !firstSegment) {
        router.replace("/(user)/home");
      }
    }
  }, [status, role, segments, router, logout]);

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SessionRouter />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
