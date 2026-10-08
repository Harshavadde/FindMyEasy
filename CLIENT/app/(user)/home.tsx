import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import * as Location from "expo-location";
import { router } from "expo-router";

import ListingCard from "../../components/ListingCard";
import { getPublicListings } from "../../services/api";
import type { Listing } from "../../types/listing";

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

type SuggestionType = "property" | "area" | "city";

type SearchSuggestion = {
  id: string;
  type: SuggestionType;
  title: string;
  subtitle: string;
  listing?: Listing;
};

type NearbyMode = "all" | "nearby";
type GenderFilter = "All" | "Men's" | "Women's" | "Co-living";
type SortMode = "recommended" | "price_low" | "price_high";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type ResultItem = {
  listing: Listing;
  distance: number | null;
};

const RADIUS_OPTIONS = [2, 5, 10, 20];

const GENDER_FILTERS: GenderFilter[] = [
  "All",
  "Men's",
  "Women's",
  "Co-living",
];

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "price_low", label: "Price: Low to High" },
  { value: "price_high", label: "Price: High to Low" },
];

const PLACE_SHORTCUTS = [
  { icon: "🚇", label: "Metro", query: "metro stations" },
  { icon: "🎓", label: "Coaching", query: "coaching centers" },
  { icon: "🏢", label: "Offices", query: "office locations" },
];

// ============================================================================
// HELPERS
// ============================================================================

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}

/** Reads a field that may not be declared on the Listing type. */
function readField(listing: Listing, key: string): unknown {
  return (listing as unknown as Record<string, unknown>)[key];
}

function getPrice(listing: Listing): number | null {
  const value = Number(readField(listing, "monthly_price"));
  return Number.isFinite(value) ? value : null;
}

