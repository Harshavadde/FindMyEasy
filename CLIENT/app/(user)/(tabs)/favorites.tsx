import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import ListingCard from "../../../components/ListingCard";
import { getFavoriteListings } from "../../../services/favorites";
import type { Listing } from "../../../types/listing";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFavoritesStore } from "../../../store/favoritesStore";

export default function FavoritesScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedItemToDelete, setSelectedItemToDelete] =
    useState<Listing | null>(null);
  const hasLoadedFavorites = useRef(false);
  const lastFetchedAt = useRef(0);
  const favorites = useFavoritesStore((state) => state.favoriteListings);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const setFavoriteIds = useFavoritesStore((state) => state.setFavoriteIds);
  const setFavoriteListings = useFavoritesStore(
    (state) => state.setFavoriteListings
  );

  const loadFavorites = useCallback(
    async (showLoading: boolean) => {
      if (showLoading) setLoading(true);
      setError("");
      try {
        const data = await getFavoriteListings();
        console.log(
          "Favorite cover images:",
          JSON.stringify(
            data.map((listing) => ({
              name: listing.name,
              images: listing.images,
            })),
            null,
            2
          )
        );

        setFavoriteIds(data.map((listing) => String(listing.id)));
        setFavoriteListings(data);
        hasLoadedFavorites.current = true;
        lastFetchedAt.current = Date.now();
      } catch (err) {
        if (!hasLoadedFavorites.current) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your favorite PGs."
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [setFavoriteIds, setFavoriteListings]
  );

  useEffect(() => {
    void loadFavorites(true);
  }, [loadFavorites]);

  useFocusEffect(
    useCallback(() => {
      if (Date.now() - lastFetchedAt.current > 2_000) {
        void loadFavorites(false);
      }
    }, [loadFavorites])
  );

  const openListing = (listing: Listing) => {
    router.push({
      pathname: "/(user)/listing/[id]",
      params: { id: listing.id },
    });
  };

  const confirmRemoveFavorite = () => {
    const listing = selectedItemToDelete;
    if (!listing) return;

    setSelectedItemToDelete(null);
    void toggleFavorite(String(listing.id), listing).catch((err: unknown) => {
      Alert.alert(
        "Favorites",
        err instanceof Error
          ? err.message
          : "Unable to update favorites. Please try again."
      );
    });
  };

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top"]}
    >
      <Text style={styles.title}>My Favorites</Text>
      <Text style={styles.subtitle}>
        PGs and hostels you have saved
      </Text>

      {loading && favorites.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.message}>Loading your favorites...</Text>
        </View>
      ) : error && favorites.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>

          <Pressable
            style={styles.retryButton}
            onPress={() => {
              void loadFavorites(true);
            }}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      ) : favorites.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.heart}>♡</Text>
          <Text style={styles.emptyTitle}>No favorites yet</Text>
          <Text style={styles.message}>
            Tap the heart on a PG listing to save it here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              onPress={() => openListing(item)}
              onRemoveFavorite={() => setSelectedItemToDelete(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        visible={selectedItemToDelete !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedItemToDelete(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmationDialog}>
            <Text style={styles.confirmationTitle}>Remove from Wishlist</Text>
            <Text style={styles.confirmationMessage}>
              Are you sure you want to delete this property from the wishlist?
            </Text>
            <View style={styles.confirmationActions}>
              <Pressable
                style={[styles.confirmationButton, styles.cancelButton]}
                onPress={() => setSelectedItemToDelete(null)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmationButton, styles.removeButton]}
                onPress={confirmRemoveFavorite}
              >
                <Text style={styles.removeButtonText}>Remove</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingTop: 18,
  },
  title: {
    fontSize: 25,
    fontWeight: "700",
    color: "#0F172A",
    marginHorizontal: 16,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    marginHorizontal: 16,
    marginTop: 5,
    marginBottom: 16,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  heart: {
    fontSize: 58,
    color: "#2563EB",
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginTop: 10,
    lineHeight: 21,
  },
  error: {
    color: "#DC2626",
    fontSize: 14,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: "#2563EB",
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 8,
  },
  retryText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
  },
  confirmationDialog: {
    width: "100%",
    maxWidth: 400,
    padding: 22,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
  },
  confirmationTitle: {
    color: "#0F172A",
    fontSize: 19,
    fontWeight: "700",
  },
  confirmationMessage: {
    color: "#475569",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  confirmationActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 24,
  },
  confirmationButton: {
    minWidth: 92,
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  cancelButton: {
    backgroundColor: "#F1F5F9",
  },
  cancelButtonText: {
    color: "#334155",
    fontWeight: "700",
  },
  removeButton: {
    backgroundColor: "#DC2626",
  },
  removeButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});