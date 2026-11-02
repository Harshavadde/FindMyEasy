import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function Dashboard() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Owner Dashboard</Text>
      <Text style={styles.subtitle}>
        Welcome to FindEasy!
      </Text>
      <Text style={styles.message}>
        Your dashboard is rendering successfully.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FB",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#1565C0",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
  },
});