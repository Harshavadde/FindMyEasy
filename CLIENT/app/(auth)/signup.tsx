import { useState } from "react";
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
import { useAuth } from "../../contexts/AuthContext";
import {
  getIndianPhoneInputValue,
  normalizeIndianPhoneNumber,
  registerWithPhonePassword,
  type UserRole,
} from "../../services/auth";

const COLORS = {
  primary: "#2563EB",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  text: "#0F172A",
  secondary: "#64748B",
  border: "#CBD5E1",
  error: "#DC2626",
};

export default function Signup() {
  const { completeLogin } = useAuth();
  const params = useLocalSearchParams<{ role?: string }>();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [role, setRole] = useState<UserRole>(
    params.role === "owner" ? "owner" : "user"
  );
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSignup() {
    Keyboard.dismiss();
    setErrorMessage("");

    if (!fullName.trim()) {
      setErrorMessage("Please enter your full name.");
      return;
    }
    let phoneNumber: string;
    try {
      phoneNumber = normalizeIndianPhoneNumber(phone);
    } catch {
      setErrorMessage(
        "Enter a valid Indian mobile number as 10 digits or +91 followed by 10 digits."
      );
      return;
    }
    if (password.length < 8 || password.length > 128 || !password.trim()) {
      setErrorMessage("Choose a password between 8 and 128 characters.");
      return;
    }

    try {
      setLoading(true);
      const result = await registerWithPhonePassword({
        phone_number: phoneNumber,
        password,
        full_name: fullName.trim(),
        user_role: role === "owner" ? "OWNER" : "SEEKER",
      });
      await completeLogin(result.user, role);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setLoading(false);
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
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>
              Join FindEasy to discover or manage a place to stay.
            </Text>

            <Text style={styles.label}>Full name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              placeholderTextColor="#94A3B8"
              value={fullName}
              onChangeText={(value) => {
                setFullName(value);
                setErrorMessage("");
              }}
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="name"
              maxLength={150}
              returnKeyType="next"
              editable={!loading}
              accessibilityLabel="Full name"
            />

            <Text style={[styles.label, styles.spacedLabel]}>I am a</Text>
            <View style={styles.roleRow}>
              {(["user", "owner"] as const).map((value) => {
                const selected = role === value;
                return (
                  <Pressable
                    key={value}
                    style={[styles.roleOption, selected && styles.roleSelected]}
                    onPress={() => setRole(value)}
                    disabled={loading}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Text
                      style={[
                        styles.roleText,
                        selected && styles.roleTextSelected,
                      ]}
                    >
                      {value === "user" ? "PG Seeker" : "PG Owner"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, styles.spacedLabel]}>Phone number</Text>
            <View style={styles.phoneContainer}>
              <Text style={styles.countryCode}>+91</Text>
              <TextInput
                style={styles.phoneInput}
                placeholder="10-digit mobile number"
                placeholderTextColor="#94A3B8"
                value={phone}
                onChangeText={(value) => {
                  setPhone(getIndianPhoneInputValue(value));
                  setErrorMessage("");
                }}
                keyboardType="number-pad"
                textContentType="telephoneNumber"
                autoComplete="tel-national"
                maxLength={13}
                returnKeyType="done"
                onSubmitEditing={() => void handleSignup()}
                editable={!loading}
                accessibilityLabel="Indian phone number"
              />
            </View>

            <Text style={[styles.label, styles.spacedLabel]}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="At least 8 characters"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setErrorMessage("");
                }}
                secureTextEntry={!passwordVisible}
                textContentType="newPassword"
                autoComplete="new-password"
                maxLength={128}
                returnKeyType="done"
                onSubmitEditing={() => void handleSignup()}
                editable={!loading}
                accessibilityLabel="Create password"
              />
              <Pressable
                style={styles.passwordVisibilityButton}
                onPress={() => setPasswordVisible((visible) => !visible)}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel={
                  passwordVisible ? "Hide password" : "Show password"
                }
              >
                <Text style={styles.passwordVisibilityText}>
                  {passwordVisible ? "Hide" : "Show"}
                </Text>
              </Pressable>
            </View>

            {errorMessage ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {errorMessage}
              </Text>
            ) : null}

            <Pressable
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={() => void handleSignup()}
              disabled={loading}
              accessibilityRole="button"
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Continue</Text>
              )}
            </Pressable>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Pressable
                disabled={loading}
                onPress={() =>
                  router.replace({
                    pathname: "/(auth)/login",
                  })
                }
              >
                <Text style={styles.link}>Sign in</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  logoText: { color: "#FFFFFF", fontSize: 26, fontWeight: "800" },
  brand: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.primary,
    marginBottom: 18,
  },
  title: { fontSize: 25, fontWeight: "800", color: COLORS.text },
  subtitle: {
    fontSize: 14,
    color: COLORS.secondary,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 23,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
  },
  spacedLabel: { marginTop: 18 },
  input: {
    height: 54,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 15,
    backgroundColor: "#FFFFFF",
    color: COLORS.text,
    fontSize: 16,
  },
  roleRow: { flexDirection: "row", gap: 12 },
  roleOption: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  roleSelected: { backgroundColor: "#EFF6FF", borderColor: COLORS.primary },
  roleText: { color: COLORS.secondary, fontSize: 14, fontWeight: "600" },
  roleTextSelected: { color: COLORS.primary },
  phoneContainer: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  passwordContainer: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  passwordInput: {
    flex: 1,
    height: 52,
    paddingHorizontal: 15,
    color: COLORS.text,
    fontSize: 16,
  },
  passwordVisibilityButton: {
    height: 52,
    justifyContent: "center",
    paddingHorizontal: 15,
  },
  passwordVisibilityText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  countryCode: {
    paddingHorizontal: 14,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "600",
  },
  phoneInput: {
    flex: 1,
    height: 52,
    paddingHorizontal: 12,
    color: COLORS.text,
    fontSize: 16,
  },
  error: { color: COLORS.error, fontSize: 13, marginTop: 12 },
  primaryButton: {
    height: 54,
    borderRadius: 13,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  disabledButton: { opacity: 0.65 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 24,
  },
  footerText: { color: COLORS.secondary, fontSize: 14 },
  link: { color: COLORS.primary, fontSize: 14, fontWeight: "700" },
});
