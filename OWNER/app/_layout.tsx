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
    const inOwner = firstSegment === "(owner)";

    if (status === "unauthenticated" && inOwner) {
      router.replace({ pathname: "/(auth)/login", params: { role: "owner" } });
      return;
    }

    if (status === "authenticated") {
      if (role !== "owner") {
        void logout()
          .then(() =>
            router.replace({
              pathname: "/(auth)/login",
              params: { role: "owner" },
            })
          )
          .catch((error: unknown) => {
            console.error("Unable to clear a non-owner session.", error);
            router.replace({
              pathname: "/(auth)/login",
              params: { role: "owner" },
            });
          });
        return;
      }
      if (inAuth || !firstSegment) {
        router.replace("/(owner)");
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
