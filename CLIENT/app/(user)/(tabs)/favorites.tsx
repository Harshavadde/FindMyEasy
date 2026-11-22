import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurTargetView } from "expo-blur";
import { useFocusEffect, useRouter } from "expo-router";
import ListingDetailSheet from "../../../components/ListingDetailSheet";
import ScheduleVisitModal from "../../../components/ScheduleVisitModal";
import { useAuth } from "../../../contexts/AuthContext";
import { API_BASE_URL } from "../../../constants/api";
import { getListingAudienceBadge } from "../../../utils/listingPresentation";
import { getFavoriteListings } from "../../../services/favorites";
import type { Listing } from "../../../types/listing";
import type { NewScheduledVisit } from "../../../types/visit";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFavoritesStore } from "../../../store/favoritesStore";
import { useScheduledVisitsStore } from "../../../store/scheduledVisitsStore";
import { useBottomNavigationScroll } from "../../../contexts/BottomNavigationScrollContext";
import {
  USER_CARD_BORDER,
  USER_SCREEN_BACKGROUND,
  USER_SOFT_SHADOW,
} from "../../../constants/userDesign";

export default function FavoritesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    activateBlurTarget,
    deactivateBlurTarget,
    onScroll: handleBottomNavigationScroll,
  } = useBottomNavigationScroll();
  const screenBlurTarget = useRef<ComponentRef<typeof View> | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchText, setSearchText] = useState("");
  const [detailListing, setDetailListing] = useState<Listing | null>(null);
  const [visitListing, setVisitListing] = useState<Listing | null>(null);
  const [selectedItemToDelete, setSelectedItemToDelete] =
    useState<Listing | null>(null);
  const hasLoadedFavorites = useRef(false);
  const lastFetchedAt = useRef(0);
  const favorites = useFavoritesStore((state) => state.favoriteListings);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const showToast = useFavoritesStore((state) => state.showToast);
  const addScheduledVisit = useScheduledVisitsStore((state) => state.addVisit);
  const setFavoriteIds = useFavoritesStore((state) => state.setFavoriteIds);
  const setFavoriteListings = useFavoritesStore(
    (state) => state.setFavoriteListings
  );
  const profileInitial = user?.full_name?.trim().charAt(0).toUpperCase() || "?";

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

  useFocusEffect(
    useCallback(() => {
      activateBlurTarget(screenBlurTarget);
      return () => deactivateBlurTarget(screenBlurTarget);
    }, [activateBlurTarget, deactivateBlurTarget])
  );

  const openListing = (listing: Listing) => {
    setDetailListing(listing);
  };

  const submitVisitRequest = (visit: NewScheduledVisit) => {
    addScheduledVisit(visit);
    setVisitListing(null);
    showToast("Visit request saved for this session.");
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
    <BlurTargetView ref={screenBlurTarget} style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.exploreHeader}>
        <View style={styles.exploreTopRow}>
          <Pressable
            onPress={() => router.navigate("/(user)/(tabs)/home")}
            accessibilityRole="button"
            accessibilityLabel="Set your location"
            style={styles.locationButton}
          >
            <View style={styles.locationIcon}>
              <MaterialCommunityIcons
                name="map-marker"
                size={21}
                color="#4F46E5"
              />
            </View>
            <View style={styles.locationText}>
              <View style={styles.locationTitleRow}>
                <Text numberOfLines={1} style={styles.locationTitle}>
                  Set your location
                </Text>
                <MaterialCommunityIcons
                  name="chevron-down"
                  size={18}
                  color="#94A3B8"
                />
              </View>
              <Text numberOfLines={1} style={styles.locationSubtitle}>
                Allow location access to find your area
              </Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => router.navigate("/(user)/(tabs)/profile")}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            style={styles.profileAvatar}
          >
            <Text style={styles.profileAvatarText}>{profileInitial}</Text>
          </Pressable>
        </View>
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <MaterialCommunityIcons
              name="magnify"
              size={20}
              color="#64748B"
            />
            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search PGs, areas or metro stations"
              placeholderTextColor="#6B7280"
              returnKeyType="search"
              onSubmitEditing={() =>
                router.navigate({
                  pathname: "/(user)/(tabs)/search",
                  params: { query: searchText.trim() },
                })
              }
              accessibilityLabel="Search PG name, area or metro station"
              style={styles.searchInput}
            />
            {searchText.length > 0 ? (
              <Pressable
                onPress={() => setSearchText("")}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                hitSlop={8}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={18}
                  color="#64748B"
                />
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => router.push("/(user)/PG")}
              accessibilityRole="button"
              accessibilityLabel="Open PG filters"
              style={styles.filterButton}
            >
              <MaterialCommunityIcons
                name="tune-variant"
                size={19}
                color="#4F46E5"
              />
            </Pressable>
          </View>
        </View>
      </View>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Saved PGs</Text>
          <Text style={styles.subtitle}>
            Shortlisted stays you can compare &amp; visit
          </Text>
        </View>
        <View style={styles.savedCount}>
          <Text style={styles.savedCountText}>
            {favorites.length} Saved
          </Text>
        </View>
      </View>

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
          scrollEventThrottle={16}
          onScroll={(event) =>
            handleBottomNavigationScroll(event.nativeEvent.contentOffset.y)
          }
          renderItem={({ item }) => (
            <SavedListingCard
              listing={item}
              onPress={() => openListing(item)}
              onRemoveFavorite={() => setSelectedItemToDelete(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <ListingDetailSheet
        visible={detailListing !== null}
        listing={detailListing}
        onClose={() => setDetailListing(null)}
        onScheduleVisit={() => {
          if (detailListing) setVisitListing(detailListing);
          setDetailListing(null);
        }}
      />
      <ScheduleVisitModal
        visible={visitListing !== null}
        listing={visitListing}
        onClose={() => setVisitListing(null)}
        onSubmit={submitVisitRequest}
      />

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
    </BlurTargetView>
  );
}

function getSavedCoverUrl(listing: Listing): string | undefined {
  const image =
    listing.images?.find(
      (item) => item.image_type?.toUpperCase() === "COVER"
    ) ?? listing.images?.[0];
  const url = image?.url;
  if (!url) return undefined;

  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/uploads/")) {
      return `${API_BASE_URL}${parsed.pathname}${parsed.search}`;
    }
    return url;
  } catch {
    return url.startsWith("/uploads/") ? `${API_BASE_URL}${url}` : undefined;
  }
}

function getSavedStartingPrice(listing: Listing): number {
  const prices = (listing.sharing ?? [])
    .map((sharing) => Number(sharing.monthly_price))
    .filter((price) => Number.isFinite(price) && price > 0);

  return prices.length > 0 ? Math.min(...prices) : Number(listing.monthly_price);
}

function SavedListingCard({
  listing,
  onPress,
  onRemoveFavorite,
}: {
  listing: Listing;
  onPress: () => void;
  onRemoveFavorite: () => void;
}) {
  const imageUrl = getSavedCoverUrl(listing);
  const audience = getListingAudienceBadge(listing.gender);
  const startingPrice = getSavedStartingPrice(listing);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View ${listing.name}`}
      style={styles.savedCard}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.savedImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.savedImage, styles.savedImageFallback]}>
          <MaterialCommunityIcons
            name="home-city-outline"
            size={28}
            color="#64748B"
          />
        </View>
      )}
      <View style={styles.savedCardBody}>
        <View style={styles.savedCardTopRow}>
          <View
            style={[
              styles.audienceBadge,
              {
                backgroundColor: audience.backgroundColor,
                borderColor: audience.borderColor,
              },
            ]}
          >
            <Text style={[styles.audienceText, { color: audience.textColor }]}>
              {audience.label}
            </Text>
          </View>
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onRemoveFavorite();
            }}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${listing.name} from saved PGs`}
            hitSlop={8}
            style={styles.removeSavedButton}
          >
            <MaterialCommunityIcons
              name="heart"
              size={17}
              color="#E11D48"
            />
          </Pressable>
        </View>
        <Text numberOfLines={1} style={styles.savedName}>
          {listing.name}
        </Text>
        <Text numberOfLines={1} style={styles.savedLocation}>
          {listing.area}, {listing.city}
        </Text>
        <View style={styles.savedCardBottomRow}>
          <Text numberOfLines={1} style={styles.savedPrice}>
            ₹{startingPrice.toLocaleString("en-IN")}/mo
          </Text>
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={`View rooms at ${listing.name}`}
            hitSlop={6}
          >
            <Text style={styles.viewRooms}>View Rooms</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: USER_SCREEN_BACKGROUND,
  },
  exploreHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: USER_CARD_BORDER,
  },
  exploreTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationButton: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
  },
  locationIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
  },
  locationText: {
    flex: 1,
    minWidth: 0,
  },
  locationTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationTitle: {
    flexShrink: 1,
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
  },
  locationSubtitle: {
    marginTop: 2,
    color: "#64748B",
    fontSize: 12,
  },
  profileAvatar: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#6D4AFF",
  },
  profileAvatarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  searchRow: {
    marginTop: 12,
  },
  searchBar: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: USER_CARD_BORDER,
    backgroundColor: "#FFFFFF",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
  },
  searchInput: {
    height: 50,
    flex: 1,
    paddingHorizontal: 8,
    color: "#0F172A",
    fontSize: 14,
  },
  filterButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: USER_CARD_BORDER,
    backgroundColor: "#F8FAFC",
  },
  header: {
    marginHorizontal: 22,
    marginTop: 24,
    marginBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 23,
    fontWeight: "700",
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 5,
  },
  savedCount: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#EEF2FF",
  },
  savedCountText: {
    color: "#4F46E5",
    fontSize: 12,
    fontWeight: "700",
  },
  savedCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: USER_CARD_BORDER,
    ...USER_SOFT_SHADOW,
  },
  savedImage: {
    width: 100,
    height: 100,
    borderRadius: 14,
    backgroundColor: "#E2E8F0",
  },
  savedImageFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  savedCardBody: {
    flex: 1,
    minWidth: 0,
    marginLeft: 14,
  },
  savedCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  audienceBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 8,
  },
  audienceText: {
    fontSize: 10,
    fontWeight: "700",
  },
  removeSavedButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  savedName: {
    marginTop: 3,
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "700",
  },
  savedLocation: {
    marginTop: 2,
    color: "#64748B",
    fontSize: 12,
  },
  savedCardBottomRow: {
    marginTop: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  savedPrice: {
    flexShrink: 1,
    color: "#4F46E5",
    fontSize: 15,
    fontWeight: "800",
  },
  viewRooms: {
    color: "#1E293B",
    fontSize: 12,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  listContent: {
    paddingHorizontal: 22,
    paddingBottom: 140,
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
    textShadowColor: "#BFDBFE",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
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
    ...USER_SOFT_SHADOW,
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
    borderWidth: 1,
    borderColor: USER_CARD_BORDER,
    ...USER_SOFT_SHADOW,
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