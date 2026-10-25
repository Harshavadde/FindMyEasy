
import "../global.css";
import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { LogBox } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../contexts/AuthContext";

LogBox.ignoreAllLogs(true);

function SessionRouter() {
  const { status, role } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading" || status === "offline") return;

    const firstSegment = segments[0];
    const inAuthGroup = firstSegment === "(auth)";
    const inOwnerGroup = firstSegment === "(owner)";
    const inUserGroup = firstSegment === "(user)";
    const atRoleSelection = !firstSegment;

    if (status === "unauthenticated") {
      if (inOwnerGroup || inUserGroup) {
        router.replace("/");
      }
      return;
    }


    if (status === "authenticated") {
      const destination =
        role === "owner" ? "/(owner)" : "/(user)/home";

      if (inAuthGroup || atRoleSelection) {
        // Only redirect authenticated users away from role selection.
        router.replace(destination);
        return;
      }
      // Keep users out of the other role's route group.
      if (role === "owner" && inUserGroup) {
        router.replace("/(owner)");
      } else if (role === "user" && inOwnerGroup) {
        router.replace("/(user)/home");
      }
    }
  }, [status, role, segments, router]);

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