/** Every word typed must appear somewhere in the listing's searchable text. */
function matchesQuery(listing: Listing, query: string): boolean {
  const tokens = query.split(/\s+/).filter(Boolean);

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

function getDistanceKm(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number
): number {
  const earthRadiusKm = 6371;

  const dLat = ((latitude2 - latitude1) * Math.PI) / 180;
  const dLon = ((longitude2 - longitude1) * Math.PI) / 180;

  const lat1 = (latitude1 * Math.PI) / 180;
  const lat2 = (latitude2 * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(Math.round(km * 1000), 50)} m away`;
  return `${km.toFixed(1)} km away`;
}

// ============================================================================
// SMALL COMPONENTS
// ============================================================================

function Chip({
  icon,
  label,
  active = false,
  disabled = false,
  onPress,
}: {
  icon?: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      className="mr-2 flex-row items-center rounded-full px-4 py-2.5"
      style={{
        backgroundColor: active ? "#2563EB" : "#FFFFFF",
        borderWidth: 1,
        borderColor: active ? "#2563EB" : "#E2E8F0",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {icon ? <Text className="mr-1 text-[14px]">{icon}</Text> : null}

      <Text
        className="text-[12px] font-bold"
        style={{ color: active ? "#FFFFFF" : "#334155" }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function RowLabel({ children }: { children: string }) {
  return (
    <Text className="mb-2 mt-4 text-[11px] font-extrabold uppercase text-[#94A3B8]">
      {children}
    </Text>
  );
}

// ============================================================================
// USER HOME
// ============================================================================

export default function UserHome() {
  // --------------------------------------------------------------------------
  // DATA
  // --------------------------------------------------------------------------

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // SEARCH & FILTERS
  // --------------------------------------------------------------------------

  const [searchText, setSearchText] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("All");
  const [sortMode, setSortMode] = useState<SortMode>("recommended");

  const inputRef = useRef<TextInput>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --------------------------------------------------------------------------
  // NEARBY
  // --------------------------------------------------------------------------

  const [nearbyMode, setNearbyMode] = useState<NearbyMode>("all");
  const [radiusKm, setRadiusKm] = useState(10);
  const [currentCoordinates, setCurrentCoordinates] =
    useState<Coordinates | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  // ==========================================================================
  // LOAD LISTINGS
  // ==========================================================================

  const loadListings = useCallback(async () => {
    try {
      setLoadError(null);

      const data = await getPublicListings();

      setListings(data);
    } catch (error: unknown) {
      console.warn("User listings error:", getErrorMessage(error, "Unknown"));

      setLoadError(
        getErrorMessage(
          error,
          "Please check your internet connection and try again."
        )
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  useEffect(() => {
    return () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadListings();
  };

  const handleRetry = () => {
    setLoading(true);
    loadListings();
  };

  // ==========================================================================
  // LOCATION
  // ==========================================================================

  const getCurrentLocation = async (
    silent = false
  ): Promise<Coordinates | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        if (!silent) {
          Alert.alert(
            "Location Permission Required",
            "Please allow location access to find places near you."
          );
        }

        return null;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();

      if (!servicesEnabled) {
        if (!silent) {
          Alert.alert(
            "Location Services Disabled",
            "Please turn on GPS/location services and try again."
          );
        }

        return null;
      }

      // Balanced is much faster than High and plenty accurate for browsing.
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error: unknown) {
      console.warn("Location error:", getErrorMessage(error, "Unknown"));

      if (!silent) {
        Alert.alert(
          "Unable to Get Location",
          "We couldn't get your current location. Please try again."
        );
      }

      return null;
    }
  };

  // ==========================================================================
  // RESET
  // ==========================================================================

  const resetAll = () => {
    setSearchText("");
    setNearbyMode("all");
    setGenderFilter("All");
    setSortMode("recommended");
    setSearchFocused(false);
    Keyboard.dismiss();
  };

  // ==========================================================================
  // NEAR ME
  // ==========================================================================

  const handleNearMe = async () => {
    setLocationLoading(true);

    try {
      const location = await getCurrentLocation();

      if (!location) return;

      setCurrentCoordinates(location);
      setNearbyMode("nearby");
      setSearchText("");
      setSearchFocused(false);
      Keyboard.dismiss();
    } finally {
      setLocationLoading(false);
    }
  };

  // ==========================================================================
  // METRO / COACHING / OFFICES (opens maps)
  // ==========================================================================

  const handleNearbyPlaceSearch = async (placeType: string) => {
    setLocationLoading(true);

    try {
      // Silent: if location is unavailable we still open maps with "near me".
      const location = await getCurrentLocation(true);

      const url = location
        ? `https://www.google.com/maps/search/${encodeURIComponent(
            placeType
          )}/@${location.latitude},${location.longitude},14z`
        : `https://www.google.com/maps/search/${encodeURIComponent(
            `${placeType} near me`
          )}`;

      await Linking.openURL(url);
    } catch (error: unknown) {
      console.warn("Nearby place search error:", getErrorMessage(error, "Unknown"));

      Alert.alert(
        "Unable to Open Maps",
        "Please make sure Google Maps or a browser is available and try again."
      );
    } finally {
      setLocationLoading(false);
    }
  };

  // ==========================================================================
  // SEARCH INPUT
  // ==========================================================================

  const handleSearchTextChange = (text: string) => {
    setSearchText(text);

    // Typing leaves Near Me mode.
    if (nearbyMode === "nearby") setNearbyMode("all");
  };

  const handleSearchFocus = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setSearchFocused(true);
  };

  // Delayed so a tap on a suggestion registers before the list disappears.
  const handleSearchBlur = () => {
    blurTimer.current = setTimeout(() => setSearchFocused(false), 150);
  };

  const handleClearSearch = () => {
    setSearchText("");
    setNearbyMode("all");
    inputRef.current?.focus();
  };

  // ==========================================================================
  // AUTOCOMPLETE SUGGESTIONS
  // ==========================================================================

  const suggestions = useMemo<SearchSuggestion[]>(() => {
    const query = normalizeText(searchText);

    if (!query) return [];

    const startsWithQuery = (value: unknown) =>
      normalizeText(value).startsWith(query) ? 0 : 1;

    // Properties: names that START with the query first.
    const properties: SearchSuggestion[] = listings
      .filter((listing) => matchesQuery(listing, query))
      .sort((a, b) => startsWithQuery(a.name) - startsWithQuery(b.name))
      .slice(0, 5)
      .map((listing) => ({
        id: `property-${listing.id}`,
        type: "property",
        title: listing.name,
        subtitle: `${listing.area}, ${listing.city}`,
        listing,
      }));

    // Areas
    const areaMap = new Map<string, SearchSuggestion>();

    listings.forEach((listing) => {
      const area = String(listing.area ?? "").trim();
      const key = normalizeText(area);

      if (!area || !key.includes(query) || areaMap.has(key)) return;

      areaMap.set(key, {
        id: `area-${key}`,
        type: "area",
        title: area,
        subtitle: listing.city ? `Area in ${listing.city}` : "Area",
      });
    });

    const areas = Array.from(areaMap.values())
      .sort((a, b) => startsWithQuery(a.title) - startsWithQuery(b.title))
      .slice(0, 4);

    // Cities
    const cityMap = new Map<string, SearchSuggestion>();

    listings.forEach((listing) => {
      const city = String(listing.city ?? "").trim();
      const key = normalizeText(city);

      if (!city || !key.includes(query) || cityMap.has(key)) return;

      cityMap.set(key, {
        id: `city-${key}`,
        type: "city",
        title: city,
        subtitle: "City",
      });
    });

    const cities = Array.from(cityMap.values())
      .sort((a, b) => startsWithQuery(a.title) - startsWithQuery(b.title))
      .slice(0, 3);

    return [...properties, ...areas, ...cities].slice(0, 10);
  }, [listings, searchText]);

  const handleSelectSuggestion = (suggestion: SearchSuggestion) => {
    Keyboard.dismiss();
    setSearchFocused(false);

    // A specific property opens directly. Areas and cities filter the list.
    if (suggestion.type === "property" && suggestion.listing) {
      router.push({
        pathname: "/(user)/listing/[id]",
        params: { id: String(suggestion.listing.id) },
      });
      return;
    }

    setNearbyMode("all");
    setSearchText(suggestion.title);
  };

  // ==========================================================================
  // RESULTS (search / nearby + gender filter + sorting)
  // ==========================================================================

  const results = useMemo<ResultItem[]>(() => {
    let items: ResultItem[] = [];

    if (nearbyMode === "nearby" && currentCoordinates) {
      listings.forEach((listing) => {
        const latitude = Number(listing.latitude);
        const longitude = Number(listing.longitude);

        // Skip listings without valid coordinates.
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

        const distance = getDistanceKm(
          currentCoordinates.latitude,
          currentCoordinates.longitude,
          latitude,
          longitude
        );

        if (distance <= radiusKm) items.push({ listing, distance });
      });
    } else {
      const query = normalizeText(searchText);

      items = listings
        .filter((listing) => matchesQuery(listing, query))
        .map((listing) => ({ listing, distance: null }));
    }

    if (genderFilter !== "All") {
      const wanted = normalizeText(genderFilter);

      items = items.filter(
        ({ listing }) => normalizeText(readField(listing, "gender")) === wanted
      );
    }

    if (sortMode === "price_low" || sortMode === "price_high") {
      const direction = sortMode === "price_low" ? 1 : -1;

      items = [...items].sort((a, b) => {
        const priceA = getPrice(a.listing);
        const priceB = getPrice(b.listing);

        // Listings without a price always go last.
        if (priceA === null && priceB === null) return 0;
        if (priceA === null) return 1;
        if (priceB === null) return -1;

        return (priceA - priceB) * direction;
      });
    } else if (nearbyMode === "nearby") {
      items = [...items].sort(
        (a, b) => (a.distance ?? 0) - (b.distance ?? 0)
      );
    }

    return items;
  }, [
    listings,
    searchText,
    nearbyMode,
    currentCoordinates,
    radiusKm,
    genderFilter,
    sortMode,
  ]);

  // ==========================================================================
  // DERIVED UI STATE
  // ==========================================================================

  const isNearby = nearbyMode === "nearby";
  const hasSearch = searchText.trim().length > 0;
  const showSuggestions = searchFocused && hasSearch;

  const hasActiveFilters =
    hasSearch ||
    isNearby ||
    genderFilter !== "All" ||
    sortMode !== "recommended";

  const resultsTitle = isNearby
    ? "Nearby Properties"
    : hasSearch
    ? "Search Results"
    : "All Properties";

  const resultsSubtitle = isNearby
    ? `PGs and hostels within ${radiusKm} km`
    : hasSearch
    ? `Results for "${searchText.trim()}"`
    : "Properties from all owners";

  // ==========================================================================
  // UI
  // ==========================================================================

  return (
    <View className="flex-1 bg-[#F5F9FD]">
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 55,
          paddingBottom: 40,
        }}
      >
        {/* HEADER */}

        <Text className="text-[13px] font-bold text-[#2563EB]">
          FindMyEasy
        </Text>

        <Text className="mt-1 text-[27px] font-extrabold text-[#0F172A]">
          Find your perfect stay
        </Text>

        <Text className="mt-2 text-[13px] leading-5 text-[#64748B]">
          Explore PGs and hostels from owners around you.
        </Text>

        {/* SEARCH BAR */}

        <View
          className={`mt-5 flex-row items-center rounded-[18px] bg-white px-4 ${
            searchFocused
              ? "border-2 border-[#2563EB]"
              : "border border-[#E2E8F0]"
          }`}
          style={{
            minHeight: 56,
            shadowColor: "#0F172A",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <Text className="mr-3 text-[21px]">🔍</Text>

          <TextInput
            ref={inputRef}
            value={searchText}
            onChangeText={handleSearchTextChange}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            placeholder="Search PGs, hostels or areas..."
            placeholderTextColor="#94A3B8"
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            className="flex-1 text-[15px] text-[#0F172A]"
            style={{ minHeight: 54 }}
            onSubmitEditing={() => {
              Keyboard.dismiss();
              setSearchFocused(false);
            }}
          />

          {searchText.length > 0 && (
            <Pressable
              onPress={handleClearSearch}
              className="ml-2 h-8 w-8 items-center justify-center rounded-full bg-[#F1F5F9]"
              hitSlop={8}
            >
              <Text className="text-[16px] font-bold text-[#64748B]">×</Text>
            </Pressable>
          )}
        </View>

        {/* SUGGESTIONS
            Rendered in normal flow (not absolutely positioned) so every row
            is tappable on Android too. */}

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
                  onPress={() => handleSelectSuggestion(suggestion)}
                  className={`flex-row items-center px-4 py-3 ${
                    index !== suggestions.length - 1
                      ? "border-b border-[#F1F5F9]"
                      : ""
                  }`}
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? "#F8FAFC" : "white",
                  })}
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
                  Try another PG name, area or city.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* QUICK OPTIONS */}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          className="mt-3"
          contentContainerStyle={{ paddingRight: 10 }}
        >
          <Chip
            icon="🏠"
            label="All"
            active={!hasActiveFilters}
            onPress={resetAll}
          />

          <Chip
            icon="📍"
            label={locationLoading ? "Getting location..." : "Near Me"}
            active={isNearby}
            disabled={locationLoading}
            onPress={handleNearMe}
          />

          {PLACE_SHORTCUTS.map((place) => (
            <Chip
              key={place.label}
              icon={place.icon}
              label={place.label}
              disabled={locationLoading}
              onPress={() => handleNearbyPlaceSearch(place.query)}
            />
          ))}
        </ScrollView>

        {/* RADIUS (Near Me only) */}

        {isNearby && (
          <>
            <RowLabel>Search radius</RowLabel>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {RADIUS_OPTIONS.map((km) => (
                <Chip
                  key={km}
                  label={`${km} km`}
                  active={radiusKm === km}
                  onPress={() => setRadiusKm(km)}
                />
              ))}
            </ScrollView>
          </>
        )}

        {/* GENDER FILTER */}

        <RowLabel>Property for</RowLabel>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {GENDER_FILTERS.map((option) => (
            <Chip
              key={option}
              label={option}
              active={genderFilter === option}
              onPress={() => setGenderFilter(option)}
            />
          ))}
        </ScrollView>

        {/* SORT */}

        <RowLabel>Sort by</RowLabel>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {SORT_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              active={sortMode === option.value}
              onPress={() => setSortMode(option.value)}
            />
          ))}
        </ScrollView>

        {/* SUMMARY CARD */}

        <View className="mt-6 rounded-[18px] bg-[#2563EB] p-5">
          <Text className="text-[12px] font-bold text-[#BFDBFE]">
            AVAILABLE PROPERTIES
          </Text>

          <Text className="mt-1 text-[28px] font-extrabold text-white">
            {isNearby ? results.length : listings.length}
          </Text>

          <Text className="mt-1 text-[11px] text-[#DBEAFE]">
            {isNearby
              ? `PGs & hostels within ${radiusKm} km`
              : "PGs & hostels available right now"}
          </Text>
        </View>

        {/* RESULTS HEADER */}

        <View className="mt-7 flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-[19px] font-extrabold text-[#0F172A]">
              {resultsTitle}
            </Text>

            <Text className="mt-1 text-[11px] text-[#64748B]">
              {resultsSubtitle}
            </Text>
          </View>

          <Text className="text-[12px] font-bold text-[#2563EB]">
            {results.length} found
          </Text>
        </View>

        {/* LISTINGS */}

        <View className="mt-4">
          {loading ? (
            <View className="items-center py-16">
              <ActivityIndicator size="large" color="#2563EB" />

              <Text className="mt-3 text-[12px] text-[#64748B]">
                Loading properties...
              </Text>
            </View>
          ) : loadError ? (
            <View className="items-center rounded-[20px] bg-white p-8">
              <Text className="text-[42px]">📡</Text>

              <Text className="mt-4 text-center text-[17px] font-extrabold text-[#0F172A]">
                Couldn't load properties
              </Text>

              <Text className="mt-2 text-center text-[12px] leading-5 text-[#64748B]">
                {loadError}
              </Text>

              <Pressable
                onPress={handleRetry}
                className="mt-5 rounded-full bg-[#2563EB] px-6 py-3"
              >
                <Text className="text-[12px] font-bold text-white">
                  Try Again
                </Text>
              </Pressable>
            </View>
          ) : results.length === 0 ? (
            <View className="items-center rounded-[20px] bg-white p-8">
              <Text className="text-[42px]">{isNearby ? "📍" : "🔍"}</Text>

              <Text className="mt-4 text-center text-[17px] font-extrabold text-[#0F172A]">
                {isNearby
                  ? "No nearby properties found"
                  : "No properties found"}
              </Text>

              <Text className="mt-2 text-center text-[12px] leading-5 text-[#64748B]">
                {isNearby
                  ? `No PGs or hostels with valid location data were found within ${radiusKm} km. Try a larger radius.`
                  : "Try another PG name, area or city, or change your filters."}
              </Text>

              {hasActiveFilters && (
                <Pressable
                  onPress={resetAll}
                  className="mt-5 rounded-full bg-[#2563EB] px-6 py-3"
                >
                  <Text className="text-[12px] font-bold text-white">
                    Show All Properties
                  </Text>
                </Pressable>
              )}
            </View>
          ) : (
            results.map(({ listing, distance }) => (
              <View key={listing.id}>
                {distance !== null && (
                  <Text className="mb-1.5 ml-1 text-[11px] font-bold text-[#2563EB]">
                    📍 {formatDistance(distance)}
                  </Text>
                )}

                <ListingCard
                  listing={listing}
                  onPress={() =>
                    router.push({
                      pathname: "/(user)/listing/[id]",
                      params: { id: String(listing.id) },
                    })
                  }
                />
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}