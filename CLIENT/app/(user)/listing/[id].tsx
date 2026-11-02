import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "../../../constants/api";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { getPublicListing } from "../../../services/api";

import type { Listing, ListingSharing } from "../../../types/listing";

/* -------------------------------------------------------------------------- */
/*  Image helpers                                                             */
/* -------------------------------------------------------------------------- */

type ListingImage = NonNullable<Listing["images"]>[number];

type GalleryImage = {
  key: string;
  url: string;
  isCover: boolean;
};

// Only used when the backend returns relative paths such as "/uploads/a.jpg".
// Full https:// URLs (Cloudinary, S3, Supabase...) are used as they are.
const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");

function resolveImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;

  try {
    const parsed = new URL(url);

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

// Cleans the images saved by the owner: removes empty or duplicate URLs and
// always puts the COVER image first, followed by the other photos.
function buildGallery(
  images: Listing["images"] | null | undefined
): GalleryImage[] {
  const seen = new Set<string>();
  const list: GalleryImage[] = [];

  (images ?? []).forEach((image: ListingImage, index: number) => {
    if (typeof image.url !== "string" || !image.url.trim()) return;

   
const url = resolveImageUrl(image.url);

if (!url) return;
if (seen.has(url)) return;

seen.add(url);

list.push({
  key: `${image.id ?? "image"}-${index}`,
  url,
  isCover: image.image_type?.trim().toUpperCase() === "COVER",
});

  });

  const coverIndex = list.findIndex((item) => item.isCover);

  if (coverIndex > 0) {
    const [cover] = list.splice(coverIndex, 1);
    list.unshift(cover);
  }

  return list;
}

/* -------------------------------------------------------------------------- */
/*  Gallery                                                                   */
/* -------------------------------------------------------------------------- */

function RemoteImage({
  uri,
  width,
  height,
  fit = "cover",
  dark = false,
  onPress,
}: {
  uri: string;
  width: number;
  height: number;
  fit?: "cover" | "contain";
  dark?: boolean;
  onPress?: () => void;
}) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading"
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{
        width,
        height,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: dark ? "#000000" : "#EAF2FF",
      }}
    >
      {status !== "error" && (
        <Image
          source={{ uri }}
          style={{ width, height }}
          resizeMode={fit}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
        />
      )}

      {status === "loading" && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator color={dark ? "#FFFFFF" : "#2563EB"} />
        </View>
      )}

      {status === "error" && (
        <View className="items-center px-6">
          <MaterialCommunityIcons
            name="image-broken-variant"
            size={40}
            color={dark ? "#94A3B8" : "#64748B"}
          />
          <Text
            className="mt-2 text-center text-[12px]"
            style={{ color: dark ? "#CBD5E1" : "#64748B" }}
          >
            This photo could not be loaded
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function PropertyGallery({
  images,
  onBack,
}: {
  images: GalleryImage[];
  onBack: () => void;
}) {
  const { width, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const heroHeight = Math.round(width * 0.8);

  const heroRef = useRef<FlatList<GalleryImage>>(null);

  const [index, setIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);

  const total = images.length;
  const current = images[index];

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);

    setIndex(Math.min(Math.max(next, 0), Math.max(total - 1, 0)));
  };

  const goTo = (next: number) => {
    setIndex(next);

    heroRef.current?.scrollToIndex({ index: next, animated: true });
  };

  const closeViewer = () => {
    setViewerOpen(false);

    // The viewer may have changed the page, so bring the hero in sync.
    requestAnimationFrame(() => {
      heroRef.current?.scrollToIndex({ index, animated: false });
    });
  };

  const backButton = (
    <Pressable
      onPress={onBack}
      hitSlop={10}
      accessibilityLabel="Go back"
      style={{
        position: "absolute",
        left: 16,
        top: insets.top + 8,
        height: 42,
        width: 42,
        borderRadius: 21,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.92)",
      }}
    >
      <MaterialCommunityIcons name="chevron-left" size={28} color="#0F172A" />
    </Pressable>
  );

  /* ---- No photos uploaded by the owner ---- */
  if (total === 0) {
    return (
      <View className="bg-white">
        <View
          className="items-center justify-center bg-[#EAF2FF]"
          style={{ height: heroHeight }}
        >
          <MaterialCommunityIcons
            name="image-off-outline"
            size={56}
            color="#94A3B8"
          />
          <Text className="mt-3 text-[13px] font-semibold text-[#64748B]">
            The owner has not added photos yet
          </Text>
        </View>

        {backButton}
      </View>
    );
  }

  return (
    <View className="bg-white">
      {/* ---- Hero carousel: cover first, then the other photos ---- */}
      <View>
        <FlatList
          ref={heroRef}
          data={images}
          keyExtractor={(item) => item.key}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScrollEnd}
          getItemLayout={(_, i) => ({
            length: width,
            offset: width * i,
            index: i,
          })}
          renderItem={({ item }) => (
            <RemoteImage
              uri={item.url}
              width={width}
              height={heroHeight}
              onPress={() => setViewerOpen(true)}
            />
          )}
        />

        {backButton}

        {/* Fullscreen hint */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            right: 16,
            top: insets.top + 8,
            height: 42,
            width: 42,
            borderRadius: 21,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(15,23,42,0.55)",
          }}
        >
          <MaterialCommunityIcons name="arrow-expand" size={20} color="#FFFFFF" />
        </View>

        {/* Cover label */}
        {current?.isCover && (
          <View
            pointerEvents="none"
            className="absolute bottom-4 left-4 rounded-full px-3 py-1.5"
            style={{ backgroundColor: "#FFC72C" }}
          >
            <Text className="text-[11px] font-extrabold text-[#1B2433]">
              Cover photo
            </Text>
          </View>
        )}

        {/* Counter */}
        {total > 1 && (
          <View
            pointerEvents="none"
            className="absolute bottom-4 right-4 rounded-full px-3 py-1.5"
            style={{ backgroundColor: "rgba(15,23,42,0.65)" }}
          >
            <Text className="text-[11px] font-bold text-white">
              {index + 1} / {total}
            </Text>
          </View>
        )}
      </View>

      {/* ---- Thumbnails ---- */}
      {total > 1 && (
        <FlatList
          data={images}
          keyExtractor={(item) => `thumb-${item.key}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            gap: 10,
          }}
          renderItem={({ item, index: i }) => {
            const active = i === index;

            return (
              <Pressable
                onPress={() => goTo(i)}
                style={{
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: active ? "#2563EB" : "transparent",
                  opacity: active ? 1 : 0.75,
                  overflow: "hidden",
                }}
              >
                <Image
                  source={{ uri: item.url }}
                  style={{ width: 72, height: 56, backgroundColor: "#EAF2FF" }}
                  resizeMode="cover"
                />
              </Pressable>
            );
          }}
        />
      )}

      {/* ---- Fullscreen viewer ---- */}
      <Modal
        visible={viewerOpen}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeViewer}
      >
        <View style={{ flex: 1, backgroundColor: "#000000" }}>
          <FlatList
            data={images}
            keyExtractor={(item) => `viewer-${item.key}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={index}
            onMomentumScrollEnd={handleScrollEnd}
            getItemLayout={(_, i) => ({
              length: width,
              offset: width * i,
              index: i,
            })}
            renderItem={({ item }) => (
              <RemoteImage
                uri={item.url}
                width={width}
                height={screenHeight}
                fit="contain"
                dark
              />
            )}
          />

          <Pressable
            onPress={closeViewer}
            hitSlop={10}
            accessibilityLabel="Close photo viewer"
            style={{
              position: "absolute",
              right: 16,
              top: insets.top + 8,
              height: 42,
              width: 42,
              borderRadius: 21,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.18)",
            }}
          >
            <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
          </Pressable>

          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              bottom: insets.bottom + 20,
              alignSelf: "center",
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 6,
              backgroundColor: "rgba(255,255,255,0.18)",
            }}
          >
            <Text className="text-[12px] font-bold text-white">
              {index + 1} / {total}
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Screen                                                                    */
/* -------------------------------------------------------------------------- */

