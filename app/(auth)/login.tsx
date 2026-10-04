import {
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from "react-native";
import { router } from "expo-router";

export default function Login() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to FindEasy</Text>

      <Text style={styles.subtitle}>
        Login to find PGs and hostels near you.
      </Text>

      <TextInput
        placeholder="Phone number"
        keyboardType="phone-pad"
        style={styles.input}
      />

      <TextInput
        placeholder="Password"
        secureTextEntry
        style={styles.input}
      />

      <Pressable
        style={styles.button}
        onPress={() => router.replace("/home")}
      >
        <Text style={styles.buttonText}>Login</Text>
      </Pressable>

      <Pressable>
        <Text style={styles.signup}>Create an account</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
  },

  subtitle: {
    marginTop: 8,
    marginBottom: 30,
    color: "#666666",
  },

  input: {
    height: 52,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 10,
    paddingHorizontal: 16,
    marginBottom: 15,
  },

  button: {
    height: 52,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#2563EB",
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },

  signup: {
    marginTop: 20,
    textAlign: "center",
    color: "#2563EB",
  },
});