import React, { useCallback, useMemo, useRef, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { router, useFocusEffect } from "expo-router";

import { API_BASE_URL } from "../../../constants/api";

// ============================================================================
// TYPES
// ============================================================================

type ListingSharing = {
  id: string;
  sharing_type: string;
  monthly_price: number;
  total_beds: number;
  available_beds: number;
  filled_beds: number;
};

type Listing = {
  id: string;

  owner_phone: string | null;

  name: string;
  property_type: string;
  gender: string;
  description: string | null;

  security_deposit: number | null;

  sharing: ListingSharing[] | null;

  ac_type: string;
  facilities: string[];

  food_available: string;
  food_type: string | null;

  breakfast_start_time: string | null;
  breakfast_end_time: string | null;

  lunch_start_time: string | null;
  lunch_end_time: string | null;

  dinner_start_time: string | null;
  dinner_end_time: string | null;

  city: string;
  area: string;
  address: string;

  latitude: string | null;
  longitude: string | null;

  restrictions: string | null;

  status: string;
};

type LoadMode = "initial" | "refresh" | "silent";

const REQUEST_TIMEOUT_MS = 15000;

// ============================================================================
// HELPERS
// ============================================================================

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}

/** Indian digit grouping: 1234567 -> ₹12,34,567 */
function formatINR(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }

  const n = Math.round(Number(value));
  const digits = String(Math.abs(n));
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);

  const grouped = rest
    ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}`
    : last3;

  return `₹${n < 0 ? "-" : ""}${grouped}`;
}

function statusStyle(status: string) {
  switch ((status || "").toLowerCase()) {
    case "published":
    case "active":
      return { bg: "#DCFCE7", fg: "#15803D" };
    case "pending":
    case "under_review":
      return { bg: "#DBEAFE", fg: "#1D4ED8" };
    case "rejected":
    case "archived":
      return { bg: "#FEE2E2", fg: "#B91C1C" };
    default:
      return { bg: "#FEF3C7", fg: "#B45309" };
  }
}

function statusLabel(status: string): string {
  return (status || "unknown").replace(/_/g, " ");
}

function getSharing(listing: Listing): ListingSharing[] {
  return Array.isArray(listing.sharing) ? listing.sharing : [];
}

function sharingLabel(value: string): string {
  return /^\d+$/.test(String(value)) ? `${value} Sharing` : String(value);
}

function getBedStats(listing: Listing) {
  const sharing = getSharing(listing);

  const total = sharing.reduce((sum, item) => sum + (item.total_beds || 0), 0);
  const available = sharing.reduce(
    (sum, item) => sum + (item.available_beds || 0),
    0
  );
  const filled = Math.max(total - available, 0);

  return {
    total,
    available,
    filled,
    occupancy: total > 0 ? Math.round((filled / total) * 100) : 0,
  };
}

function getStartingPrice(listing: Listing): number | null {
  const prices = getSharing(listing)
    .map((item) => Number(item.monthly_price))
    .filter((price) => Number.isFinite(price));

  return prices.length > 0 ? Math.min(...prices) : null;
}

/** Every word typed must appear somewhere in the listing's text. */
function matchesQuery(listing: Listing, query: string): boolean {
  const tokens = query.split(/\s+/).filter(Boolean);

  if (tokens.length === 0) return true;

  const haystack = [
    listing.name,
    listing.city,
    listing.area,
    listing.address,
    listing.property_type,
    listing.gender,
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");

  return tokens.every((token) => haystack.includes(token));
}

// ============================================================================
// SMALL COMPONENTS
// ============================================================================

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="mr-2 rounded-full px-4 py-2.5"
      style={{
        backgroundColor: active ? "#2563EB" : "#FFFFFF",
        borderWidth: 1,
        borderColor: active ? "#2563EB" : "#E2E8F0",
      }}
    >
      <Text
        className="text-[12px] font-bold capitalize"
        style={{ color: active ? "#FFFFFF" : "#475569" }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <View className="flex-1 items-center">
      <Text className="text-[22px] font-extrabold text-white">{value}</Text>
      <Text className="mt-0.5 text-[10px] font-bold uppercase text-[#BFDBFE]">
        {label}
      </Text>
    </View>
  );
}

// ============================================================================
// SCREEN
// ============================================================================

export default function MyListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const hasLoadedRef = useRef(false);

  // ==========================================================================
  // LOAD
  // ==========================================================================

  const loadListings = useCallback(async (mode: LoadMode = "initial") => {
    if (mode === "refresh") setRefreshing(true);
    else if (mode === "initial") setLoading(true);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const url = `${API_BASE_URL}/api/v1/owner/listings`;

      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      const raw = await response.text();

      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : `Failed to load listings (${response.status}).`
        );
      }

      setListings(Array.isArray(data) ? data : []);
      setError(null);
      hasLoadedRef.current = true;
    } catch (err: unknown) {
      const aborted = err instanceof Error && err.name === "AbortError";
      const network = err instanceof TypeError;

      const message = aborted
        ? "The server took too long to respond."
        : network
          ? `Cannot reach the server at ${API_BASE_URL}. Check that FastAPI is running and your phone is on the same Wi-Fi.`
          : getErrorMessage(err, "Something went wrong while loading your properties.");

      console.warn("Failed to load listings:", message);

      // Background refreshes fail quietly; the user keeps what they see.
      if (mode !== "silent") setError(message);
    } finally {
      clearTimeout(timer);
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Runs on first open AND whenever the screen regains focus
  // (e.g. coming back from creating a property). One request, no flicker.
  useFocusEffect(
    useCallback(() => {
      loadListings(hasLoadedRef.current ? "silent" : "initial");
    }, [loadListings])
  );

  // ==========================================================================
  // DERIVED DATA
  // ==========================================================================

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();

    listings.forEach((listing) => {
      const key = (listing.status || "unknown").toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return counts;
  }, [listings]);

  const filteredListings = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return listings.filter((listing) => {
      if (
        statusFilter !== "all" &&
        (listing.status || "unknown").toLowerCase() !== statusFilter
      ) {
        return false;
      }

      return matchesQuery(listing, query);
    });
  }, [listings, searchText, statusFilter]);

  const overview = useMemo(() => {
    let total = 0;
    let available = 0;

    listings.forEach((listing) => {
      const stats = getBedStats(listing);
      total += stats.total;
      available += stats.available;
    });

    const filled = Math.max(total - available, 0);

    return {
      total,
      available,
      occupancy: total > 0 ? Math.round((filled / total) * 100) : 0,
    };
  }, [listings]);

  const hasFilters = searchText.trim().length > 0 || statusFilter !== "all";

  const clearFilters = () => {
    setSearchText("");
    setStatusFilter("all");
  };

  // ==========================================================================
  // NAVIGATION
  // ==========================================================================

  const handleAddListing = () => {
    router.push("/(owner)/listings/create");
  };

  const openListingDetails = (listingId: string) => {
    router.push({
      pathname: "/(owner)/listings/listing-details",
      params: { id: String(listingId) },
    });
  };

  const openPhotos = (listingId: string) => {
    router.push({
      pathname: "/(owner)/listings/photos",
      params: { listingId: String(listingId) },
    });
  };

  const openMembers = (listing: Listing) => {
    if (!listing.owner_phone) {
      Alert.alert(
        "Owner phone unavailable",
        "The owner phone number is missing for this property."
      );
      return;
    }

    router.push({
      pathname: "/(owner)/members/[listingId]",
      params: {
        listingId: String(listing.id),
        ownerPhone: listing.owner_phone,
      },
    });
  };

  // ==========================================================================
  // UI
  // ==========================================================================

  return (
    <SafeAreaView className="flex-1 bg-[#F5F9FD]">
      <View className="flex-1">

        {/* HEADER */}

        <View className="border-b border-[#E8EEF5] bg-[#F5F9FD] px-5 pb-4 pt-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Pressable
                onPress={() => router.back()}
                className="mr-3 h-11 w-11 items-center justify-center rounded-full bg-white"
                style={({ pressed }) => ({
                  transform: [{ scale: pressed ? 0.94 : 1 }],
                  shadowColor: "#64748B",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 6,
                  elevation: 2,
                })}
              >
                <Text className="text-[24px] font-medium text-[#0F172A]">‹</Text>
              </Pressable>

              <View>
                <Text className="text-[25px] font-extrabold text-[#0F172A]">
                  My Listings
                </Text>

                <Text className="mt-1 text-[12px] text-[#64748B]">
                  Manage your PGs and hostels
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handleAddListing}
              className="h-11 w-11 items-center justify-center rounded-full bg-[#2563EB]"
              style={({ pressed }) => ({
                transform: [{ scale: pressed ? 0.94 : 1 }],
                shadowColor: "#2563EB",
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.2,
                shadowRadius: 7,
                elevation: 3,
              })}
            >
              <Text className="text-[27px] font-light text-white">+</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadListings("refresh")}
            />
          }
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: 40,
          }}
        >
          {/* LOADING */}

          {loading ? (
            <View className="items-center py-24">
              <ActivityIndicator size="large" color="#2563EB" />

              <Text className="mt-3 text-[13px] text-[#64748B]">
                Loading your properties...
              </Text>
            </View>
          ) : error && listings.length === 0 ? (
            /* ERROR (nothing loaded) */

            <View className="mt-4 items-center rounded-[26px] bg-white px-6 py-10">
              <Text className="text-[42px]">📡</Text>

              <Text className="mt-4 text-center text-[19px] font-extrabold text-[#0F172A]">
                Couldn't load your properties
              </Text>

              <Text className="mt-2 text-center text-[13px] leading-5 text-[#64748B]">
                {error}
              </Text>

              <Pressable
                onPress={() => loadListings("initial")}
                className="mt-6 rounded-full bg-[#2563EB] px-8 py-3.5"
              >
                <Text className="text-[14px] font-extrabold text-white">
                  Try Again
                </Text>
              </Pressable>
            </View>
          ) : listings.length === 0 ? (
            /* EMPTY */

            <View
              className="mt-2 items-center rounded-[26px] bg-white px-6 py-10"
              style={{
                borderWidth: 1,
                borderColor: "#E4EAF1",
                borderStyle: "dashed",
              }}
            >
              <View className="h-[88px] w-[88px] items-center justify-center rounded-full bg-[#EAF2FF]">
                <Text className="text-[40px]">🏠</Text>
              </View>

              <Text className="mt-6 text-center text-[20px] font-extrabold text-[#0F172A]">
                No properties yet
              </Text>

              <Text className="mt-2 max-w-[280px] text-center text-[13px] leading-5 text-[#64748B]">
                Add your first PG or hostel to start managing your property and
                receiving enquiries.
              </Text>

              <Pressable
                onPress={handleAddListing}
                className="mt-6 flex-row items-center rounded-full bg-[#14B8A6] px-6 py-3.5"
                style={({ pressed }) => ({
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                  shadowColor: "#14B8A6",
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.18,
                  shadowRadius: 7,
                  elevation: 3,
                })}
              >
                <Text className="mr-2 text-[20px] font-medium text-white">+</Text>

                <Text className="text-[14px] font-extrabold text-white">
                  Add Property
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* STALE-DATA BANNER */}

              {error && (
                <View className="mb-4 rounded-[16px] bg-[#FEF3C7] p-3">
                  <Text className="text-[12px] font-bold text-[#92400E]">
                    Couldn't refresh. Showing the last loaded data.
                  </Text>
                </View>
              )}

              {/* OVERVIEW */}

              <View className="mb-5 flex-row rounded-[22px] bg-[#2563EB] px-2 py-5">
                <StatTile label="Properties" value={listings.length} />
                <StatTile label="Total beds" value={overview.total} />
                <StatTile label="Available" value={overview.available} />
                <StatTile label="Occupied" value={`${overview.occupancy}%`} />
              </View>

              {/* SEARCH */}

              <View
                className="flex-row items-center rounded-[18px] bg-white px-4"
                style={{
                  height: 54,
                  borderWidth: 1,
                  borderColor: "#E5EAF0",
                }}
              >
                <Text className="mr-3 text-[20px] text-[#94A3B8]">⌕</Text>

                <TextInput
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder="Search name, area, city..."
                  placeholderTextColor="#94A3B8"
                  autoCorrect={false}
                  returnKeyType="search"
                  className="flex-1 text-[14px] text-[#0F172A]"
                />

                {searchText.length > 0 && (
                  <Pressable
                    onPress={() => setSearchText("")}
                    hitSlop={8}
                    className="ml-2 h-8 w-8 items-center justify-center rounded-full bg-[#F1F5F9]"
                  >
                    <Text className="text-[16px] font-bold text-[#64748B]">×</Text>
                  </Pressable>
                )}
              </View>

              {/* STATUS TABS */}

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mt-4"
              >
                <Chip
                  label={`All (${listings.length})`}
                  active={statusFilter === "all"}
                  onPress={() => setStatusFilter("all")}
                />

                {Array.from(statusCounts.entries()).map(([status, count]) => (
                  <Chip
                    key={status}
                    label={`${statusLabel(status)} (${count})`}
                    active={statusFilter === status}
                    onPress={() => setStatusFilter(status)}
                  />
                ))}
              </ScrollView>

              {/* COUNT */}

              <View className="mt-5 flex-row items-center justify-between">
                <Text className="text-[18px] font-extrabold text-[#0F172A]">
                  Properties
                </Text>

                <Text className="text-[12px] font-bold text-[#64748B]">
                  {hasFilters
                    ? `${filteredListings.length} of ${listings.length}`
                    : `${listings.length} ${listings.length === 1 ? "property" : "properties"
                    }`}
                </Text>
              </View>

              {/* NO MATCHES */}

              {filteredListings.length === 0 ? (
                <View className="mt-4 items-center rounded-[26px] bg-white px-6 py-10">
                  <Text className="text-[18px] font-extrabold text-[#0F172A]">
                    No matching properties
                  </Text>

                  <Text className="mt-2 text-center text-[13px] leading-5 text-[#64748B]">
                    Try a different name, area or city, or change the status
                    filter.
                  </Text>

                  <Pressable
                    onPress={clearFilters}
                    className="mt-5 rounded-full bg-[#2563EB] px-6 py-3"
                  >
                    <Text className="text-[12px] font-bold text-white">
                      Clear Filters
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View className="mt-4">
                  {filteredListings.map((listing) => {
                    const sharing = getSharing(listing);
                    const stats = getBedStats(listing);
                    const startingPrice = getStartingPrice(listing);
                    const badge = statusStyle(listing.status);
                    const isDraft =
                      (listing.status || "").toLowerCase() === "draft";
                    const isFull = stats.total > 0 && stats.available === 0;

                    return (
                      <View
                        key={listing.id}
                        className="mb-4 rounded-[26px] bg-white p-4"
                        style={{
                          shadowColor: "#64748B",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.06,
                          shadowRadius: 8,
                          elevation: 2,
                        }}
                      >
                        {/* SUMMARY */}

                        <Pressable
                          onPress={() => openListingDetails(listing.id)}
                          style={({ pressed }) => ({
                            opacity: pressed ? 0.92 : 1,
                          })}
                        >
                          <View className="flex-row">
                            <View className="h-[104px] w-[104px] items-center justify-center rounded-[20px] bg-[#EAF7F5]">
                              <Text className="text-[48px]">🏠</Text>
                            </View>

                            <View className="ml-4 flex-1">
                              <View className="flex-row items-start justify-between">
                                <Text
                                  numberOfLines={2}
                                  className="flex-1 pr-2 text-[17px] font-extrabold text-[#111827]"
                                >
                                  {listing.name}
                                </Text>

                                <View
                                  className="rounded-full px-2.5 py-1"
                                  style={{ backgroundColor: badge.bg }}
                                >
                                  <Text
                                    className="text-[10px] font-bold capitalize"
                                    style={{ color: badge.fg }}
                                  >
                                    {statusLabel(listing.status)}
                                  </Text>
                                </View>
                              </View>

                              <Text
                                numberOfLines={1}
                                className="mt-2 text-[12px] text-[#64748B]"
                              >
                                📍 {listing.area}, {listing.city}
                              </Text>

                              <Text className="mt-2 text-[13px] font-semibold text-[#475569]">
                                {listing.property_type}
                                {" • "}
                                {listing.gender}
                                {listing.ac_type ? ` • ${listing.ac_type}` : ""}
                              </Text>

                              <View className="mt-2 flex-row items-baseline">
                                <Text className="text-[18px] font-extrabold text-[#2563EB]">
                                  {startingPrice !== null
                                    ? formatINR(startingPrice)
                                    : "—"}
                                </Text>

                                {startingPrice !== null && (
                                  <Text className="ml-1 text-[11px] text-[#64748B]">
                                    / month onwards
                                  </Text>
                                )}
                              </View>
                            </View>
                          </View>
                        </Pressable>

                        {/* OCCUPANCY */}

                        {stats.total > 0 && (
                          <View className="mt-4">
                            <View className="mb-1.5 flex-row justify-between">
                              <Text className="text-[12px] font-bold text-[#475569]">
                                {stats.available} of {stats.total} beds available
                              </Text>

                              <Text
                                className="text-[12px] font-extrabold"
                                style={{ color: isFull ? "#DC2626" : "#0F172A" }}
                              >
                                {isFull ? "Full" : `${stats.occupancy}% occupied`}
                              </Text>
                            </View>

                            <View className="h-2 overflow-hidden rounded-full bg-[#E2E8F0]">
                              <View
                                className="h-2 rounded-full"
                                style={{
                                  width: `${stats.occupancy}%` as `${number}%`,
                                  backgroundColor: isFull ? "#DC2626" : "#2563EB",
                                }}
                              />
                            </View>
                          </View>
                        )}

                        {/* SHARING BREAKDOWN */}

                        {sharing.length > 0 && (
                          <View className="mt-4 rounded-[18px] bg-[#F8FAFC] p-3">
                            <Text className="mb-2 text-[12px] font-bold text-[#475569]">
                              Sharing & Availability
                            </Text>

                            {sharing.map((item, index) => (
                              <View
                                key={item.id ?? `${item.sharing_type}-${index}`}
                                className={`flex-row items-center justify-between ${index < sharing.length - 1 ? "mb-2" : ""
                                  }`}
                              >
                                <View className="flex-1">
                                  <Text className="text-[13px] font-bold text-[#0F172A]">
                                    {sharingLabel(item.sharing_type)}
                                  </Text>

                                  <Text className="mt-0.5 text-[11px] text-[#64748B]">
                                    {item.filled_beds} filled
                                    {" • "}
                                    {item.available_beds} available
                                  </Text>
                                </View>

                                <View className="items-end">
                                  <Text className="text-[13px] font-extrabold text-[#2563EB]">
                                    {formatINR(item.monthly_price)}
                                  </Text>

                                  <Text className="text-[10px] text-[#64748B]">
                                    / month
                                  </Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* DRAFT HINT */}

                        {isDraft && (
                          <View className="mt-4 flex-row items-center rounded-[16px] bg-[#FFFBEB] p-3">
                            <Text className="mr-2 text-[18px]">📷</Text>

                            <Text className="flex-1 text-[12px] leading-5 text-[#92400E]">
                              This property is a draft. Add photos to complete
                              it.
                            </Text>

                            <Pressable
                              onPress={() => openPhotos(listing.id)}
                              className="ml-2 rounded-full bg-[#F59E0B] px-4 py-2"
                            >
                              <Text className="text-[12px] font-extrabold text-white">
                                Add Photos
                              </Text>
                            </Pressable>
                          </View>
                        )}

                        <View className="my-4 h-[1px] bg-[#E8EEF5]" />

                        {/* ACTIONS */}

                        <View className="flex-row" style={{ columnGap: 12 }}>
                          <Pressable
                            onPress={() => openMembers(listing)}
                            className="flex-1 flex-row items-center justify-center rounded-[16px] bg-[#EAF2FF] py-3"
                            style={({ pressed }) => ({
                              opacity: listing.owner_phone
                                ? pressed
                                  ? 0.75
                                  : 1
                                : 0.5,
                            })}
                          >
                            <Text className="mr-2 text-[16px]">👥</Text>

                            <Text className="text-[13px] font-extrabold text-[#2563EB]">
                              Members
                            </Text>
                          </Pressable>

                          <Pressable
                            onPress={() => openListingDetails(listing.id)}
                            className="flex-1 flex-row items-center justify-center rounded-[16px] bg-[#2563EB] py-3"
                            style={({ pressed }) => ({
                              opacity: pressed ? 0.75 : 1,
                            })}
                          >
                            <Text className="mr-2 text-[16px]">🏠</Text>

                            <Text className="text-[13px] font-extrabold text-white">
                              View Details
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* INFO */}

              <View className="mt-2 rounded-[20px] bg-[#EAF2FF] p-4">
                <View className="flex-row items-start">
                  <View className="h-9 w-9 items-center justify-center rounded-full bg-[#D7E6FF]">
                    <Text className="text-[16px] font-bold text-[#2563EB]">i</Text>
                  </View>

                  <View className="ml-3 flex-1">
                    <Text className="text-[14px] font-bold text-[#1E3A8A]">
                      Manage your properties
                    </Text>

                    <Text className="mt-1 text-[12px] leading-5 text-[#475569]">
                      Use View Details to manage your property information, or
                      Members to manage residents, beds and payments.
                    </Text>
                  </View>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}