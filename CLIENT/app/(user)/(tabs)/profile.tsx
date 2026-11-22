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
import { LinearGradient } from "expo-linear-gradient";
import {
  getCurrentUser,
  getIndianPhoneInputValue,
} from "../../../services/auth";
import type { AuthUser } from "../../../services/auth";
import {
  USER_CARD_BORDER,
  USER_SCREEN_BACKGROUND,
  USER_SOFT_SHADOW,
} from "../../../constants/userDesign";
import { useScheduledVisitsStore } from "../../../store/scheduledVisitsStore";

export default function ProfileScreen() {
  const router = useRouter();
  const { logout, user: sessionUser } = useAuth();
  const [user, setUser] = useState<AuthUser | null>(sessionUser);
  const [loading, setLoading] = useState(!sessionUser);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const visits = useScheduledVisitsStore((state) => state.visits);

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
  const phoneDigits = getIndianPhoneInputValue(
    user.phone || user.phone_number || ""
  );
  const mobileNumber = phoneDigits ? `+91 ${phoneDigits}` : "Not provided";
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
        <Text style={styles.subtitle}>Manage your FindEasy account</Text>

        <View style={styles.profileCard}>
          <LinearGradient
            colors={["#4F46E5", "#8B5CF6"]}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>{initials}</Text>
          </LinearGradient>
          <View style={styles.profileInfo}>
            <Text style={styles.name} numberOfLines={1}>
              {fullName || "Name not provided"}
            </Text>
            <View style={styles.phoneRow}>
              <MaterialCommunityIcons
                name="phone-outline"
                size={14}
                color="#64748B"
              />
              <Text style={styles.phoneNumber}>{mobileNumber}</Text>
            </View>
            {!fullName ? (
              <Text style={styles.missingText}>
                Add your name to complete your profile.
              </Text>
            ) : null}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Scheduled Visits</Text>
        {visits.length > 0 ? (
          visits.map((visit) => (
            <View key={visit.id} style={styles.visitCard}>
              <View style={styles.visitIcon}>
                <MaterialCommunityIcons
                  name="calendar-check-outline"
                  size={21}
                  color="#16A34A"
                />
              </View>
              <View style={styles.visitContent}>
                <Text style={styles.visitName}>{visit.listingName}</Text>
                <Text style={styles.visitDetail}>
                  {visit.area}, {visit.city}
                </Text>
                <Text style={styles.visitDetail}>
                  {new Date(
                    `${visit.preferredDate}T00:00:00`
                  ).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}{" "}
                  · {visit.preferredTime}
                </Text>
                <Text style={styles.visitStatus}>{visit.status}</Text>
                {visit.showSimilarProperties ? (
                  <Text style={styles.visitDetail}>
                    Similar properties requested
                  </Text>
                ) : null}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyVisits}>
            <Text style={styles.visitDetail}>
              Your scheduled visit requests will appear here.
            </Text>
          </View>
        )}

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
                name="phone-outline"
                size={22}
                color="#2563EB"
              />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Mobile number</Text>
              <Text style={styles.detailValue}>{mobileNumber}</Text>
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
  safeArea: { flex: 1, backgroundColor: USER_SCREEN_BACKGROUND },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  heading: { fontSize: 27, fontWeight: "800", color: "#0F172A" },
  subtitle: { fontSize: 14, color: "#64748B", marginTop: 7 },
  profileCard: {
    marginTop: 22,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: USER_CARD_BORDER,
    ...USER_SOFT_SHADOW,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarText: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  profileInfo: { flex: 1 },
  name: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  phoneRow: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 5 },
  phoneNumber: { fontSize: 12, color: "#64748B" },
  missingText: { fontSize: 11, color: "#B45309", marginTop: 7 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginTop: 25,
    marginBottom: 11,
  },
  visitCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
    padding: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: USER_CARD_BORDER,
    ...USER_SOFT_SHADOW,
  },
  visitIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0FDF4",
  },
  visitContent: { flex: 1 },
  visitName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  visitDetail: { fontSize: 12, color: "#64748B", marginTop: 4 },
  visitStatus: {
    alignSelf: "flex-start",
    marginTop: 7,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#FEF3C7",
    color: "#92400E",
    fontSize: 10,
    fontWeight: "700",
  },
  emptyVisits: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: USER_CARD_BORDER,
    backgroundColor: "#FFFFFF",
  },
  detailsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: USER_CARD_BORDER,
    paddingHorizontal: 15,
    ...USER_SOFT_SHADOW,
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
    ...USER_SOFT_SHADOW,
  },
  logoutText: { color: "#DC2626", fontSize: 15, fontWeight: "700" },
  primaryButton: { backgroundColor: "#2563EB", paddingHorizontal: 22, paddingVertical: 12, borderRadius: 10, marginTop: 16 },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "700" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: USER_SCREEN_BACKGROUND,
    padding: 24,
  },
  muted: { color: "#64748B", marginTop: 12 },
  errorText: { color: "#DC2626", textAlign: "center", marginTop: 12 },
});