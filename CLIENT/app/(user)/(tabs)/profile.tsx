import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../../../contexts/AuthContext";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getCurrentUser } from "../../../services/auth";
import type { AuthUser } from "../../../services/auth";

export default function ProfileScreen() {
  const router = useRouter();
  const { logout, user: sessionUser } = useAuth();
  const [user, setUser] = useState<AuthUser | null>(sessionUser);
  const [loading, setLoading] = useState(!sessionUser);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!sessionUser) setLoading(true);
    setError("");

    try {
      const result = await getCurrentUser();
      setUser(result);
    } catch (err) {
      if (!sessionUser) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load your profile."
        );
      }
    } finally {
      setLoading(false);
    }
  }, [sessionUser]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const load = async () => {
        if (!sessionUser) {
          setLoading(true);
          setError("");
        }

        try {
          const result = await getCurrentUser();
          if (active) setUser(result);
        } catch (err) {
          if (active && !sessionUser) {
            setError(
              err instanceof Error
                ? err.message
                : "Unable to load your profile."
            );
          }
        } finally {
          if (active) setLoading(false);
        }
      };

      void load();

      return () => {
        active = false;
      };
    }, [sessionUser])
  );

  const handleLogout = () => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          setLoggingOut(true);
          try {
            await logout();
            router.replace("/");
          } catch {
            Alert.alert("Error", "Unable to log out. Please try again.");
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.muted}>Loading your profile...</Text>
      </SafeAreaView>
    );
  }

  if (error || !user) {
    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <MaterialCommunityIcons
          name="account-alert-outline"
          size={44}
          color="#64748B"
        />
        <Text style={styles.errorText}>
          {error || "Profile details are unavailable."}
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => void loadProfile()}>
          <Text style={styles.primaryButtonText}>Try Again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const fullName = user.full_name?.trim() || "";
  const initials =
    fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "?";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>My Profile</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          <Text style={styles.name}>
            {fullName || "Name not provided"}
          </Text>
          <Text style={styles.email}>{user.email}</Text>

          {!fullName ? (
            <Text style={styles.missingText}>
              Add your name to complete your profile.
            </Text>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>Account information</Text>

        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <View style={styles.iconBox}>
              <MaterialCommunityIcons
                name="account-outline"
                size={22}
                color="#2563EB"
              />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Full name</Text>
              <Text style={styles.detailValue}>
                {fullName || "Not provided"}
              </Text>
            </View>
          </View>

          <View style={styles.separator} />

          <View style={styles.detailRow}>
            <View style={styles.iconBox}>
              <MaterialCommunityIcons
                name="email-outline"
                size={22}
                color="#2563EB"
              />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Email address</Text>
              <Text style={styles.detailValue}>{user.email}</Text>
            </View>
          </View>

          <View style={styles.separator} />

          <View style={styles.detailRow}>
            <View style={styles.iconBox}>
              <MaterialCommunityIcons
                name="phone-outline"
                size={22}
                color="#2563EB"
              />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Phone number</Text>
              <Text style={styles.detailValue}>
                {user.phone ? `+91 ${user.phone}` : "Not provided"}
              </Text>
            </View>
          </View>
        </View>

        <Pressable
          style={styles.editButton}
          onPress={() => router.push("/(user)/edit-profile")}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons
            name="account-edit-outline"
            size={21}
            color="#FFFFFF"
          />
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </Pressable>

        <Pressable
          style={styles.logoutButton}
          onPress={handleLogout}
          disabled={loggingOut}
          accessibilityRole="button"
        >
          {loggingOut ? (
            <ActivityIndicator color="#DC2626" />
          ) : (
            <>
              <MaterialCommunityIcons
                name="logout"
                size={21}
                color="#DC2626"
              />
              <Text style={styles.logoutText}>Log Out</Text>
            </>
          )}
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  heading: { fontSize: 27, fontWeight: "800", color: "#0F172A" },
  profileCard: {
    paddingVertical: 22,
    alignItems: "center",
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },
  avatarText: { color: "#1D4ED8", fontSize: 27, fontWeight: "800" },
  name: { fontSize: 21, fontWeight: "700", color: "#0F172A", textAlign: "center" },
  email: { fontSize: 14, color: "#64748B", marginTop: 7, textAlign: "center" },
  missingText: { fontSize: 12, color: "#B45309", marginTop: 10, textAlign: "center" },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#0F172A", marginTop: 25, marginBottom: 11 },
  detailsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 15,
  },
  detailRow: { flexDirection: "row", alignItems: "center", paddingVertical: 16, gap: 13 },
  iconBox: {
    width: 43,
    height: 43,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: 12, color: "#64748B", marginBottom: 4 },
  detailValue: { fontSize: 15, fontWeight: "600", color: "#0F172A" },
  separator: { height: 1, backgroundColor: "#E2E8F0" },
  editButton: {
    minHeight: 52,
    marginTop: 22,
    backgroundColor: "#2563EB",
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  editButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  logoutButton: {
    minHeight: 50,
    marginTop: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  logoutText: { color: "#DC2626", fontSize: 15, fontWeight: "700" },
  primaryButton: { backgroundColor: "#2563EB", paddingHorizontal: 22, paddingVertical: 12, borderRadius: 10, marginTop: 16 },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F8FAFC", padding: 24 },
  muted: { color: "#64748B", marginTop: 12 },
  errorText: { color: "#DC2626", textAlign: "center", marginTop: 12 },
});