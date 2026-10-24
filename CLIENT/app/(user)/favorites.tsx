import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import ListingCard from "../../components/ListingCard";
import { getFavoriteListings } from "../../services/favorites";
import type { Listing } from "../../types/listing";
import { SafeAreaView } from "react-native-safe-area-context";

export default function FavoritesScreen() {
  const router = useRouter();

  const [favorites, setFavorites] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadFavorites = useCallback(async () => {
    let active = true;

    setLoading(true);
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

      if (active) {
        setFavorites(data);
      }
    } catch (err) {
      if (active) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load your favorite PGs."
        );
      }
    } finally {
      if (active) {
        setLoading(false);
      }
    }

    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const fetchFavorites = async () => {
        setLoading(true);
        setError("");

        try {
          const data = await getFavoriteListings();

          console.log(
            "FindEasy favorite image data:",
            JSON.stringify(
              data.map((listing) => ({
                id: listing.id,
                name: listing.name,
                images: listing.images,
              })),
              null,
              2
            )
          );

          if (active) {
            setFavorites(data);
          }
        } catch (err) {
          if (active) {
            setError(
              err instanceof Error
                ? err.message
                : "Unable to load your favorite PGs."
            );
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      };

      void fetchFavorites();

      return () => {
        active = false;
      };
    }, [])
  );

  const openListing = (listing: Listing) => {
    router.push({
      pathname: "/(user)/listing/[id]",
      params: { id: listing.id },
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

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.message}>Loading your favorites...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>

          <Pressable
            style={styles.retryButton}
            onPress={() => {
              void loadFavorites();
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
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
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
});