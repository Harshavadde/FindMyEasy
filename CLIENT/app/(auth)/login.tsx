import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import {
  getIndianPhoneInputValue,
  loginWithPhonePassword,
  normalizeIndianPhoneNumber,
  type UserRole,
} from "../../services/auth";

const COLORS = {
  primary: "#2563EB",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  text: "#0F172A",
  secondary: "#64748B",
  border: "#CBD5E1",
};

export default function Login() {
  const { completeLogin } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    Keyboard.dismiss();
    let phoneNumber: string;
    try {
      phoneNumber = normalizeIndianPhoneNumber(phone);
    } catch {
      Alert.alert(
        "Check your phone number",
        "Enter a valid Indian mobile number as 10 digits or +91 followed by 10 digits."
      );
      return;
    }
    if (!password) {
      Alert.alert("Enter your password", "Your password is required to sign in.");
      return;
    }

    try {
      setLoading(true);
      const result = await loginWithPhonePassword({
        phone_number: phoneNumber,
        password,
      });
      const role: UserRole =
        result.user.user_role === "OWNER" ? "owner" : "user";
      await completeLogin(result.user, role);
    } catch (error) {
      Alert.alert(
        "Unable to sign in",
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
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Sign in with your phone number and password.
            </Text>

            <Text style={styles.label}>Phone number</Text>
            <View style={styles.phoneContainer}>
              <Text style={styles.countryCode}>+91</Text>
              <TextInput
                style={styles.phoneInput}
                placeholder="10-digit mobile number"
                placeholderTextColor="#94A3B8"
                value={phone}
                onChangeText={(value) =>
                  setPhone(getIndianPhoneInputValue(value))
                }
                keyboardType="number-pad"
                textContentType="telephoneNumber"
                autoComplete="tel-national"
                maxLength={13}
                returnKeyType="done"
                onSubmitEditing={() => void handleLogin()}
                editable={!loading}
                accessibilityLabel="Indian phone number"
              />
            </View>

            <Text style={[styles.label, styles.spacedLabel]}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!passwordVisible}
                textContentType="password"
                autoComplete="current-password"
                returnKeyType="go"
                onSubmitEditing={() => void handleLogin()}
                editable={!loading}
                accessibilityLabel="Password"
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

            <Pressable
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={() => void handleLogin()}
              disabled={loading}
              accessibilityRole="button"
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Log in</Text>
              )}
            </Pressable>

            <View style={styles.footer}>
              <Text style={styles.footerText}>New to FindEasy? </Text>
              <Pressable
                disabled={loading}
                onPress={() => router.push("/(auth)/signup")}
              >
                <Text style={styles.link}>Create account</Text>
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
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoText: { color: "#FFFFFF", fontSize: 28, fontWeight: "800" },
  brand: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.primary,
    marginBottom: 22,
  },
  title: { fontSize: 27, fontWeight: "800", color: COLORS.text },
  subtitle: {
    fontSize: 15,
    color: COLORS.secondary,
    lineHeight: 23,
    marginTop: 8,
    marginBottom: 28,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
  },
  spacedLabel: { marginTop: 18 },
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
  phoneContainer: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
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
    marginTop: 24,
  },
  footerText: { color: COLORS.secondary, fontSize: 14 },
  link: { color: COLORS.primary, fontSize: 14, fontWeight: "700" },
});
