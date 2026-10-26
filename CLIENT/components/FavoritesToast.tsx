import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFavoritesStore } from "../store/favoritesStore";

export default function FavoritesToast() {
  const insets = useSafeAreaInsets();
  const message = useFavoritesStore((state) => state.toastMessage);

  if (!message) return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.position, { top: insets.top + 8 }]}
    >
      <View style={styles.toast}>
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  position: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1000,
  },
  toast: {
    backgroundColor: "#0F172A",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  message: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
