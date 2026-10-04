import { StyleSheet, Text, View, Pressable } from "react-native";
import { router } from "expo-router";

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>FindEasy</Text>

      <Text style={styles.tagline}>
        Find What You Need Near You
      </Text>

      <Text style={styles.description}>
        Discover PGs and hostels near your location.
      </Text>

      <Pressable
        style={styles.button}
        onPress={() => router.push("/login")}
      >
        <Text style={styles.buttonText}>Get Started</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#FFFFFF",
  },

  logo: {
    fontSize: 40,
    fontWeight: "700",
  },

  tagline: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },

  description: {
    marginTop: 12,
    fontSize: 15,
    color: "#666666",
    textAlign: "center",
  },

  button: {
    marginTop: 32,
    backgroundColor: "#2563EB",
    paddingVertical: 15,
    paddingHorizontal: 50,
    borderRadius: 10,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});