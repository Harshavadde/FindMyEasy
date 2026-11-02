import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  registerOwnerAccount,
  validateOwnerInvitation,
  type OwnerInvitationValidation,
} from "../../services/ownerRegistration";

const COLORS = {
  primary: "#2563EB",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  text: "#0F172A",
  secondary: "#64748B",
  border: "#CBD5E1",
  error: "#DC2626",
};

type ScreenState = "loading" | "ready" | "invalid" | "success";

function invitationToken(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default function OwnerRegistration() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = useMemo(() => invitationToken(params.token), [params.token]);
  const [invitation, setInvitation] =
    useState<OwnerInvitationValidation | null>(null);
  const [screenState, setScreenState] = useState<ScreenState>("loading");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    if (!token) {
      setErrorMessage("This registration link is invalid.");
      setScreenState("invalid");
      return () => {
        active = false;
      };
    }

    setScreenState("loading");
    void validateOwnerInvitation(token)
      .then((result) => {
        if (!active) return;
        setInvitation(result);
        setScreenState(result.valid ? "ready" : "invalid");
        if (!result.valid) setErrorMessage(result.message);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to validate this registration link. Please try again."
        );
        setScreenState("invalid");
      });

    return () => {
      active = false;
    };
  }, [token]);

  async function handleRegister() {
    Keyboard.dismiss();
    setErrorMessage("");

    if (password.length < 8 || password.length > 128 || !password.trim()) {
      setErrorMessage("Choose a password between 8 and 128 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("The passwords do not match.");
      return;
    }
    if (!termsAccepted) {
      setErrorMessage("Accept the Terms and Conditions to continue.");
      return;
    }

    setBusy(true);
    try {
      await registerOwnerAccount({
        token,
        password,
        terms_accepted: true,
      });
      setScreenState("success");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create your Owner account. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>F</Text>
            </View>
            <Text style={styles.brand}>FindEasy</Text>
            <Text style={styles.title}>
              {screenState === "success"
                ? "Your Owner account is ready"
                : "Owner registration"}
            </Text>

            {screenState === "loading" ? (
              <View style={styles.loading}>
                <ActivityIndicator color={COLORS.primary} size="large" />
                <Text style={styles.subtitle}>Checking your invitation…</Text>
              </View>
            ) : screenState === "success" ? (
              <>
                <Text style={styles.subtitle}>
                  Your registration is complete. Sign in to manage your
                  property on FindEasy.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.replace({
                      pathname: "/(auth)/login/owner",
                    })
                  }
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonText}>Continue to Owner Login</Text>
                </Pressable>
              </>
            ) : screenState === "invalid" ? (
              <>
                <Text accessibilityRole="alert" style={styles.error}>
                  {errorMessage}
                </Text>
                <Text style={styles.subtitle}>
                  If you believe this is a mistake, contact FindEasy support or
                  ask the Admin team for assistance.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.subtitle}>
                  Your partnership application has been approved. Confirm your
                  details, then create a password using the secure link sent to
                  your registered email address.
                </Text>

                <View style={styles.details}>
                  <Detail label="Applicant" value={invitation?.applicant_name} />
                  <Detail label="Mobile number" value={invitation?.applicant_phone} />
                  <Detail label="Email address" value={invitation?.applicant_email} />
                  <Detail label="PG / property" value={invitation?.pg_name} />
                  <Detail
                    label="City and locality"
                    value={
                      invitation?.city && invitation.area
                        ? `${invitation.area}, ${invitation.city}`
                        : invitation?.city || invitation?.area
                    }
                  />
                </View>

                <Text style={[styles.label, styles.spacedLabel]}>Create password</Text>
                <TextInput
                  accessibilityLabel="Create password"
                  autoComplete="new-password"
                  editable={!busy}
                  maxLength={128}
                  onChangeText={(value) => {
                    setPassword(value);
                    setErrorMessage("");
                  }}
                  placeholder="At least 8 characters"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry
                  style={styles.input}
                  textContentType="newPassword"
                  value={password}
                />

                <Text style={[styles.label, styles.spacedLabel]}>
                  Confirm password
                </Text>
                <TextInput
                  accessibilityLabel="Confirm password"
                  autoComplete="new-password"
                  editable={!busy}
                  maxLength={128}
                  onChangeText={(value) => {
                    setConfirmPassword(value);
                    setErrorMessage("");
                  }}
                  placeholder="Re-enter your password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry
                  style={styles.input}
                  textContentType="newPassword"
                  value={confirmPassword}
                />

                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: termsAccepted }}
                  disabled={busy}
                  onPress={() => {
                    setTermsAccepted((accepted) => !accepted);
                    setErrorMessage("");
                  }}
                  style={styles.termsRow}
                >
                  <View
                    style={[
                      styles.checkbox,
                      termsAccepted && styles.checkboxSelected,
                    ]}
                  >
                    {termsAccepted && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.termsText}>
                    I accept the FindEasy Terms and Conditions.
                  </Text>
                </Pressable>

                {errorMessage ? (
                  <Text accessibilityRole="alert" style={styles.error}>
                    {errorMessage}
                  </Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => void handleRegister()}
                  style={[styles.primaryButton, busy && styles.disabledButton]}
                >
                  {busy ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      Create Owner account
                    </Text>
                  )}
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || "Not provided"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    padding: 24,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    alignSelf: "center",
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "900",
  },
  brand: {
    marginTop: 10,
    textAlign: "center",
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: "800",
  },
  title: {
    marginTop: 18,
    color: COLORS.text,
    fontSize: 25,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 18,
    color: COLORS.secondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  loading: {
    alignItems: "center",
    paddingVertical: 28,
  },
  details: {
    marginBottom: 22,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  detailRow: {
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  detailLabel: {
    color: COLORS.secondary,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  detailValue: {
    marginTop: 4,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
  label: {
    marginBottom: 8,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  spacedLabel: {
    marginTop: 18,
  },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    color: COLORS.text,
    fontSize: 15,
    backgroundColor: COLORS.surface,
  },
  primaryButton: {
    minHeight: 52,
    marginTop: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.6,
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
  },
  checkboxSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  checkmark: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  termsText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 19,
  },
  error: {
    marginTop: 14,
    color: COLORS.error,
    fontSize: 13,
    lineHeight: 19,
  },
});
