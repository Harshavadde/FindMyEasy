
import { useRef, useState } from "react";
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
    type TextInputInstance,
    View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { registerUser } from "../../services/auth";

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
    const { role } = useLocalSearchParams<{
        role?: "user" | "owner";
    }>();

    const emailRef = useRef<TextInputInstance | null>(null);
    const passwordRef = useRef<TextInputInstance | null>(null);
    const confirmPasswordRef = useRef<TextInputInstance | null>(null);

    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    async function handleSignup() {
        Keyboard.dismiss();
        setErrorMessage("");

        const normalizedEmail = email.trim().toLowerCase();

        if (
            !fullName.trim() ||
            !normalizedEmail ||
            !password ||
            !confirmPassword
        ) {
            setErrorMessage("Please complete all fields.");
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            setErrorMessage("Please enter a valid email address.");
            return;
        }

        if (password.length < 8) {
            setErrorMessage("Your password must contain at least 8 characters.");
            return;
        }

        if (password !== confirmPassword) {
            setErrorMessage("Passwords do not match. Please try again.");
            return;
        }

        if (role !== "user" && role !== "owner") {
            setErrorMessage("Please select User or Owner before registering.");
            return;
        }

        try {
            setLoading(true);


            await registerUser({
                full_name: fullName.trim(),
                email: normalizedEmail,
                password,
            });
            setPassword("");
            setConfirmPassword("");

            Alert.alert(
                "Account Created Successfully",
                "Please sign in using your registered email and password.",
                [
                    {
                        text: "OK",
                        onPress: () => {
                            router.replace({
                                pathname: "/(auth)/login",
                                params: { role },
                            });
                        },
                    },
                ],
                { cancelable: false }
            );

        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Unable to create your account. Please try again."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <Pressable
                style={StyleSheet.absoluteFill}
                onPress={Keyboard.dismiss}
                accessible={false}
            />

            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode={
                        Platform.OS === "ios" ? "interactive" : "on-drag"
                    }
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.card}>
                        <View style={styles.logo}>
                            <Text style={styles.logoText}>F</Text>
                        </View>

                        <Text style={styles.brand}>FindEasy</Text>
                        <Text style={styles.title}>Create your account</Text>
                        <Text style={styles.subtitle}>
                            Join FindEasy to discover your next place to stay.
                        </Text>

                        <View style={styles.field}>
                            <Text style={styles.label}>
                                Full name <Text style={styles.requiredMarker}>*</Text>
                            </Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your full name"
                                placeholderTextColor="#94A3B8"
                                value={fullName}
                                onChangeText={(value) => {
                                    setFullName(value);
                                    setErrorMessage("");
                                }}
                                textContentType="none"
                                autoCapitalize="words"
                                autoCorrect={false}
                                autoComplete="off"
                                returnKeyType="next"
                                onSubmitEditing={() => emailRef.current?.focus()}
                                editable={!loading}
                                accessibilityLabel="Full name"
                            />
                        </View>

                        <View style={styles.field}>
                            <Text style={styles.label}>Email address</Text>
                            <TextInput
                                ref={emailRef}
                                style={styles.input}
                                placeholder="you@example.com"
                                placeholderTextColor="#94A3B8"
                                value={email}
                                onChangeText={(value) => {
                                    setEmail(value);
                                    setErrorMessage("");
                                }}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                autoComplete="off"
                                textContentType="none"
                                returnKeyType="next"
                                onSubmitEditing={() => passwordRef.current?.focus()}
                                editable={!loading}
                                accessibilityLabel="Email address"
                            />
                        </View>

                        <View style={styles.field}>
                            <Text style={styles.label}>Password</Text>
                            <View style={styles.passwordContainer}>
                                <TextInput
                                    ref={passwordRef}
                                    style={styles.passwordInput}
                                    placeholder="At least 8 characters"
                                    placeholderTextColor="#94A3B8"
                                    value={password}
                                    onChangeText={(value) => {
                                        setPassword(value);
                                        setErrorMessage("");
                                    }}
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    autoComplete="off"
                                    textContentType="none"
                                    selectionColor="#2563EB"
                                    cursorColor="#2563EB"
                                    returnKeyType="next"
                                    onSubmitEditing={() =>
                                        confirmPasswordRef.current?.focus()
                                    }
                                    editable={!loading}
                                    accessibilityLabel="Password"
                                />

                                <Pressable
                                    style={styles.visibilityButton}
                                    onPress={() =>
                                        setShowPassword((current) => !current)
                                    }
                                    accessibilityRole="button"
                                    accessibilityLabel={
                                        showPassword ? "Hide password" : "Show password"
                                    }
                                >
                                    <Text style={styles.visibilityText}>
                                        {showPassword ? "Hide" : "Show"}
                                    </Text>
                                </Pressable>
                            </View>
                        </View>

                        <View style={styles.field}>
                            <Text style={styles.label}>Confirm password</Text>
                            <View style={styles.passwordContainer}>
                                <TextInput
                                    ref={confirmPasswordRef}
                                    style={styles.passwordInput}
                                    placeholder="Re-enter your password"
                                    placeholderTextColor="#94A3B8"
                                    value={confirmPassword}
                                    onChangeText={(value) => {
                                        setConfirmPassword(value);
                                        setErrorMessage("");
                                    }}
                                    secureTextEntry={!showConfirmPassword}
                                    autoCapitalize="none"
                                    autoComplete="off"
                                    autoCorrect={false}
                                    textContentType="none"
                                    selectionColor="#2563EB"
                                    cursorColor="#2563EB"
                                    returnKeyType="done"
                                    onSubmitEditing={handleSignup}
                                    editable={!loading}
                                    accessibilityLabel="Confirm password"
                                />

                                <Pressable
                                    style={styles.visibilityButton}
                                    onPress={() =>
                                        setShowConfirmPassword((current) => !current)
                                    }
                                    accessibilityRole="button"
                                    accessibilityLabel={
                                        showConfirmPassword
                                            ? "Hide confirmation password"
                                            : "Show confirmation password"
                                    }
                                >
                                    <Text style={styles.visibilityText}>
                                        {showConfirmPassword ? "Hide" : "Show"}
                                    </Text>
                                </Pressable>
                            </View>
                        </View>

                        {errorMessage ? (
                            <Text accessibilityRole="alert" style={styles.error}>
                                {errorMessage}
                            </Text>
                        ) : null}

                        <Pressable
                            style={[styles.primaryButton, loading && styles.disabledButton]}
                            onPress={handleSignup}
                            disabled={loading}
                            accessibilityRole="button"
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.primaryButtonText}>
                                    Create account
                                </Text>
                            )}
                        </Pressable>

                        <View style={styles.footer}>
                            <Text style={styles.footerText}>
                                Already have an account?{" "}
                            </Text>
                            <Pressable
                                disabled={loading}
                                onPress={() =>
                                    router.replace({
                                        pathname: "/(auth)/login",
                                        params: { role: role ?? "user" },
                                    })
                                }
                            >
                                <Text style={styles.link}>Login</Text>
                            </Pressable>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
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
    logoText: {
        color: "#FFFFFF",
        fontSize: 26,
        fontWeight: "800",
    },
    brand: {
        fontSize: 16,
        fontWeight: "700",
        color: COLORS.primary,
        marginBottom: 18,
    },
    title: {
        fontSize: 25,
        fontWeight: "800",
        color: COLORS.text,
        letterSpacing: -0.4,
    },
    subtitle: {
        fontSize: 14,
        color: COLORS.secondary,
        lineHeight: 21,
        marginTop: 8,
        marginBottom: 23,
    },
    field: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
        color: COLORS.text,
        marginBottom: 8,
    },
    requiredMarker: {
        color: COLORS.error,
    },
    input: {
        height: 52,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 12,
        paddingHorizontal: 14,
        backgroundColor: "#FFFFFF",
        color: COLORS.text,
        fontSize: 15,
    },

    passwordContainer: {
        height: 54,
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 12,
        backgroundColor: "#FFFFFF",
        overflow: "hidden",
    },
    passwordInput: {
        flex: 1,
        minWidth: 0,
        height: "100%",
        paddingHorizontal: 14,
        paddingVertical: 0,
        borderWidth: 0,
        backgroundColor: "transparent",
        color: COLORS.text,
        fontSize: 15,
    },
    visibilityButton: {
        height: "100%",
        paddingHorizontal: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFFFFF",
    },

    visibilityText: {
        color: COLORS.primary,
        fontSize: 13,
        fontWeight: "700",
    },
    error: {
        color: COLORS.error,
        fontSize: 13,
        lineHeight: 19,
        marginBottom: 14,
    },
    primaryButton: {
        height: 53,
        borderRadius: 13,
        backgroundColor: COLORS.primary,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 4,
    },
    disabledButton: {
        opacity: 0.65,
    },
    primaryButtonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "700",
    },
    footer: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        flexWrap: "wrap",
        marginTop: 22,
    },
    footerText: {
        color: COLORS.secondary,
        fontSize: 13,
    },
    link: {
        color: COLORS.primary,
        fontSize: 14,
        fontWeight: "700",
    },
});
