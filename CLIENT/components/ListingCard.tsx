import { useEffect } from "react";
import { API_BASE_URL } from "../constants/api";
import {
  Alert,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import type { Listing } from "../types/listing";
import type { ListingProximityBadge } from "../services/api";
import { useFavoritesStore } from "../store/favoritesStore";

type Props = {
  listing: Listing;
  onPress?: () => void;
  onRemoveFavorite?: () => void;
  compact?: boolean;
  proximityBadge?: ListingProximityBadge | null;
  distanceLabel?: string;
  imageHeight?: number;
  elevated?: boolean;
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
  onRemoveFavorite,
  compact = false,
  proximityBadge,
  distanceLabel,
  imageHeight,
  elevated = false,
}: Props) {
  const listingId = String(listing.id);
  const storedIsFavorite = useFavoritesStore((state) =>
    state.favoriteIds.has(listingId)
  );
  const isFavorite = Boolean(onRemoveFavorite) || storedIsFavorite;
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
    if (onRemoveFavorite) {
      onRemoveFavorite();
      return;
    }

    try {
      await toggleFavoriteInStore(listingId, listing);
    } catch (error) {
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
  const resolvedImageHeight =
    imageHeight ?? (compact ? 140 : 190);
  const sharingPrices = (listing.sharing ?? [])
    .map((sharing) => Number(sharing.monthly_price))
    .filter((price) => Number.isFinite(price) && price > 0);
  const startingPrice =
    sharingPrices.length > 0
      ? Math.min(...sharingPrices)
      : Number(listing.monthly_price);

  console.log("FindEasy cover image URL:", coverImage?.url);
  const proximityLabel =
    proximityBadge?.name;
  const proximityIcon =
    proximityBadge?.type === "bus"
      ? "bus"
      : proximityBadge?.type === "railway"
        ? "train"
      : proximityBadge?.type === "education"
        ? "school-outline"
        : proximityBadge?.type === "landmark"
          ? "office-building"
          : "train";
  const proximityColor =
    proximityBadge?.type === "education"
      ? "#FBBF24"
      : proximityBadge?.type === "bus"
        ? "#34D399"
        : proximityBadge?.type === "railway"
          ? "#FB923C"
      : proximityBadge?.type === "landmark"
        ? "#C084FC"
        : "#60A5FA";

  return (
    <Pressable
      onPress={onPress}
      className={`mb-4 overflow-hidden bg-white ${
        compact ? "rounded-[18px]" : "rounded-[20px]"
      }`}
      style={{
        borderWidth: 1,
        borderColor: "#E8EEF5",
        ...(elevated
          ? {
              elevation: 3,
              shadowColor: "#0F172A",
              shadowOpacity: 0.1,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 },
            }
          : {}),
      }}
    >
      <View>
        {coverImageUrl ? (
          <Image
            source={{ uri: coverImageUrl }}
            className="w-full"
            style={{ height: resolvedImageHeight }}
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
          <View
            className="w-full items-center justify-center bg-[#EAF2FF]"
            style={{ height: resolvedImageHeight }}
          >
            <Text className="text-[40px]">🏠</Text>
            <Text className="mt-2 text-[12px] font-bold text-[#64748B]">
              No property photo
            </Text>
          </View>
        )}

        {proximityBadge ? (
          <View
            accessibilityLabel={`${proximityBadge.distance_m} meters from ${
              proximityLabel ?? "nearby place"
            }`}
            className="absolute left-3 top-3 max-w-[75%] flex-row items-center rounded-[7px] bg-[#111827]/90 px-2.5 py-1.5"
          >
            <MaterialCommunityIcons
              name={proximityIcon}
              size={compact ? 13 : 15}
              color={proximityColor}
            />
            <Text
              numberOfLines={1}
              className="ml-1 text-[10px] font-extrabold text-white"
            >
              {proximityBadge.distance_m < 1000
                ? `${Math.max(
                    10,
                    Math.round(proximityBadge.distance_m / 10) * 10
                  )}m`
                : `${(proximityBadge.distance_m / 1000).toFixed(1)}km`}{" "}
              {proximityLabel}
            </Text>
          </View>
        ) : null}

        {distanceLabel ? (
          <View
            accessibilityLabel={`${distanceLabel} from your current location`}
            className="absolute left-3 top-3 flex-row items-center rounded-full border border-white/40 bg-[#0F172A]/90 py-1.5 pl-1.5 pr-3"
          >
            <View className="h-6 w-6 items-center justify-center rounded-full bg-[#2563EB]">
              <MaterialCommunityIcons
                name="map-marker"
                size={14}
                color="#FFFFFF"
              />
            </View>
            <Text className="ml-1.5 text-[11px] font-extrabold text-white">
              {distanceLabel}
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={toggleFavorite}
          disabled={favoriteLoading}
          accessibilityRole="button"
          accessibilityLabel={
            isFavorite ? "Remove from favorites" : "Add to favorites"
          }
          hitSlop={8}
          className={`absolute right-3 top-3 items-center justify-center rounded-full bg-white ${
            compact ? "h-9 w-9" : "h-11 w-11"
          }`}
          style={{
            elevation: 3,
            shadowColor: "#000",
            shadowOpacity: 0.12,
            shadowRadius: 4,
          }}
        >
          <Text className={compact ? "text-[21px]" : "text-[25px]"}>
            {isFavorite ? "❤️" : "♡"}
          </Text>
        </Pressable>
      </View>

      <View className={compact ? "p-4" : "p-5"}>
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text
              className={`font-extrabold text-[#0F172A] ${
                compact ? "text-[15px]" : "text-[17px]"
              }`}
              numberOfLines={1}
            >
              {listing.name}
            </Text>

            <Text
              className="mt-1 text-[11px] text-[#64748B]"
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

        <View className="my-4 h-px bg-[#E8EEF5]" />

        <View className="flex-row">
          <View className="mr-3 flex-1 rounded-[14px] bg-[#F8FAFC] px-3.5 py-3">
            <Text className="text-[10px] font-semibold text-[#64748B]">
              Starting from
            </Text>
            <Text
              numberOfLines={1}
              className={`font-extrabold text-[#0F172A] ${
                compact ? "text-[17px]" : "text-[19px]"
              }`}
            >
              ₹{startingPrice.toLocaleString("en-IN")}
            </Text>
            <Text className="text-[10px] text-[#64748B]">
              per month
            </Text>
          </View>

          <View className="flex-1 items-center justify-center rounded-[14px] bg-[#F0FDF4] px-3 py-3">
            <Text className="text-[18px] font-extrabold text-[#15803D]">
              {listing.available_beds}
            </Text>
            <Text className="mt-0.5 text-center text-[10px] font-semibold text-[#166534]">
              beds available
            </Text>
          </View>
        </View>

        <View className="mt-4 flex-row flex-wrap">
          <View className="mb-2 mr-2 rounded-full bg-[#F1F5F9] px-3 py-2">
            <Text className="text-[10px] font-bold text-[#475569]">
              {listing.gender}
            </Text>
          </View>

          <View className="mb-2 mr-2 rounded-full bg-[#F1F5F9] px-3 py-2">
            <Text className="text-[10px] font-bold text-[#475569]">
              {listing.ac_type}
            </Text>
          </View>

          {(listing.facilities ?? []).slice(0, 2).map((facility) => (
            <View
              key={facility}
              className="mb-2 mr-2 rounded-full bg-[#F1F5F9] px-3 py-2"
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
