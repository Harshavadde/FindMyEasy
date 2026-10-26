import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

type BackPath = "/" | "/(auth)/login" | "/(owner)";

type ComingSoonScreenProps = {
  feature: string;
  backPath: BackPath;
};

export default function ComingSoonScreen({
  feature,
  backPath,
}: ComingSoonScreenProps) {
  const router = useRouter();

  function goBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(backPath);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.brand}>FindEasy</Text>
        <Text style={styles.title}>Coming Soon</Text>
        <Text style={styles.description}>
          {feature} isn&apos;t available yet.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={goBack}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  brand: {
    color: "#2563EB",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 16,
  },
  title: {
    color: "#0F172A",
    fontSize: 28,
    fontWeight: "800",
  },
  description: {
    color: "#64748B",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    marginTop: 24,
    paddingHorizontal: 26,
    paddingVertical: 13,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
