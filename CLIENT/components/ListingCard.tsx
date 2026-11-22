import { useEffect } from "react";
import { API_BASE_URL } from "../constants/api";
import {
  Animated,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { USER_CARD_BORDER } from "../constants/userDesign";
import { usePressScale } from "../hooks/usePressScale";
import type { Listing } from "../types/listing";
import {
  getListingAudienceBadge,
  isVerifiedListing,
} from "../utils/listingPresentation";
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
  focused?: boolean;
  onScheduleVisit?: () => void;
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
  focused = false,
  onScheduleVisit,
}: Props) {
  const { scale, onPressIn, onPressOut } = usePressScale();
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
  const audienceBadge = getListingAudienceBadge(listing.gender);
  const verified = isVerifiedListing(listing.status);

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
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        className={`mb-4 bg-white ${
          compact ? "rounded-[18px]" : "rounded-[20px]"
        }`}
        style={[
          {
            borderWidth: 1,
            borderColor: USER_CARD_BORDER,
            shadowColor: "#000000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.06,
            shadowRadius: 20,
            elevation: 4,
          },
          elevated
            ? {
                elevation: 5,
                shadowOpacity: 0.08,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 5 },
              }
            : undefined,
          focused
            ? {
                elevation: 8,
                shadowOpacity: 0.15,
                shadowRadius: 25,
                shadowOffset: { width: 0, height: 10 },
              }
            : undefined,
        ]}
      >
        <View
          className={`overflow-hidden ${
            compact ? "rounded-t-[18px]" : "rounded-t-[20px]"
          }`}
        >
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

          <LinearGradient
            pointerEvents="none"
            colors={[
              "rgba(15, 23, 42, 0.02)",
              "rgba(15, 23, 42, 0.12)",
              "rgba(15, 23, 42, 0.88)",
            ]}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />

        {proximityBadge ? (
          <View
            accessibilityLabel={`${proximityBadge.distance_m} meters from ${
              proximityLabel ?? "nearby place"
            }`}
            className={`absolute left-3 max-w-[75%] flex-row items-center rounded-full bg-[#111827]/90 px-2.5 py-1.5 ${
              distanceLabel ? "top-14" : "top-3"
            }`}
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
          onPress={(event) => {
            event.stopPropagation();
            void toggleFavorite();
          }}
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
          <MaterialCommunityIcons
            name={isFavorite ? "heart" : "heart-outline"}
            size={compact ? 20 : 24}
            color={isFavorite ? "#E11D48" : "#334155"}
          />
        </Pressable>
        <View
          pointerEvents="none"
          className="absolute bottom-4 left-4 right-4 flex-row items-end justify-between"
        >
          <View className="flex-1 pr-3">
            {verified ? (
              <View className="mb-1.5 self-start flex-row items-center rounded-md bg-[#16A34A] px-2 py-1">
                <MaterialCommunityIcons
                  name="check-decagram"
                  size={12}
                  color="#FFFFFF"
                />
                <Text className="ml-1 text-[9px] font-extrabold text-white">
                  Verified
                </Text>
              </View>
            ) : null}
            <Text
              className={`font-extrabold text-white ${
                compact ? "text-[15px]" : "text-[17px]"
              }`}
              numberOfLines={1}
            >
              {listing.name}
            </Text>
            <Text
              className="mt-1 text-[11px] font-semibold text-white/90"
              numberOfLines={1}
            >
              {listing.area}, {listing.city}
            </Text>
          </View>
          <View className="items-end">
            <View className="rounded-full bg-white/95 px-3 py-1.5">
              <Text className="text-[10px] font-extrabold text-[#1D4ED8]">
                {listing.property_type}
              </Text>
            </View>
            {listing.food_available === "Yes" ? (
              <View className="mt-1 rounded-full bg-[#DCFCE7] px-2.5 py-1">
                <Text className="text-[9px] font-extrabold text-[#166534]">
                  FOOD INCLUDED
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        </View>

        <View
          className={`bg-white ${
            compact ? "rounded-b-[18px] p-4" : "rounded-b-[20px] p-5"
          }`}
        >
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
              <Text className="text-[10px] text-[#64748B]">per month</Text>
            </View>

            <View className="flex-1 items-end justify-center">
              <View className="flex-row items-center rounded-full border border-[#BBF7D0] bg-[#ECFDF5] px-2.5 py-2">
                <View className="mr-1.5 h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                <Text className="text-[10px] font-extrabold text-[#047857]">
                  {listing.available_beds} beds left
                </Text>
              </View>
            </View>
          </View>

          <View className="mt-4 flex-row flex-wrap">
            <View
              className="mb-2 mr-2 rounded-full border px-3 py-2"
              style={{
                backgroundColor: audienceBadge.backgroundColor,
                borderColor: audienceBadge.borderColor,
              }}
            >
              <Text
                className="text-[10px] font-extrabold"
                style={{ color: audienceBadge.textColor }}
              >
                {audienceBadge.label}
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

          {onScheduleVisit ? (
            <View className="mt-1 flex-row gap-2">
              {onPress ? (
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    onPress();
                  }}
                  accessibilityRole="button"
                  className="h-[44px] flex-1 items-center justify-center rounded-[13px] bg-[#4F46E5]"
                >
                  <Text className="text-[11px] font-extrabold text-white">
                    View Rooms &amp; Menu
                  </Text>
                </Pressable>
              ) : null}
              {onScheduleVisit ? (
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    onScheduleVisit();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Schedule a free visit to ${listing.name}`}
                  className="h-[44px] flex-1 flex-row items-center justify-center rounded-[13px] border border-[#BFDBFE] bg-[#EFF6FF]"
                >
                  <MaterialCommunityIcons
                    name="calendar-check-outline"
                    size={16}
                    color="#2563EB"
                  />
                  <Text className="ml-1.5 text-[11px] font-extrabold text-[#1D4ED8]">
                    Free Visit
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}
