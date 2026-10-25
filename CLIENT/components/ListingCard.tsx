import { useEffect } from "react";
import { API_BASE_URL } from "../constants/api";
import {
  Alert,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";

import type { Listing } from "../types/listing";
import { useFavoritesStore } from "../store/favoritesStore";

type Props = {
  listing: Listing;
  onPress?: () => void;
  onFavoriteChange?: (isFavorite: boolean) => void;
};

function getReachableImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;

  try {
    const parsed = new URL(url);

    // Uploaded images should use the current API server,
    // even if the database contains an old IP address.
    if (parsed.pathname.startsWith("/uploads/")) {
      return `${API_BASE_URL}${parsed.pathname}${parsed.search}`;
    }

    return url;
  } catch {
    if (url.startsWith("/uploads/")) {
      return `${API_BASE_URL}${url}`;
    }

    return undefined;
  }
}

export default function ListingCard({
  listing,
  onPress,
  onFavoriteChange,
}: Props) {
  const listingId = String(listing.id);
  const isFavorite = useFavoritesStore((state) =>
    state.favoriteIds.has(listingId)
  );
  const favoriteLoading = useFavoritesStore((state) =>
    state.pendingIds.has(listingId)
  );
  const loadFavoriteIds = useFavoritesStore(
    (state) => state.loadFavoriteIds
  );
  const toggleFavoriteInStore = useFavoritesStore(
    (state) => state.toggleFavorite
  );

  useEffect(() => {
    void loadFavoriteIds().catch(() => undefined);
  }, [loadFavoriteIds]);

  const toggleFavorite = async () => {
    if (favoriteLoading) return;

    const nextIsFavorite = !isFavorite;
    try {
      const update = toggleFavoriteInStore(listingId);
      onFavoriteChange?.(nextIsFavorite);
      await update;
    } catch (error) {
      onFavoriteChange?.(isFavorite);
      Alert.alert(
        "Favorites",
        error instanceof Error
          ? error.message
          : "Unable to update favorites. Please try again."
      );
    }
  };

  const coverImage =
    listing.images?.find(
      (image) => image.image_type?.toUpperCase() === "COVER"
    ) ?? listing.images?.[0];

  const coverImageUrl = getReachableImageUrl(coverImage?.url);

  console.log("FindEasy cover image URL:", coverImage?.url);

  return (
    <Pressable
      onPress={onPress}
      className="mb-4 overflow-hidden rounded-[20px] bg-white"
      style={{
        borderWidth: 1,
        borderColor: "#E8EEF5",
      }}
    >
      <View>
        {coverImageUrl ? (
          <Image
            source={{ uri: coverImageUrl }}
            className="h-[190px] w-full"
            resizeMode="cover"
            onError={(event) => {
              console.log(
                "FindEasy image load failed:",
                event.nativeEvent.error
              );
              console.log("Image URL:", coverImageUrl);
            }}
          />
        ) : (
          <View className="h-[190px] w-full items-center justify-center bg-[#EAF2FF]">
            <Text className="text-[40px]">🏠</Text>
            <Text className="mt-2 text-[12px] font-bold text-[#64748B]">
              No property photo
            </Text>
          </View>
        )}

        <Pressable
          onPress={toggleFavorite}
          disabled={favoriteLoading}
          accessibilityRole="button"
          accessibilityLabel={
            isFavorite ? "Remove from favorites" : "Add to favorites"
          }
          hitSlop={8}
          className="absolute right-3 top-3 h-11 w-11 items-center justify-center rounded-full bg-white"
          style={{
            elevation: 3,
            shadowColor: "#000",
            shadowOpacity: 0.12,
            shadowRadius: 4,
          }}
        >
          <Text className="text-[25px]">
            {isFavorite ? "❤️" : "♡"}
          </Text>
        </Pressable>
      </View>

      <View className="p-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text
              className="text-[17px] font-extrabold text-[#0F172A]"
              numberOfLines={1}
            >
              {listing.name}
            </Text>

            <Text
              className="mt-1 text-[12px] text-[#64748B]"
              numberOfLines={1}
            >
              {listing.area}, {listing.city}
            </Text>
          </View>

          <View className="rounded-full bg-[#EFF6FF] px-3 py-1">
            <Text className="text-[10px] font-extrabold text-[#2563EB]">
              {listing.property_type}
            </Text>
          </View>
        </View>

        <View className="mt-4 flex-row items-end justify-between">
          <View>
            <Text className="text-[19px] font-extrabold text-[#0F172A]">
              ₹{listing.monthly_price.toLocaleString("en-IN")}
            </Text>
            <Text className="text-[10px] text-[#64748B]">
              per month
            </Text>
          </View>

          <Text className="text-[12px] font-bold text-[#16A34A]">
            {listing.available_beds} beds available
          </Text>
        </View>

        <View className="mt-3 flex-row flex-wrap">
          <View className="mr-2 rounded-full bg-[#F8FAFC] px-3 py-1.5">
            <Text className="text-[10px] font-bold text-[#475569]">
              {listing.gender}
            </Text>
          </View>

          <View className="mr-2 rounded-full bg-[#F8FAFC] px-3 py-1.5">
            <Text className="text-[10px] font-bold text-[#475569]">
              {listing.ac_type}
            </Text>
          </View>

          {(listing.facilities ?? []).slice(0, 2).map((facility) => (
            <View
              key={facility}
              className="mr-2 rounded-full bg-[#F8FAFC] px-3 py-1.5"
            >
              <Text className="text-[10px] font-bold text-[#475569]">
                {facility}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Pressable>
  );
}
