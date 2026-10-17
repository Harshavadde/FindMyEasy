import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  getCurrentUser,
  updateCurrentUser,
} from "../../services/auth";

export default function EditProfileScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const load = async () => {
        setLoading(true);
        setError("");

        try {
          const user = await getCurrentUser();
          if (active) {
            setFullName(user.full_name ?? "");
            setEmail(user.email);
          }
        } catch (err) {
          if (active) {
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
    }, [])
  );

  const handleSave = async () => {
    const trimmedName = fullName.trim();

    if (!trimmedName) {
      setError("Please enter your full name.");
      return;
    }

    if (trimmedName.length > 150) {
      setError("Your name must not exceed 150 characters.");
      return;
    }

    if (saving) return;

    setSaving(true);
    setError("");

    try {
      await updateCurrentUser(trimmedName);
      Alert.alert("Profile updated", "Your name has been updated successfully.", [
        {
          text: "OK",
          onPress: () => router.replace("/(user)/profile"),
        },
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save your changes."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.helper}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            style={styles.backButton}
            onPress={() => router.replace("/(user)/profile")}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={22}
              color="#0F172A"
            />
            <Text style={styles.backText}>Back to Profile</Text>
          </Pressable>

          <Text style={styles.title}>Edit Profile</Text>
          <Text style={styles.subtitle}>
            Keep your account information up to date.
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>Full name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={(value) => {
                setFullName(value);
                setError("");
              }}
              placeholder="Enter your full name"
              placeholderTextColor="#94A3B8"
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={150}
              editable={!saving}
              returnKeyType="done"
              accessibilityLabel="Full name"
            />
            <Text style={styles.counter}>
              {fullName.length}/150 characters
            </Text>

            <Text style={[styles.label, styles.emailLabel]}>
              Email address
            </Text>
            <View style={styles.readOnlyField}>
              <MaterialCommunityIcons
                name="email-outline"
                size={20}
                color="#64748B"
              />
              <Text style={styles.emailText}>{email}</Text>
              <MaterialCommunityIcons
                name="lock-outline"
                size={17}
                color="#94A3B8"
              />
            </View>
            <Text style={styles.hint}>
              Email address cannot be changed here.
            </Text>

            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}

            <Pressable
              style={[
                styles.saveButton,
                saving && styles.disabledButton,
              ]}
              onPress={() => void handleSave()}
              disabled={saving}
              accessibilityRole="button"
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="check"
                    size={21}
                    color="#FFFFFF"
                  />
                  <Text style={styles.saveText}>Save Changes</Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={styles.cancelButton}
              onPress={() => router.replace("/(user)/profile")}
              disabled={saving}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
  backButton: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 25 },
  backText: { color: "#334155", fontSize: 14, fontWeight: "600" },
  title: { fontSize: 27, fontWeight: "800", color: "#0F172A" },
  subtitle: { fontSize: 14, color: "#64748B", marginTop: 7, marginBottom: 24 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 20,
  },
  label: { fontSize: 14, fontWeight: "700", color: "#0F172A", marginBottom: 9 },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 14,
    color: "#0F172A",
    fontSize: 15,
    backgroundColor: "#FFFFFF",
  },
  counter: { textAlign: "right", color: "#94A3B8", fontSize: 12, marginTop: 7 },
  emailLabel: { marginTop: 25 },
  readOnlyField: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  emailText: { flex: 1, color: "#64748B", fontSize: 14 },
  hint: { color: "#94A3B8", fontSize: 12, marginTop: 7 },
  error: { color: "#DC2626", fontSize: 13, marginTop: 16, lineHeight: 19 },
  saveButton: {
    minHeight: 52,
    marginTop: 24,
    backgroundColor: "#2563EB",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  disabledButton: { opacity: 0.65 },
  cancelButton: { minHeight: 46, alignItems: "center", justifyContent: "center", marginTop: 8 },
  cancelText: { color: "#475569", fontSize: 15, fontWeight: "600" },
  center: { flex: 1, backgroundColor: "#F8FAFC", alignItems: "center", justifyContent: "center" },
  helper: { color: "#64748B", marginTop: 12 },
});