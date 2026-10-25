import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import { SafeAreaView } from "react-native-safe-area-context";

import { router } from "expo-router";

import ListingCard from "../../../components/ListingCard";
import { getPublicListings } from "../../../services/api";
import type { Listing } from "../../../types/listing";

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
  const [query, setQuery] = useState("");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const inputRef = useRef<TextInputInstance | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadListings = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await getPublicListings();
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
      router.push({
        pathname: "/(user)/listing/[id]",
        params: { id: String(suggestion.listing.id) },
      });
      return;
    }

    setQuery(suggestion.title);
  };

  const onRefresh = () => {
    setRefreshing(true);
    void loadListings();
  };

  const showSuggestions = searchFocused && query.trim().length > 0;

  return (
    <SafeAreaView className="flex-1 bg-[#F5F9FD]" edges={["top"]}>
      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 40,
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
              className={`mt-5 flex-row items-center rounded-[18px] bg-white px-4 ${
                searchFocused
                  ? "border-2 border-[#2563EB]"
                  : "border border-[#E2E8F0]"
              }`}
              style={{ minHeight: 56 }}
            >
              <Text className="mr-3 text-[21px]">🔍</Text>
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
                placeholder="Search PGs, hostels or areas..."
                placeholderTextColor="#94A3B8"
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
                className="flex-1 text-[15px] text-[#0F172A]"
                style={{ minHeight: 54 }}
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
            onPress={() =>
              router.push({
                pathname: "/(user)/listing/[id]",
                params: { id: String(item.id) },
              })
            }
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
    </SafeAreaView>
  );
}