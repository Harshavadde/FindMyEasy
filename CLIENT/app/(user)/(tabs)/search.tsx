import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentRef } from "react";

import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  type TextInputInstance,
  View,
} from "react-native";
import { BlurTargetView } from "expo-blur";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { useFocusEffect, useLocalSearchParams } from "expo-router";

import ListingCard from "../../../components/ListingCard";
import ListingDetailSheet from "../../../components/ListingDetailSheet";
import ScheduleVisitModal from "../../../components/ScheduleVisitModal";
import { USER_SCREEN_BACKGROUND } from "../../../constants/userDesign";
import { useBottomNavigationScroll } from "../../../contexts/BottomNavigationScrollContext";
import { getPublicListings } from "../../../services/api";
import type { Listing } from "../../../types/listing";
import type { NewScheduledVisit } from "../../../types/visit";
import { useFavoritesStore } from "../../../store/favoritesStore";
import { useScheduledVisitsStore } from "../../../store/scheduledVisitsStore";

type SuggestionType = "property" | "area" | "city";

type SearchSuggestion = {
  id: string;
  type: SuggestionType;
  title: string;
  subtitle: string;
  listing?: Listing;
};

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function matchesQuery(listing: Listing, query: string): boolean {
  const tokens = normalizeText(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const haystack = [
    listing.name,
    listing.area,
    listing.city,
    listing.address,
    listing.property_type,
  ]
    .map(normalizeText)
    .join(" ");

  return tokens.every((token) => haystack.includes(token));
}

function getSuggestionIcon(type: SuggestionType): string {
  if (type === "property") return "🏠";
  if (type === "area") return "📍";
  return "🏙️";
}

export default function UserSearch() {
  const { query: queryParam } = useLocalSearchParams<{
    query?: string | string[];
  }>();
  const {
    activateBlurTarget,
    deactivateBlurTarget,
    onScroll: handleBottomNavigationScroll,
  } = useBottomNavigationScroll();
  const screenBlurTarget = useRef<ComponentRef<typeof View> | null>(null);
  const [query, setQuery] = useState("");
  const [detailListing, setDetailListing] = useState<Listing | null>(null);
  const [visitListing, setVisitListing] = useState<Listing | null>(null);
  const addScheduledVisit = useScheduledVisitsStore((state) => state.addVisit);
  const showToast = useFavoritesStore((state) => state.showToast);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const inputRef = useRef<TextInputInstance | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const initialQuery = Array.isArray(queryParam) ? queryParam[0] : queryParam;
    if (typeof initialQuery === "string") setQuery(initialQuery);
  }, [queryParam]);

  useFocusEffect(
    useCallback(() => {
      activateBlurTarget(screenBlurTarget);
      return () => deactivateBlurTarget(screenBlurTarget);
    }, [activateBlurTarget, deactivateBlurTarget])
  );

  const loadListings = useCallback(async (forceRefresh = false) => {
    setLoadError(null);
    try {
      const data = await getPublicListings({ forceRefresh });
      setListings(data);
    } catch (error) {
      console.error("Search listings error:", error);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load properties. Please try again."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    []
  );

  const results = useMemo(
    () => listings.filter((listing) => matchesQuery(listing, query)),
    [listings, query]
  );

  const suggestions = useMemo<SearchSuggestion[]>(() => {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return [];

    const startsWithQuery = (value: unknown) =>
      normalizeText(value).startsWith(normalizedQuery) ? 0 : 1;

    const properties = listings
      .filter((listing) => matchesQuery(listing, normalizedQuery))
      .sort((a, b) => startsWithQuery(a.name) - startsWithQuery(b.name))
      .slice(0, 5)
      .map((listing) => ({
        id: `property-${listing.id}`,
        type: "property" as const,
        title: listing.name,
        subtitle: `${listing.area}, ${listing.city}`,
        listing,
      }));

    const areaMap = new Map<string, SearchSuggestion>();
    const cityMap = new Map<string, SearchSuggestion>();

    listings.forEach((listing) => {
      const area = String(listing.area ?? "").trim();
      const areaKey = normalizeText(area);
      if (area && areaKey.includes(normalizedQuery) && !areaMap.has(areaKey)) {
        areaMap.set(areaKey, {
          id: `area-${areaKey}`,
          type: "area",
          title: area,
          subtitle: listing.city ? `Area in ${listing.city}` : "Area",
        });
      }

      const city = String(listing.city ?? "").trim();
      const cityKey = normalizeText(city);
      if (city && cityKey.includes(normalizedQuery) && !cityMap.has(cityKey)) {
        cityMap.set(cityKey, {
          id: `city-${cityKey}`,
          type: "city",
          title: city,
          subtitle: "City",
        });
      }
    });

    const areas = Array.from(areaMap.values())
      .sort((a, b) => startsWithQuery(a.title) - startsWithQuery(b.title))
      .slice(0, 4);
    const cities = Array.from(cityMap.values())
      .sort((a, b) => startsWithQuery(a.title) - startsWithQuery(b.title))
      .slice(0, 3);

    return [...properties, ...areas, ...cities].slice(0, 10);
  }, [listings, query]);

  const selectSuggestion = (suggestion: SearchSuggestion) => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    Keyboard.dismiss();
    setSearchFocused(false);

    if (suggestion.type === "property" && suggestion.listing) {
      setDetailListing(suggestion.listing);
      return;
    }

    setQuery(suggestion.title);
  };

  const submitVisitRequest = (visit: NewScheduledVisit) => {
    addScheduledVisit(visit);
    setVisitListing(null);
    showToast("Visit request saved for this session.");
  };

  const onRefresh = () => {
    setRefreshing(true);
    void loadListings(true);
  };

  const showSuggestions = searchFocused && query.trim().length > 0;

  return (
    <BlurTargetView ref={screenBlurTarget} style={{ flex: 1 }}>
      <SafeAreaView
        className="flex-1"
        style={{ backgroundColor: USER_SCREEN_BACKGROUND }}
        edges={["top"]}
      >
      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={(event) =>
          handleBottomNavigationScroll(event.nativeEvent.contentOffset.y)
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 140,
          flexGrow: 1,
        }}
        ListHeaderComponent={
          <View className="pb-4">
            <Text className="text-[13px] font-bold text-[#2563EB]">
              FindEasy
            </Text>
            <Text className="mt-1 text-[25px] font-extrabold text-[#0F172A]">
              Search properties
            </Text>
            <Text className="mt-1 text-[12px] text-[#64748B]">
              Find PGs and hostels by name, area, city, or address.
            </Text>

            <View
              style={{
                marginTop: 16,
                minHeight: 52,
                paddingHorizontal: 14,
                flexDirection: "row",
                alignItems: "center",
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "#E2E8F0",
                backgroundColor: "#FFFFFF",
                shadowColor: "#0F172A",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 5,
                elevation: 1,
              }}
            >
              <MaterialCommunityIcons
                name="magnify"
                size={20}
                color="#64748B"
                style={{ marginRight: 10 }}
              />
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={setQuery}
                onFocus={() => {
                  if (blurTimer.current) clearTimeout(blurTimer.current);
                  setSearchFocused(true);
                }}
                onBlur={() => {
                  blurTimer.current = setTimeout(
                    () => setSearchFocused(false),
                    150
                  );
                }}
                onSubmitEditing={() => {
                  if (blurTimer.current) clearTimeout(blurTimer.current);
                  Keyboard.dismiss();
                  setSearchFocused(false);
                }}
                placeholder="Search by PG name, area or city"
                placeholderTextColor="#6B7280"
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
                className="h-[50px] flex-1 text-[14px] text-[#0F172A]"
                accessibilityLabel="Search properties"
              />
              {query.length > 0 && (
                <Pressable
                  onPress={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  className="ml-2 h-8 w-8 items-center justify-center rounded-full bg-[#F1F5F9]"
                  hitSlop={8}
                >
                  <Text className="text-[16px] font-bold text-[#64748B]">
                    ×
                  </Text>
                </Pressable>
              )}
            </View>

            {showSuggestions && (
              <View
                className="mt-2 overflow-hidden rounded-[18px] bg-white"
                style={{
                  shadowColor: "#0F172A",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 10,
                  elevation: 4,
                }}
              >
                {suggestions.length > 0 ? (
                  suggestions.map((suggestion, index) => (
                    <Pressable
                      key={suggestion.id}
                      onPressIn={() => {
                        if (blurTimer.current) clearTimeout(blurTimer.current);
                      }}
                      onPress={() => selectSuggestion(suggestion)}
                      className={`flex-row items-center px-4 py-3 ${
                        index !== suggestions.length - 1
                          ? "border-b border-[#F1F5F9]"
                          : ""
                      }`}
                    >
                      <View className="h-10 w-10 items-center justify-center rounded-full bg-[#EFF6FF]">
                        <Text className="text-[18px]">
                          {getSuggestionIcon(suggestion.type)}
                        </Text>
                      </View>
                      <View className="ml-3 flex-1">
                        <Text
                          numberOfLines={1}
                          className="text-[14px] font-bold text-[#0F172A]"
                        >
                          {suggestion.title}
                        </Text>
                        <Text
                          numberOfLines={1}
                          className="mt-1 text-[11px] text-[#64748B]"
                        >
                          {suggestion.subtitle}
                        </Text>
                      </View>
                      <Text className="ml-2 text-[18px] text-[#94A3B8]">›</Text>
                    </Pressable>
                  ))
                ) : (
                  <View className="px-5 py-6">
                    <Text className="text-center text-[14px] font-bold text-[#0F172A]">
                      No matching properties
                    </Text>
                    <Text className="mt-1 text-center text-[11px] text-[#64748B]">
                      Try another PG name, area, city, or address.
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View className="mt-6 flex-row items-center justify-between">
              <View>
                <Text className="text-[19px] font-extrabold text-[#0F172A]">
                  {query.trim() ? "Search results" : "All properties"}
                </Text>
                <Text className="mt-1 text-[11px] text-[#64748B]">
                  {query.trim()
                    ? `Results for "${query.trim()}"`
                    : "Browse available PGs and hostels"}
                </Text>
              </View>
              <Text className="text-[12px] font-bold text-[#2563EB]">
                {results.length} found
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <ListingCard
            listing={item}
            onPress={() => setDetailListing(item)}
            onScheduleVisit={() => setVisitListing(item)}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <View className="items-center pt-12">
              <ActivityIndicator size="large" color="#2563EB" />
              <Text className="mt-3 text-[12px] text-[#64748B]">
                Loading properties...
              </Text>
            </View>
          ) : loadError ? (
            <View className="items-center rounded-[20px] bg-white p-8">
              <Text className="text-[40px]">📡</Text>
              <Text className="mt-4 text-center text-[16px] font-extrabold text-[#0F172A]">
                Couldn’t load properties
              </Text>
              <Text className="mt-2 text-center text-[12px] text-[#64748B]">
                {loadError}
              </Text>
              <Pressable
                onPress={onRefresh}
                className="mt-5 rounded-full bg-[#2563EB] px-6 py-3"
              >
                <Text className="text-[12px] font-bold text-white">
                  Try Again
                </Text>
              </Pressable>
            </View>
          ) : (
            <View className="items-center py-16">
              <Text className="text-[40px]">🔍</Text>
              <Text className="mt-4 text-[16px] font-extrabold text-[#0F172A]">
                No properties found
              </Text>
              <Text className="mt-2 text-center text-[12px] text-[#64748B]">
                Try another PG name, area, city, or address.
              </Text>
            </View>
          )
        }
      />
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
      </SafeAreaView>
    </BlurTargetView>
  );
}