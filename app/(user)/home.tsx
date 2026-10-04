import { StyleSheet, Text, View, TextInput, ScrollView } from "react-native";

export default function Home() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.location}>📍 Hyderabad</Text>

      <Text style={styles.title}>
        Find a place to stay
      </Text>

      <TextInput
        placeholder="Search PG or Hostel"
        style={styles.search}
      />

      <Text style={styles.sectionTitle}>
        Looking for
      </Text>

      <View style={styles.categoryContainer}>
        <View style={styles.category}>
          <Text style={styles.categoryEmoji}>🏠</Text>
          <Text>PG</Text>
        </View>

        <View style={styles.category}>
          <Text style={styles.categoryEmoji}>🏨</Text>
          <Text>Hostel</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>
        Nearby PGs & Hostels
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Sri Sai Boys PG
        </Text>

        <Text style={styles.cardLocation}>
          Madhapur, Hyderabad
        </Text>

        <Text style={styles.price}>
          ₹7,500 / month
        </Text>

        <Text style={styles.available}>
          3 beds available
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#FFFFFF",
  },

  location: {
    fontSize: 14,
    color: "#555555",
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    marginTop: 15,
  },

  search: {
    height: 52,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 12,
    paddingHorizontal: 16,
    marginTop: 20,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 30,
    marginBottom: 15,
  },

  categoryContainer: {
    flexDirection: "row",
    gap: 12,
  },

  category: {
    width: 110,
    height: 100,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  categoryEmoji: {
    fontSize: 30,
    marginBottom: 8,
  },

  card: {
    padding: 18,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    borderRadius: 14,
    marginBottom: 20,
  },

  cardTitle: {
    fontSize: 19,
    fontWeight: "700",
  },

  cardLocation: {
    marginTop: 6,
    color: "#666666",
  },

  price: {
    marginTop: 12,
    fontSize: 17,
    fontWeight: "600",
  },

  available: {
    marginTop: 5,
    color: "#15803D",
  },
});