export default function UserListingDetails() {
  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const listingId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSharingType, setSelectedSharingType] = useState<string | null>(
    null
  );
  const [sharingDropdownOpen, setSharingDropdownOpen] = useState(false);

  const sharingOptions = listing?.sharing ?? [];
  const sharingGroups = useMemo(() => {
    const groups = new Map<
      string,
      { key: string; label: string; options: ListingSharing[] }
    >();
    sharingOptions.forEach((item) => {
      const label = item.sharing_type.trim();
      const key = label.toLowerCase();
      const group = groups.get(key);
      if (group) {
        group.options.push(item);
      } else {
        groups.set(key, { key, label, options: [item] });
      }
    });
    return Array.from(groups.values());
  }, [sharingOptions]);

  const selectedSharingGroup =
    sharingGroups.find((group) => group.key === selectedSharingType) ?? null;

  const gallery = useMemo(
    () => buildGallery(listing?.images),
    [listing?.images]
  );

  const loadListing = useCallback(async () => {
    try {
      const data = await getPublicListing(listingId!);

      setListing(data);
      setSelectedSharingType(null);
      setSharingDropdownOpen(false);
    } catch (error: any) {
      console.error("Listing details error:", error);

      Alert.alert(
        "Unable to load property",
        error?.message || "This property could not be loaded.",
        [
          {
            text: "Go Back",
            onPress: () => router.back(),
          },
        ]
      );
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    if (!listingId) {
      setLoading(false);
      return;
    }

    loadListing();
  }, [listingId, loadListing]);

  const openMaps = async () => {
    if (!listing?.latitude || !listing?.longitude) {
      Alert.alert(
        "Location unavailable",
        "This property does not have map coordinates."
      );
      return;
    }

    const url =
      `https://www.google.com/maps/search/?api=1` +
      `&query=${listing.latitude},${listing.longitude}`;

    await Linking.openURL(url);
  };

  const callOwner = async () => {
    if (!listing?.owner_phone) {
      Alert.alert(
        "Phone unavailable",
        "Owner phone number is not available."
      );
      return;
    }

    await Linking.openURL(`tel:${listing.owner_phone}`);
  };

  const whatsappOwner = async () => {
    if (!listing?.owner_phone) {
      Alert.alert(
        "Phone unavailable",
        "Owner phone number is not available."
      );
      return;
    }

    const phone = listing.owner_phone.replace(/[^0-9]/g, "");

    await Linking.openURL(`https://wa.me/${phone}`);
  };

  const openNearbyEssentials = async (searchTerm: string) => {
    const latitude = Number(listing?.latitude);
    const longitude = Number(listing?.longitude);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      Alert.alert(
        "Location unavailable",
        "This property does not have valid map coordinates."
      );
      return;
    }

    const query = encodeURIComponent(
      `${searchTerm} near ${latitude},${longitude}`
    );
    try {
      await Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${query}`
      );
    } catch (error: unknown) {
      Alert.alert(
        "Unable to open map",
        error instanceof Error
          ? error.message
          : "Please try opening the map again."
      );
    }
  };

  const handleBack = () => {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/(user)/home");
  }
};

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F9FD]">
        <ActivityIndicator size="large" color="#2563EB" />

        <Text className="mt-3 text-[12px] text-[#64748B]">
          Loading property...
        </Text>
      </View>
    );
  }

  if (!listing) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F9FD] px-6">
        <Text className="text-[18px] font-extrabold text-[#0F172A]">
          Property not found
        </Text>
      </View>
    );
  }

  const selectedSharingPrice = selectedSharingGroup
    ? Math.min(
        ...selectedSharingGroup.options.map((item) =>
          Number(item.monthly_price)
        )
      )
    : null;
  const startingPrice = sharingOptions.length
    ? Math.min(...sharingOptions.map((item) => Number(item.monthly_price)))
    : Number(listing.monthly_price);
  const totalBeds = sharingOptions.reduce(
    (total, item) => total + Number(item.total_beds || 0),
    0
  );
  const availableBeds = sharingOptions.reduce(
    (total, item) => total + Number(item.available_beds || 0),
    0
  );
  const filledBeds = sharingOptions.reduce(
    (total, item) => total + Number(item.filled_beds || 0),
    0
  );
  const occupancy = totalBeds
    ? Math.round((filledBeds / totalBeds) * 100)
    : 0;

  return (
    <View className="flex-1 bg-[#F5F9FD]">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 24,
        }}
      >
        {/* COVER IMAGE AND PROPERTY PHOTOS (from the owner's uploads) */}
        <PropertyGallery images={gallery} onBack={handleBack} />

        <View className="p-5">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-[25px] font-extrabold text-[#0F172A]">
                {listing.name}
              </Text>

              <Text className="mt-2 text-[13px] text-[#64748B]">
                {listing.area}, {listing.city}
              </Text>
            </View>

            <View className="rounded-full bg-[#EFF6FF] px-3 py-2">
              <Text className="text-[11px] font-extrabold text-[#2563EB]">
                {listing.property_type}
              </Text>
            </View>
          </View>

          <View className="mt-5 rounded-[18px] bg-white p-4">
            <Text className="text-[12px] text-[#64748B]">
              {selectedSharingGroup ? "Monthly Rent" : "Starting from"}
            </Text>

            <Text className="mt-1 text-[25px] font-extrabold text-[#0F172A]">
              ₹{Number(selectedSharingPrice ?? startingPrice).toLocaleString(
                "en-IN"
              )}
            </Text>

            <Text className="mt-1 text-[11px] text-[#64748B]">
              Security deposit: ₹
              {(listing.security_deposit || 0).toLocaleString("en-IN")}
            </Text>
          </View>

          {/* BEDS AND SHARING */}
          <Section title="Beds & Availability">
            {(() => {
              return (
                <>
                  {sharingOptions.length ? (
                    <>
                      <View className="flex-row justify-between rounded-[14px] bg-[#F8FAFC] px-3 py-3">
                        <InfoItem label="Total beds" value={String(totalBeds)} />
                        <InfoItem
                          label="Available"
                          value={String(availableBeds)}
                        />
                        <InfoItem label="Filled" value={String(filledBeds)} />
                      </View>

                      <View className="mt-4">
                        <View className="mb-2 flex-row items-center justify-between">
                          <Text className="text-[12px] font-bold text-[#475569]">
                            Occupancy
                          </Text>
                          <Text className="text-[12px] font-extrabold text-[#2563EB]">
                            {occupancy}% filled
                          </Text>
                        </View>
                        <View className="h-2 overflow-hidden rounded-full bg-[#E2E8F0]">
                          <View
                            className="h-2 rounded-full bg-[#2563EB]"
                            style={{ width: `${occupancy}%` }}
                          />
                        </View>
                      </View>

                      <View className="mb-3 mt-5">
                        <Text className="text-[14px] font-extrabold text-[#0F172A]">
                          Find your room
                        </Text>
                        <Text className="mt-1 text-[12px] leading-5 text-[#64748B]">
                          Choose a sharing option to compare floors, beds, and
                          monthly rent.
                        </Text>
                      </View>
                    </>
                  ) : null}
                  {sharingOptions.length ? (
                    <>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{
                          expanded: sharingDropdownOpen,
                        }}
                        onPress={() =>
                          setSharingDropdownOpen((isOpen) => !isOpen)
                        }
                        className={`flex-row items-center justify-between rounded-[14px] border px-4 py-3.5 ${
                          selectedSharingGroup
                            ? "border-[#BFDBFE] bg-[#EFF6FF]"
                            : "border-[#2563EB] bg-white"
                        }`}
                      >
                        <Text
                          className={`text-[13px] font-bold ${
                            selectedSharingGroup
                              ? "text-[#0F172A]"
                              : "text-[#64748B]"
                          }`}
                        >
                          {selectedSharingGroup
                            ? `${selectedSharingGroup.label} Sharing`
                            : "Tap to choose sharing"}
                        </Text>
                        <MaterialCommunityIcons
                          name={
                            sharingDropdownOpen
                              ? "chevron-up"
                              : "chevron-down"
                          }
                          size={20}
                          color="#2563EB"
                        />
                      </Pressable>

                      {sharingDropdownOpen ? (
                        <View className="mt-1 overflow-hidden rounded-[12px] border border-[#E2E8F0] bg-white">
                          {sharingGroups.map((group, index) => {
                            const isSelected = group.key === selectedSharingType;
                            const groupStartingPrice = Math.min(
                              ...group.options.map((item) =>
                                Number(item.monthly_price)
                              )
                            );
                            return (
                              <Pressable
                                key={group.key}
                                accessibilityRole="button"
                                accessibilityState={{ selected: isSelected }}
                                onPress={() => {
                                  setSelectedSharingType(group.key);
                                  setSharingDropdownOpen(false);
                                }}
                                className={`flex-row items-center justify-between px-4 py-3 ${
                                  index < sharingGroups.length - 1
                                    ? "border-b border-[#F1F5F9]"
                                    : ""
                                }`}
                              >
                                <Text
                                  className={`text-[13px] font-semibold ${
                                    isSelected
                                      ? "text-[#2563EB]"
                                      : "text-[#334155]"
                                  }`}
                                >
                                  {group.label} Sharing
                                </Text>
                                <Text className="text-[12px] font-bold text-[#0F172A]">
                                  From ₹{groupStartingPrice.toLocaleString("en-IN")}
                                  /month
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      ) : null}

                      {selectedSharingGroup ? (
                        <View className="mt-3 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]">
                          {selectedSharingGroup.options.map((item, index) => (
                            <View
                              key={item.id || `${item.sharing_type}-${index}`}
                              className={`flex-row items-center justify-between px-4 py-3.5 ${
                                index < selectedSharingGroup.options.length - 1
                                  ? "border-b border-[#E2E8F0]"
                                  : ""
                              }`}
                            >
                              <View className="mr-3 flex-1">
                                <Text className="text-[13px] font-extrabold text-[#0F172A]">
                                  {item.floor?.trim()
                                    ? formatFloor(item.floor)
                                    : item.ac_type || "Sharing option"}
                                </Text>
                                {item.floor?.trim() && item.ac_type ? (
                                  <Text className="mt-0.5 text-[11px] font-semibold text-[#64748B]">
                                    {item.ac_type}
                                  </Text>
                                ) : null}
                                <Text className="mt-1 text-[11px] text-[#64748B]">
                                  {item.available_beds} available of{" "}
                                  {item.total_beds} beds
                                  {Number(item.filled_beds) > 0
                                    ? ` · ${item.filled_beds} filled`
                                    : ""}
                                </Text>
                              </View>
                              <Text className="text-[13px] font-extrabold text-[#2563EB]">
                                ₹
                                {Number(item.monthly_price).toLocaleString(
                                  "en-IN"
                                )}
                                <Text className="text-[10px] font-semibold text-[#64748B]">
                                  /month
                                </Text>
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </>
                  ) : (
                    <Text className="text-[13px] text-[#64748B]">
                      Sharing details are not available.
                    </Text>
                  )}
                </>
              );
            })()}
          </Section>

          {listing.description ? (
            <Section title="About this property">
              <Text className="text-[13px] leading-6 text-[#475569]">
                {listing.description}
              </Text>
            </Section>
          ) : null}

          <Section title="Property Details">
            <DetailRow label="For" value={listing.gender} />

            <DetailRow label="AC" value={listing.ac_type} />

            <DetailRow label="Food" value={listing.food_available} />

            <DetailRow label="Address" value={listing.address} />
          </Section>

          {(listing.facilities ?? []).length > 0 && (
            <Section title="Facilities">
              <View className="flex-row flex-wrap">
                {(listing.facilities ?? []).map((facility: string) => (
                  <View
                    key={facility}
                    className="mb-2 mr-2 rounded-full bg-[#EFF6FF] px-3 py-2"
                  >
                    <Text className="text-[11px] font-bold text-[#2563EB]">
                      ✓ {facility}
                    </Text>
                  </View>
                ))}
              </View>
            </Section>
          )}

          {/* FOOD AND MEAL TIMINGS */}
          <Section title="Food & Meal Timings">
            <DetailRow
              label="Food available"
              value={listing.food_available || "Not provided"}
            />

            {listing.food_available !== "Yes" ? (
              <DetailRow label="Meals" value="Food not provided" />
            ) : (
              <>
                {listing.food_type ? (
                  <DetailRow label="Food type" value={listing.food_type} />
                ) : null}
                {[
              {
                label: "Breakfast",
                start: listing.breakfast_start_time,
                end: listing.breakfast_end_time,
              },
              {
                label: "Lunch",
                start: listing.lunch_start_time,
                end: listing.lunch_end_time,
              },
              {
                label: "Dinner",
                start: listing.dinner_start_time,
                end: listing.dinner_end_time,
              },
            ].map((meal) => (
              <DetailRow
                key={meal.label}
                label={meal.label}
                value={
                  meal.start && meal.end
                    ? `${meal.start} – ${meal.end}`
                    : meal.start || meal.end || "Not set"
                }
              />
            ))}
              </>
            )}
          </Section>

          {listing.restrictions ? (
            <Section title="Rules & Restrictions">
              <Text className="text-[13px] leading-6 text-[#475569]">
                {listing.restrictions}
              </Text>
            </Section>
          ) : null}

          {/* OWNER CONTACT */}
          <Section title="Owner Contact">
            {listing.owner_phone ? (
              <>
                <Text className="mb-4 text-[16px] font-extrabold text-[#0F172A]">
                  {listing.owner_phone}
                </Text>

                <View className="flex-row">
                  <Pressable
                    onPress={callOwner}
                    className="mr-2 flex-1 items-center rounded-[14px] bg-[#16A34A] py-3.5"
                  >
                    <Text className="font-extrabold text-white">📞 Call</Text>
                  </Pressable>

                  <Pressable
                    onPress={whatsappOwner}
                    className="ml-2 flex-1 items-center rounded-[14px] bg-[#DCFCE7] py-3.5"
                  >
                    <Text className="font-extrabold text-[#15803D]">
                      WhatsApp
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Text className="text-[13px] text-[#64748B]">
                Owner contact information is not available.
              </Text>
            )}
          </Section>

          <Section title="Find essentials nearby">
            <Text className="mb-4 text-[12px] leading-5 text-[#64748B]">
              Explore useful places around this property
            </Text>
            <View className="flex-row flex-wrap justify-between">
              {([
                {
                  label: "Metro",
                  subtitle: "Stations",
                  icon: "train",
                  color: "#2563EB",
                  background: "#EFF6FF",
                  query: "metro stations",
                },
                {
                  label: "IT Parks",
                  subtitle: "Workplaces",
                  icon: "office-building",
                  color: "#7C3AED",
                  background: "#F5F3FF",
                  query: "IT parks",
                },
                {
                  label: "Coaching",
                  subtitle: "Education hubs",
                  icon: "school-outline",
                  color: "#D97706",
                  background: "#FFFBEB",
                  query: "coaching centers",
                },
                {
                  label: "Bus Stops",
                  subtitle: "Nearby transit",
                  icon: "bus",
                  color: "#059669",
                  background: "#ECFDF5",
                  query: "bus stops",
                },
              ] as const).map((item) => (
                <Pressable
                  key={item.query}
                  accessibilityRole="button"
                  accessibilityLabel={`Find nearby ${item.label} on map`}
                  onPress={() => void openNearbyEssentials(item.query)}
                  className="mb-3 w-[48%] rounded-[16px] border border-[#E2E8F0] bg-white p-3"
                >
                  <View
                    className="mb-3 h-10 w-10 items-center justify-center rounded-[13px]"
                    style={{ backgroundColor: item.background }}
                  >
                    <MaterialCommunityIcons
                      name={item.icon}
                      size={22}
                      color={item.color}
                    />
                  </View>
                  <Text className="text-[13px] font-extrabold text-[#0F172A]">
                    {item.label}
                  </Text>
                  <View className="mt-1 flex-row items-center justify-between">
                    <Text className="text-[10px] text-[#64748B]">
                      {item.subtitle}
                    </Text>
                    <MaterialCommunityIcons
                      name="arrow-top-right"
                      size={15}
                      color="#94A3B8"
                    />
                  </View>
                </Pressable>
              ))}
            </View>
          </Section>

          <Section title="Location">
            <Text className="text-[13px] leading-6 text-[#475569]">
              {listing.address}
            </Text>

            {listing.latitude && listing.longitude ? (
              <Text className="mt-2 text-[11px] text-[#64748B]">
                {listing.latitude}, {listing.longitude}
              </Text>
            ) : null}

            <Pressable
              onPress={openMaps}
              className="mt-4 h-[50px] items-center justify-center rounded-[14px] bg-[#EFF6FF]"
            >
              <Text className="text-[13px] font-extrabold text-[#2563EB]">
                🗺️ Get Directions
              </Text>
            </Pressable>
          </Section>
        </View>
      </ScrollView>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Small components                                                          */
/* -------------------------------------------------------------------------- */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mt-4 rounded-[18px] bg-white p-4">
      <Text className="mb-4 text-[16px] font-extrabold text-[#0F172A]">
        {title}
      </Text>

      {children}
    </View>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <View className="mr-5">
      <Text className="text-[11px] text-[#64748B]">{label}</Text>

      <Text className="mt-1 text-[14px] font-extrabold text-[#0F172A]">
        {value}
      </Text>
    </View>
  );
}

function formatFloor(floor: string): string {
  const value = floor.trim();
  const match = value.match(/^(-?\d+)(?:st|nd|rd|th)?(?:\s*floor)?$/i);
  if (!match) return value;

  const floorNumber = Number(match[1]);
  const lastTwoDigits = Math.abs(floorNumber) % 100;
  const suffix =
    lastTwoDigits >= 11 && lastTwoDigits <= 13
      ? "th"
      : Math.abs(floorNumber) % 10 === 1
        ? "st"
        : Math.abs(floorNumber) % 10 === 2
          ? "nd"
          : Math.abs(floorNumber) % 10 === 3
            ? "rd"
            : "th";
  return `${floorNumber}${suffix} floor`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-3 flex-row">
      <Text className="w-[110px] text-[12px] font-bold text-[#64748B]">
        {label}
      </Text>

      <Text className="flex-1 text-[12px] font-semibold text-[#334155]">
        {value}
      </Text>
    </View>
  );
}