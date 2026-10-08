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

import {
  router,
  useLocalSearchParams,
} from "expo-router";

import ListingCard from "../../components/ListingCard";
import { getPublicListings } from "../../services/api";
import type { Listing } from "../../types/listing";

/*
 * ============================================================================
 * TYPES & CONSTANTS
 * ============================================================================
 */

type SuggestionType =
  | "property"
  | "area"
  | "city";

type SearchSuggestion = {
  id: string;
  type: SuggestionType;
  title: string;
  subtitle: string;
  listing?: Listing;
};

type NearbyMode =
  | "all"
  | "nearby";

type GenderFilter =
  | "All"
  | "Men's"
  | "Women's"
  | "Co-living";

type SortMode =
  | "recommended"
  | "price_low"
  | "price_high";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type ResultItem = {
  listing: Listing;
  distance: number | null;
};

/*
 * ============================================================================
 * PG SEARCH FILTERS
 * ============================================================================
 *
 * These values come from PG.tsx.
 *
 * IMPORTANT:
 *
 * Only these filters are used for PG matching:
 *
 * 1. City
 * 2. Area
 * 3. PG Type
 * 4. Room Sharing
 * 5. AC / Non-AC
 *
 * Food Type
 * Food Habit
 * Facilities
 * Price
 *
 * are NOT used here for the PG filter flow.
 */

type PgSearchFilters = {
  city: string;
  areas: string[];
  types: string[];
  sharing: string[];
  acType: string;
};

/*
 * ============================================================================
 * CONSTANTS
 * ============================================================================
 */

const RADIUS_OPTIONS = [
  2,
  5,
  10,
  20,
];

const GENDER_FILTERS: GenderFilter[] = [
  "All",
  "Men's",
  "Women's",
  "Co-living",
];

const SORT_OPTIONS: {
  value: SortMode;
  label: string;
}[] = [
  {
    value: "recommended",
    label: "Recommended",
  },
  {
    value: "price_low",
    label: "Price: Low to High",
  },
  {
    value: "price_high",
    label: "Price: High to Low",
  },
];

const PLACE_SHORTCUTS = [
  {
    icon: "🚇",
    label: "Metro",
    query: "metro stations",
  },
  {
    icon: "🎓",
    label: "Coaching",
    query: "coaching centers",
  },
  {
    icon: "🏢",
    label: "Offices",
    query: "office locations",
  },
];

/*
 * ============================================================================
 * HELPER FUNCTIONS
 * ============================================================================
 */

/*
 * Normalize text so comparisons are case-insensitive.
 *
 * Example:
 *
 * Hyderabad
 * HYDERABAD
 * hyderabad
 *
 * all become:
 *
 * hyderabad
 */

function normalizeText(
  value: unknown
): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/*
 * ============================================================================
 * ERROR MESSAGE HELPER
 * ============================================================================
 */

function getErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message;
  }

  if (
    typeof error === "string" &&
    error
  ) {
    return error;
  }

  return fallback;
}

/*
 * ============================================================================
 * READ LISTING FIELD
 * ============================================================================
 *
 * Allows us to safely read fields from Listing.
 */

function readField(
  listing: Listing,
  key: string
): unknown {
  return (
    listing as unknown as Record<
      string,
      unknown
    >
  )[key];
}

/*
 * ============================================================================
 * PRICE HELPER
 * ============================================================================
 */

function getPrice(
  listing: Listing
): number | null {
  const value = Number(
    readField(
      listing,
      "monthly_price"
    )
  );

  return Number.isFinite(value)
    ? value
    : null;
}

/*
 * ============================================================================
 * NORMAL SEARCH MATCHING
 * ============================================================================
 *
 * Existing home search.
 *
 * Every word typed by the user must appear
 * somewhere in the searchable listing data.
 */

function matchesQuery(
  listing: Listing,
  query: string
): boolean {
  const tokens = query
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    return true;
  }

  const haystack = [
    listing.name,
    listing.area,
    listing.city,
    listing.address,
    listing.property_type,
  ]
    .map(normalizeText)
    .join(" ");

  return tokens.every(
    (token) =>
      haystack.includes(token)
  );
}

/*
 * ============================================================================
 * SUGGESTION ICON
 * ============================================================================
 */

function getSuggestionIcon(
  type: SuggestionType
): string {
  if (type === "property") {
    return "🏠";
  }

  if (type === "area") {
    return "📍";
  }

  return "🏙️";
}

/*
 * ============================================================================
 * DISTANCE CALCULATION
 * ============================================================================
 */

function getDistanceKm(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number
): number {
  const earthRadiusKm = 6371;

  const dLat =
    ((latitude2 - latitude1) *
      Math.PI) /
    180;

  const dLon =
    ((longitude2 - longitude1) *
      Math.PI) /
    180;

  const lat1 =
    (latitude1 * Math.PI) /
    180;

  const lat2 =
    (latitude2 * Math.PI) /
    180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 *
      Math.cos(lat1) *
      Math.cos(lat2);

  return (
    2 *
    earthRadiusKm *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )
  );
}

/*
 * ============================================================================
 * FORMAT DISTANCE
 * ============================================================================
 */

function formatDistance(
  km: number
): string {
  if (km < 1) {
    return `${Math.max(
      Math.round(km * 1000),
      50
    )} m away`;
  }

  return `${km.toFixed(1)} km away`;
}

/*
 * ============================================================================
 * PG TYPE MATCHING
 * ============================================================================
 *
 * PG.tsx uses:
 *
 * Boys PG
 * Girls PG
 * Co-living
 *
 * Existing Listing data uses:
 *
 * Men's
 * Women's
 * Co-living
 *
 * Therefore we translate the user selection
 * to the existing Listing gender value.
 */

function matchesPGType(
  listingGender: string,
  selectedTypes: string[]
): boolean {
  /*
   * If the user did not select PG Type,
   * don't restrict the results.
   */

  if (
    selectedTypes.length === 0
  ) {
    return true;
  }

  const gender =
    normalizeText(listingGender);

  return selectedTypes.some(
    (type) => {
      const selectedType =
        normalizeText(type);

      /*
       * Boys PG
       * matches Men's / Men / Boys
       */

      if (
        selectedType ===
        "boys pg"
      ) {
        return (
          gender === "men's" ||
          gender === "men" ||
          gender === "boys"
        );
      }

      /*
       * Girls PG
       * matches Women's / Women / Girls
       */

      if (
        selectedType ===
        "girls pg"
      ) {
        return (
          gender === "women's" ||
          gender === "women" ||
          gender === "girls"
        );
      }

      /*
       * Co-living
       */

      if (
        selectedType ===
        "co-living"
      ) {
        return (
          gender ===
          "co-living"
        );
      }

      /*
       * Fallback
       */

      return (
        gender ===
        selectedType
      );
    }
  );
}

/*
 * ============================================================================
 * ROOM SHARING MATCHING
 * ============================================================================
 *
 * User can select multiple sharing options.
 *
 * Example:
 *
 * User:
 * 2 Sharing
 * 3 Sharing
 *
 * Listing:
 * ["2 Sharing"]
 *
 * MATCH
 *
 * Listing:
 * ["4 Sharing"]
 *
 * NO MATCH
 */

function normalizeSharing(
  value: string
): string {
  return normalizeText(value)
    .replace(
      "single sharing",
      "1 sharing"
    )
    .replace(
      "single",
      "1"
    )
    .replace(
      "sharing",
      ""
    )
    .replace(
      /\s+/g,
      ""
    )
    .trim();
}

function matchesRoomSharing(
  listingSharing: string[],
  selectedSharing: string[]
): boolean {
  /*
   * No room-sharing filter selected.
   *
   * Therefore allow all.
   */

  if (
    selectedSharing.length === 0
  ) {
    return true;
  }

  /*
   * Listing has no sharing data.
   */

  if (
    !Array.isArray(
      listingSharing
    )
  ) {
    return false;
  }

  const listingValues =
    listingSharing.map(
      normalizeSharing
    );

  /*
   * ANY selected sharing option
   * can match.
   */

  return selectedSharing.some(
    (selected) =>
      listingValues.includes(
        normalizeSharing(
          selected
        )
      )
  );
}

/*
 * ============================================================================
 * AC / NON-AC MATCHING
 * ============================================================================
 *
 * Single selection.
 */

function matchesAcType(
  listingAcType: string,
  selectedAcType: string
): boolean {
  /*
   * No AC filter selected.
   *
   * Therefore allow both AC and Non-AC.
   */

  if (!selectedAcType) {
    return true;
  }

  return (
    normalizeText(
      listingAcType
    ) ===
    normalizeText(
      selectedAcType
    )
  );
}

/*
 * ============================================================================
 * CITY MATCHING
 * ============================================================================
 */

function matchesCity(
  listingCity: string,
  selectedCity: string
): boolean {
  return (
    normalizeText(
      listingCity
    ) ===
    normalizeText(
      selectedCity
    )
  );
}

/*
 * ============================================================================
 * AREA MATCHING
 * ============================================================================
 *
 * User can select multiple areas.
 *
 * Example:
 *
 * Madhapur
 * Gachibowli
 *
 * A listing in either area matches.
 */

function matchesArea(
  listingArea: string,
  selectedAreas: string[]
): boolean {
  /*
   * No area selected.
   *
   * Allow every area inside the selected city.
   */

  if (
    selectedAreas.length === 0
  ) {
    return true;
  }

  return selectedAreas.some(
    (area) =>
      normalizeText(
        listingArea
      ) ===
      normalizeText(area)
  );
}

/*
 * ============================================================================
 * SMALL UI COMPONENT
 * ============================================================================
 */

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
        backgroundColor: active
          ? "#2563EB"
          : "#FFFFFF",
        borderWidth: 1,
        borderColor: active
          ? "#2563EB"
          : "#E2E8F0",
        opacity: disabled
          ? 0.6
          : 1,
      }}
    >
      {icon ? (
        <Text className="mr-1 text-[14px]">
          {icon}
        </Text>
      ) : null}

      <Text
        className="text-[12px] font-bold"
        style={{
          color: active
            ? "#FFFFFF"
            : "#334155",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/*
 * ============================================================================
 * ROW LABEL
 * ============================================================================
 */

function RowLabel({
  children,
}: {
  children: string;
}) {
  return (
    <Text className="mb-2 mt-4 text-[11px] font-extrabold uppercase text-[#94A3B8]">
      {children}
    </Text>
  );
}

/*
 * ============================================================================
 * USER HOME
 * ============================================================================
 */

export default function UserHome() {

  /*
   * ==========================================================================
   * PG FILTER PARAMETERS FROM PG.tsx
   * ==========================================================================
   *
   * PG.tsx sends:
   *
   * pgSearch
   * pgCity
   * pgAreas
   * pgTypes
   * pgSharing
   * pgAcType
   *
   * through Expo Router.
   */

  const {
    pgSearch,
    pgCity,
    pgAreas,
    pgTypes,
    pgSharing,
    pgAcType,
  } =
    useLocalSearchParams<{
      pgSearch?: string;
      pgCity?: string;
      pgAreas?: string;
      pgTypes?: string;
      pgSharing?: string;
      pgAcType?: string;
    }>();

  /*
   * ==========================================================================
   * DATA STATE
   * ==========================================================================
   */

  const [
    listings,
    setListings,
  ] = useState<Listing[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    loadError,
    setLoadError,
  ] = useState<string | null>(
    null
  );

  /*
   * ==========================================================================
   * NORMAL SEARCH & FILTER STATE
   * ==========================================================================
   */

  const [
    searchText,
    setSearchText,
  ] = useState("");

  const [
    searchFocused,
    setSearchFocused,
  ] = useState(false);

  const [
    genderFilter,
    setGenderFilter,
  ] =
    useState<GenderFilter>(
      "All"
    );

  const [
    sortMode,
    setSortMode,
  ] =
    useState<SortMode>(
      "recommended"
    );

  /*
   * ==========================================================================
   * SEARCH INPUT REFERENCES
   * ==========================================================================
   */

  const inputRef =
    useRef<TextInput>(null);

  const blurTimer =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null);

  /*
   * ==========================================================================
   * NEARBY STATE
   * ==========================================================================
   */

  const [
    nearbyMode,
    setNearbyMode,
  ] =
    useState<NearbyMode>(
      "all"
    );

  const [
    radiusKm,
    setRadiusKm,
  ] = useState(10);

  const [
    currentCoordinates,
    setCurrentCoordinates,
  ] =
    useState<Coordinates | null>(
      null
    );

  const [
    locationLoading,
    setLocationLoading,
  ] = useState(false);

  /*
   * ==========================================================================
   * PARSE PG FILTERS
   * ==========================================================================
   *
   * PG.tsx sends arrays as JSON strings.
   *
   * Example:
   *
   * '["Madhapur","Gachibowli"]'
   *
   * becomes:
   *
   * ["Madhapur", "Gachibowli"]
   */

  const pgFilters =
    useMemo<PgSearchFilters | null>(
      () => {

        /*
         * This is NOT a PG results flow
         * unless pgSearch === true.
         */

        if (
          pgSearch !== "true" ||
          !pgCity
        ) {
          return null;
        }

        /*
         * Safe JSON array parser.
         */

        const parseArray = (
          value?: string
        ): string[] => {

          if (!value) {
            return [];
          }

          try {
            const parsed =
              JSON.parse(value);

            if (
              !Array.isArray(
                parsed
              )
            ) {
              return [];
            }

            return parsed.filter(
              (
                item
              ): item is string =>
                typeof item ===
                "string"
              );
          } catch {
            return [];
          }
        };

        return {
          city: String(
            pgCity
          ),

          areas:
            parseArray(
              pgAreas
            ),

          types:
            parseArray(
              pgTypes
            ),

          sharing:
            parseArray(
              pgSharing
            ),

          acType: pgAcType
            ? String(
                pgAcType
              )
            : "",
        };
      },
      [
        pgSearch,
        pgCity,
        pgAreas,
        pgTypes,
        pgSharing,
        pgAcType,
      ]
    );

  /*
   * ==========================================================================
   * LOAD LISTINGS
   * ==========================================================================
   *
   * This continues using your existing API.
   *
   * We do NOT send PG filters to the backend.
   *
   * We fetch the existing public listings and filter
   * them on the User side.
   */

  const loadListings =
    useCallback(
      async () => {

        try {

          setLoadError(null);

          const data =
            await getPublicListings();

          setListings(data);

        } catch (
          error: unknown
        ) {

          console.warn(
            "User listings error:",
            getErrorMessage(
              error,
              "Unknown"
            )
          );

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
      },
      []
    );

  /*
   * ==========================================================================
   * INITIAL LOAD
   * ==========================================================================
   */

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  /*
   * ==========================================================================
   * CLEANUP SEARCH BLUR TIMER
   * ==========================================================================
   */

  useEffect(() => {
    return () => {

      if (
        blurTimer.current
      ) {
        clearTimeout(
          blurTimer.current
        );
      }

    };
  }, []);

  /*
   * ==========================================================================
   * REFRESH
   * ==========================================================================
   */

  const handleRefresh =
    () => {

      setRefreshing(true);

      loadListings();
    };

  /*
   * ==========================================================================
   * RETRY
   * ==========================================================================
   */

  const handleRetry =
    () => {

      setLoading(true);

      loadListings();
    };

  /*
   * ==========================================================================
   * LOCATION
   * ==========================================================================
   */

  const getCurrentLocation =
    async (
      silent = false
    ): Promise<Coordinates | null> => {

      try {

        const {
          status,
        } =
          await Location.requestForegroundPermissionsAsync();

        if (
          status !==
          "granted"
        ) {

          if (!silent) {

            Alert.alert(
              "Location Permission Required",
              "Please allow location access to find places near you."
            );

          }

          return null;
        }

        const servicesEnabled =
          await Location.hasServicesEnabledAsync();

        if (
          !servicesEnabled
        ) {

          if (!silent) {

            Alert.alert(
              "Location Services Disabled",
              "Please turn on GPS/location services and try again."
            );

          }

          return null;
        }

        const location =
          await Location.getCurrentPositionAsync(
            {
              accuracy:
                Location.Accuracy
                  .Balanced,
            }
          );

        return {
          latitude:
            location.coords
              .latitude,

          longitude:
            location.coords
              .longitude,
        };

      } catch (
        error: unknown
      ) {

        console.warn(
          "Location error:",
          getErrorMessage(
            error,
            "Unknown"
          )
        );

        if (!silent) {

          Alert.alert(
            "Unable to Get Location",
            "We couldn't get your current location. Please try again."
          );

        }

        return null;
      }
    };

  /*
   * ==========================================================================
   * RESET NORMAL HOME FILTERS
   * ==========================================================================
   *
   * If PG search parameters exist, we also remove them
   * from the route.
   */

  const resetAll =
    () => {

      setSearchText("");

      setNearbyMode(
        "all"
      );

      setGenderFilter(
        "All"
      );

      setSortMode(
        "recommended"
      );

      setSearchFocused(
        false
      );

      Keyboard.dismiss();

      /*
       * Remove PG search parameters.
       *
       * This returns Home to normal
       * "All Properties" mode.
       */

      if (pgFilters) {

        router.replace(
          "/(user)/home"
        );
      }
    };

  /*
   * ==========================================================================
   * NEAR ME
   * ==========================================================================
   */

  const handleNearMe =
    async () => {

      setLocationLoading(
        true
      );

      try {

        const location =
          await getCurrentLocation();

        if (!location) {
          return;
        }

        setCurrentCoordinates(
          location
        );

        setNearbyMode(
          "nearby"
        );

        setSearchText("");

        setSearchFocused(
          false
        );

        Keyboard.dismiss();

      } finally {

        setLocationLoading(
          false
        );

      }
    };

  /*
   * ==========================================================================
   * METRO / COACHING / OFFICES
   * ==========================================================================
   */

  const handleNearbyPlaceSearch =
    async (
      placeType: string
    ) => {

      setLocationLoading(
        true
      );

      try {

        const location =
          await getCurrentLocation(
            true
          );

        const url =
          location
            ? `https://www.google.com/maps/search/${encodeURIComponent(
                placeType
              )}/@${location.latitude},${location.longitude},14z`
            : `https://www.google.com/maps/search/${encodeURIComponent(
                `${placeType} near me`
              )}`;

        await Linking.openURL(
          url
        );

      } catch (
        error: unknown
      ) {

        console.warn(
          "Nearby place search error:",
          getErrorMessage(
            error,
            "Unknown"
          )
        );

        Alert.alert(
          "Unable to Open Maps",
          "Please make sure Google Maps or a browser is available and try again."
        );

      } finally {

        setLocationLoading(
          false
        );

      }
    };

  /*
   * ==========================================================================
   * SEARCH INPUT
   * ==========================================================================
   */

  const handleSearchTextChange =
    (
      text: string
    ) => {

      setSearchText(
        text
      );

      /*
       * Typing leaves Near Me mode.
       */

      if (
        nearbyMode ===
        "nearby"
      ) {
        setNearbyMode(
          "all"
        );
      }
    };

  /*
   * ==========================================================================
   * SEARCH FOCUS
   * ==========================================================================
   */

  const handleSearchFocus =
    () => {

      if (
        blurTimer.current
      ) {
        clearTimeout(
          blurTimer.current
        );
      }

      setSearchFocused(
        true
      );
    };

  /*
   * ==========================================================================
   * SEARCH BLUR
   * ==========================================================================
   */

  const handleSearchBlur =
    () => {

      blurTimer.current =
        setTimeout(
          () =>
            setSearchFocused(
              false
            ),
          150
        );
    };

  /*
   * ==========================================================================
   * CLEAR SEARCH
   * ==========================================================================
   */

  const handleClearSearch =
    () => {

      setSearchText("");

      setNearbyMode(
        "all"
      );

      inputRef.current?.focus();
    };

  /*
   * ==========================================================================
   * AUTOCOMPLETE SUGGESTIONS
   * ==========================================================================
   */

  const suggestions =
    useMemo<
      SearchSuggestion[]
    >(() => {

      const query =
        normalizeText(
          searchText
        );

      if (!query) {
        return [];
      }

      const startsWithQuery =
        (
          value: unknown
        ) =>
          normalizeText(
            value
          ).startsWith(
            query
          )
            ? 0
            : 1;

      /*
       * --------------------------------------------------------------
       * PROPERTIES
       * --------------------------------------------------------------
       */

      const properties:
        SearchSuggestion[] =
        listings
          .filter(
            (listing) =>
              matchesQuery(
                listing,
                query
              )
          )
          .sort(
            (a, b) =>
              startsWithQuery(
                a.name
              ) -
              startsWithQuery(
                b.name
              )
          )
          .slice(0, 5)
          .map(
            (listing) => ({
              id: `property-${listing.id}`,
              type: "property",
              title:
                listing.name,
              subtitle:
                `${listing.area}, ${listing.city}`,
              listing,
            })
          );

      /*
       * --------------------------------------------------------------
       * AREAS
       * --------------------------------------------------------------
       */

      const areaMap =
        new Map<
          string,
          SearchSuggestion
        >();

      listings.forEach(
        (listing) => {

          const area =
            String(
              listing.area ??
                ""
            ).trim();

          const key =
            normalizeText(
              area
            );

          if (
            !area ||
            !key.includes(
              query
            ) ||
            areaMap.has(key)
          ) {
            return;
          }

          areaMap.set(
            key,
            {
              id: `area-${key}`,
              type: "area",
              title: area,
              subtitle:
                listing.city
                  ? `Area in ${listing.city}`
                  : "Area",
            }
          );
        }
      );

      const areas =
        Array.from(
          areaMap.values()
        )
          .sort(
            (a, b) =>
              startsWithQuery(
                a.title
              ) -
              startsWithQuery(
                b.title
              )
          )
          .slice(0, 4);

      /*
       * --------------------------------------------------------------
       * CITIES
       * --------------------------------------------------------------
       */

      const cityMap =
        new Map<
          string,
          SearchSuggestion
        >();

      listings.forEach(
        (listing) => {

          const city =
            String(
              listing.city ??
                ""
            ).trim();

          const key =
            normalizeText(
              city
            );

          if (
            !city ||
            !key.includes(
              query
            ) ||
            cityMap.has(key)
          ) {
            return;
          }

          cityMap.set(
            key,
            {
              id: `city-${key}`,
              type: "city",
              title: city,
              subtitle: "City",
            }
          );
        }
      );

      const cities =
        Array.from(
          cityMap.values()
        )
          .sort(
            (a, b) =>
              startsWithQuery(
                a.title
              ) -
              startsWithQuery(
                b.title
              )
          )
          .slice(0, 3);

      return [
        ...properties,
        ...areas,
        ...cities,
      ].slice(0, 10);

    }, [
      listings,
      searchText,
    ]);

  /*
   * ==========================================================================
   * SELECT SEARCH SUGGESTION
   * ==========================================================================
   */

  const handleSelectSuggestion =
    (
      suggestion: SearchSuggestion
    ) => {

      Keyboard.dismiss();

      setSearchFocused(
        false
      );

      /*
       * Specific property:
       * Open property details.
       */

      if (
        suggestion.type ===
          "property" &&
        suggestion.listing
      ) {

        router.push({
          pathname:
            "/(user)/listing/[id]",

          params: {
            id: String(
              suggestion
                .listing.id
            ),
          },
        });

        return;
      }

      /*
       * Area or city:
       * Use it as normal search text.
       */

      setNearbyMode(
        "all"
      );

      setSearchText(
        suggestion.title
      );
    };

  /*
   * ==========================================================================
   * RESULTS
   * ==========================================================================
   *
   * This is the most important section.
   *
   * Existing Home filters:
   *
   * - Search
   * - Near Me
   * - Gender
   * - Sorting
   *
   * PG.tsx filters:
   *
   * - City
   * - Area
   * - PG Type
   * - Room Sharing
   * - AC / Non-AC
   */

  const results =
    useMemo<ResultItem[]>(
      () => {

        let items:
          ResultItem[] = [];

        /*
         * ==============================================================
         * STEP 1
         * CREATE BASE RESULT LIST
         * ==============================================================
         */

        if (
          nearbyMode ===
            "nearby" &&
          currentCoordinates
        ) {

          /*
           * NEARBY MODE
           */

          listings.forEach(
            (listing) => {

              const latitude =
                Number(
                  listing.latitude
                );

              const longitude =
                Number(
                  listing.longitude
                );

              /*
               * Skip listings without
               * valid coordinates.
               */

              if (
                !Number.isFinite(
                  latitude
                ) ||
                !Number.isFinite(
                  longitude
                )
              ) {
                return;
              }

              const distance =
                getDistanceKm(
                  currentCoordinates.latitude,
                  currentCoordinates.longitude,
                  latitude,
                  longitude
                );

              if (
                distance <=
                radiusKm
              ) {

                items.push({
                  listing,
                  distance,
                });
              }
            }
          );

        } else {

          /*
           * NORMAL SEARCH MODE
           */

          const query =
            normalizeText(
              searchText
            );

          items =
            listings
              .filter(
                (listing) =>
                  matchesQuery(
                    listing,
                    query
                  )
              )
              .map(
                (listing) => ({
                  listing,
                  distance:
                    null,
                })
              );
        }

        /*
         * ==============================================================
         * STEP 2
         * NORMAL HOME GENDER FILTER
         * ==============================================================
         *
         * IMPORTANT:
         *
         * When PG filter mode is active, PG Type already controls
         * gender/type matching.
         *
         * Therefore the normal Home "Property for" filter is
         * skipped in PG mode.
         */

        if (
          !pgFilters &&
          genderFilter !==
            "All"
        ) {

          const wanted =
            normalizeText(
              genderFilter
            );

          items =
            items.filter(
              ({ listing }) =>
                normalizeText(
                  readField(
                    listing,
                    "gender"
                  )
                ) === wanted
            );
        }

        /*
         * ==============================================================
         * STEP 3
         * APPLY PG FILTERS
         * ==============================================================
         */

        if (pgFilters) {

          items =
            items.filter(
              ({ listing }) => {

                /*
                 * ------------------------------------------------------
                 * PG FILTER 1
                 * CITY
                 * SINGLE SELECTION
                 * ------------------------------------------------------
                 */

                const cityMatches =
                  matchesCity(
                    listing.city,
                    pgFilters.city
                  );

                if (
                  !cityMatches
                ) {
                  return false;
                }

                /*
                 * ------------------------------------------------------
                 * PG FILTER 2
                 * AREA
                 * MULTIPLE SELECTION
                 * ------------------------------------------------------
                 *
                 * If no areas were selected:
                 *
                 * allow all areas in the selected city.
                 *
                 * If areas were selected:
                 *
                 * listing must belong to one of them.
                 */

                const areaMatches =
                  matchesArea(
                    listing.area,
                    pgFilters.areas
                  );

                if (
                  !areaMatches
                ) {
                  return false;
                }

                /*
                 * ------------------------------------------------------
                 * PG FILTER 3
                 * PG TYPE
                 * MULTIPLE SELECTION
                 * ------------------------------------------------------
                 */

                const pgTypeMatches =
                  matchesPGType(
                    String(
                      readField(
                        listing,
                        "gender"
                      ) ?? ""
                    ),
                    pgFilters.types
                  );

                if (
                  !pgTypeMatches
                ) {
                  return false;
                }

                /*
                 * ------------------------------------------------------
                 * PG FILTER 4
                 * ROOM SHARING
                 * MULTIPLE SELECTION
                 * ------------------------------------------------------
                 */

                const roomSharingMatches =
                  matchesRoomSharing(
                    listing.sharing,
                    pgFilters.sharing
                  );

                if (
                  !roomSharingMatches
                ) {
                  return false;
                }

                /*
                 * ------------------------------------------------------
                 * PG FILTER 5
                 * AC / NON-AC
                 * SINGLE SELECTION
                 * ------------------------------------------------------
                 */

                const acMatches =
                  matchesAcType(
                    String(
                      readField(
                        listing,
                        "ac_type"
                      ) ?? ""
                    ),
                    pgFilters.acType
                  );

                if (
                  !acMatches
                ) {
                  return false;
                }

                /*
                 * ------------------------------------------------------
                 * ALL PG FILTERS PASSED
                 * ------------------------------------------------------
                 */

                return true;
              }
            );
        }

        /*
         * ==============================================================
         * STEP 4
         * SORTING
         * ==============================================================
         */

        if (
          sortMode ===
            "price_low" ||
          sortMode ===
            "price_high"
        ) {

          const direction =
            sortMode ===
            "price_low"
              ? 1
              : -1;

          items =
            [
              ...items,
            ].sort(
              (a, b) => {

                const priceA =
                  getPrice(
                    a.listing
                  );

                const priceB =
                  getPrice(
                    b.listing
                  );

                /*
                 * Listings without
                 * price always go last.
                 */

                if (
                  priceA === null &&
                  priceB === null
                ) {
                  return 0;
                }

                if (
                  priceA === null
                ) {
                  return 1;
                }

                if (
                  priceB === null
                ) {
                  return -1;
                }

                return (
                  (priceA -
                    priceB) *
                  direction
                );
              }
            );

        } else if (
          nearbyMode ===
          "nearby"
        ) {

          /*
           * Near Me:
           * nearest first.
           */

          items =
            [
              ...items,
            ].sort(
              (a, b) =>
                (a.distance ??
                  0) -
                (b.distance ??
                  0)
            );
        }

        return items;

      },
      [
        listings,
        searchText,
        nearbyMode,
        currentCoordinates,
        radiusKm,
        genderFilter,
        sortMode,
        pgFilters,
      ]
    );

  /*
   * ==========================================================================
   * DERIVED UI STATE
   * ==========================================================================
   */

  const isNearby =
    nearbyMode ===
    "nearby";

  const hasSearch =
    searchText.trim()
      .length > 0;

  const showSuggestions =
    searchFocused &&
    hasSearch;

  /*
   * PG FILTER MODE
   */

  const isPGSearch =
    pgFilters !== null;

  /*
   * NORMAL HOME ACTIVE FILTERS
   */

  const hasActiveFilters =
    isPGSearch ||
    hasSearch ||
    isNearby ||
    genderFilter !==
      "All" ||
    sortMode !==
      "recommended";

  /*
   * RESULTS TITLE
   */

  const resultsTitle =
    isPGSearch
      ? "PG Results"
      : isNearby
      ? "Nearby Properties"
      : hasSearch
      ? "Search Results"
      : "All Properties";

  /*
   * RESULTS SUBTITLE
   */

  const resultsSubtitle =
    isPGSearch
      ? `PGs matching your selected preferences`
      : isNearby
      ? `PGs and hostels within ${radiusKm} km`
      : hasSearch
      ? `Results for "${searchText.trim()}"`
      : "Properties from all owners";

  /*
   * ==========================================================================
   * UI
   * ==========================================================================
   */

  return (
    <View className="flex-1 bg-[#F5F9FD]">

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={
              handleRefresh
            }
          />
        }
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 55,
          paddingBottom: 40,
        }}
      >

        {/* ================================================================
            HEADER
        ================================================================ */}

        <Text className="text-[13px] font-bold text-[#2563EB]">
          FindMyEasy
        </Text>

        <Text className="mt-1 text-[27px] font-extrabold text-[#0F172A]">
          Find your perfect stay
        </Text>

        <Text className="mt-2 text-[13px] leading-5 text-[#64748B]">
          Explore PGs and hostels from owners around you.
        </Text>

        {/* ================================================================
            PG SEARCH ACTIVE INDICATOR
        ================================================================ */}

        {isPGSearch && (
          <View className="mt-4 rounded-[16px] border border-[#BFDBFE] bg-[#EFF6FF] p-4">

            <View className="flex-row items-center justify-between">

              <View className="flex-1">

                <Text className="text-[12px] font-extrabold text-[#2563EB]">
                  PG FILTERS APPLIED
                </Text>

                <Text className="mt-1 text-[13px] font-bold text-[#0F172A]">
                  {pgFilters?.city}
                </Text>

              </View>

              <Pressable
                onPress={
                  resetAll
                }
                className="rounded-full bg-white px-4 py-2"
              >
                <Text className="text-[11px] font-bold text-[#2563EB]">
                  Clear
                </Text>
              </Pressable>

            </View>

            <Text className="mt-2 text-[11px] leading-5 text-[#64748B]">

              {pgFilters &&
              pgFilters.areas.length >
                0
                ? `Areas: ${pgFilters.areas.join(", ")}`
                : "All areas in selected city"}

            </Text>

          </View>
        )}

        {/* ================================================================
            SEARCH BAR
        ================================================================ */}

        <View
          className={`mt-5 flex-row items-center rounded-[18px] bg-white px-4 ${
            searchFocused
              ? "border-2 border-[#2563EB]"
              : "border border-[#E2E8F0]"
          }`}
          style={{
            minHeight: 56,
            shadowColor:
              "#0F172A",
            shadowOffset: {
              width: 0,
              height: 2,
            },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          }}
        >

          <Text className="mr-3 text-[21px]">
            🔍
          </Text>

          <TextInput
            ref={inputRef}
            value={searchText}
            onChangeText={
              handleSearchTextChange
            }
            onFocus={
              handleSearchFocus
            }
            onBlur={
              handleSearchBlur
            }
            placeholder="Search PGs, hostels or areas..."
            placeholderTextColor="#94A3B8"
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            className="flex-1 text-[15px] text-[#0F172A]"
            style={{
              minHeight: 54,
            }}
            onSubmitEditing={() => {
              Keyboard.dismiss();
              setSearchFocused(
                false
              );
            }}
          />

          {searchText.length >
            0 && (
            <Pressable
              onPress={
                handleClearSearch
              }
              className="ml-2 h-8 w-8 items-center justify-center rounded-full bg-[#F1F5F9]"
              hitSlop={8}
            >
              <Text className="text-[16px] font-bold text-[#64748B]">
                ×
              </Text>
            </Pressable>
          )}

        </View>

        {/* ================================================================
            SEARCH SUGGESTIONS
        ================================================================ */}

        {showSuggestions && (
          <View
            className="mt-2 overflow-hidden rounded-[18px] bg-white"
            style={{
              shadowColor:
                "#0F172A",
              shadowOffset: {
                width: 0,
                height: 4,
              },
              shadowOpacity: 0.1,
              shadowRadius: 10,
              elevation: 4,
            }}
          >

            {suggestions.length >
            0 ? (
              suggestions.map(
                (
                  suggestion,
                  index
                ) => (
                  <Pressable
                    key={
                      suggestion.id
                    }
                    onPress={() =>
                      handleSelectSuggestion(
                        suggestion
                      )
                    }
                    className={`flex-row items-center px-4 py-3 ${
                      index !==
                      suggestions.length -
                        1
                        ? "border-b border-[#F1F5F9]"
                        : ""
                    }`}
                    style={({
                      pressed,
                    }) => ({
                      backgroundColor:
                        pressed
                          ? "#F8FAFC"
                          : "white",
                    })}
                  >

                    <View className="h-10 w-10 items-center justify-center rounded-full bg-[#EFF6FF]">

                      <Text className="text-[18px]">
                        {getSuggestionIcon(
                          suggestion.type
                        )}
                      </Text>

                    </View>

                    <View className="ml-3 flex-1">

                      <Text
                        numberOfLines={
                          1
                        }
                        className="text-[14px] font-bold text-[#0F172A]"
                      >
                        {
                          suggestion.title
                        }
                      </Text>

                      <Text
                        numberOfLines={
                          1
                        }
                        className="mt-1 text-[11px] text-[#64748B]"
                      >
                        {
                          suggestion.subtitle
                        }
                      </Text>

                    </View>

                    <Text className="ml-2 text-[18px] text-[#94A3B8]">
                      ›
                    </Text>

                  </Pressable>
                )
              )
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

        {/* ================================================================
            QUICK OPTIONS
        ================================================================ */}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="handled"
          className="mt-3"
          contentContainerStyle={{
            paddingRight: 10,
          }}
        >

          <Chip
            icon="🏠"
            label="All"
            active={
              !hasActiveFilters
            }
            onPress={
              resetAll
            }
          />

          <Chip
            icon="📍"
            label={
              locationLoading
                ? "Getting location..."
                : "Near Me"
            }
            active={
              isNearby
            }
            disabled={
              locationLoading
            }
            onPress={
              handleNearMe
            }
          />

          {PLACE_SHORTCUTS.map(
            (place) => (
              <Chip
                key={
                  place.label
                }
                icon={
                  place.icon
                }
                label={
                  place.label
                }
                disabled={
                  locationLoading
                }
                onPress={() =>
                  handleNearbyPlaceSearch(
                    place.query
                  )
                }
              />
            )
          )}

        </ScrollView>

        {/* ================================================================
            RADIUS
            ONLY FOR NEAR ME
        ================================================================ */}

        {isNearby && (
          <>
            <RowLabel>
              Search radius
            </RowLabel>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              keyboardShouldPersistTaps="handled"
            >

              {RADIUS_OPTIONS.map(
                (km) => (
                  <Chip
                    key={km}
                    label={`${km} km`}
                    active={
                      radiusKm ===
                      km
                    }
                    onPress={() =>
                      setRadiusKm(
                        km
                      )
                    }
                  />
                )
              )}

            </ScrollView>
          </>
        )}

        {/* ================================================================
            NORMAL HOME GENDER FILTER
        ================================================================ */}

        {/*
         * IMPORTANT:
         *
         * PG FILTER PAGE already has:
         *
         * Boys PG
         * Girls PG
         * Co-living
         *
         * Therefore this Home filter is hidden during PG search.
         *
         * It remains available during normal Home browsing.
         */}

        {!isPGSearch && (
          <>
            <RowLabel>
              Property for
            </RowLabel>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              keyboardShouldPersistTaps="handled"
            >

              {GENDER_FILTERS.map(
                (option) => (
                  <Chip
                    key={
                      option
                    }
                    label={
                      option
                    }
                    active={
                      genderFilter ===
                      option
                    }
                    onPress={() =>
                      setGenderFilter(
                        option
                      )
                    }
                  />
                )
              )}

            </ScrollView>
          </>
        )}

        {/* ================================================================
            SORT
        ================================================================ */}

        <RowLabel>
          Sort by
        </RowLabel>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="handled"
        >

          {SORT_OPTIONS.map(
            (option) => (
              <Chip
                key={
                  option.value
                }
                label={
                  option.label
                }
                active={
                  sortMode ===
                  option.value
                }
                onPress={() =>
                  setSortMode(
                    option.value
                  )
                }
              />
            )
          )}

        </ScrollView>

        {/* ================================================================
            SUMMARY CARD
        ================================================================ */}

        <View className="mt-6 rounded-[18px] bg-[#2563EB] p-5">

          <Text className="text-[12px] font-bold text-[#BFDBFE]">
            {isPGSearch
              ? "MATCHING PGs"
              : "AVAILABLE PROPERTIES"}
          </Text>

          <Text className="mt-1 text-[28px] font-extrabold text-white">
            {results.length}
          </Text>

          <Text className="mt-1 text-[11px] text-[#DBEAFE]">

            {isPGSearch
              ? "PGs match your selected preferences"
              : isNearby
              ? `PGs & hostels within ${radiusKm} km`
              : "PGs & hostels available right now"}

          </Text>

        </View>

        {/* ================================================================
            RESULTS HEADER
        ================================================================ */}

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

        {/* ================================================================
            LISTINGS
        ================================================================ */}

        <View className="mt-4">

          {loading ? (

            /*
             * ------------------------------------------------------------
             * LOADING
             * ------------------------------------------------------------
             */

            <View className="items-center py-16">

              <ActivityIndicator
                size="large"
                color="#2563EB"
              />

              <Text className="mt-3 text-[12px] text-[#64748B]">
                Loading properties...
              </Text>

            </View>

          ) : loadError ? (

            /*
             * ------------------------------------------------------------
             * ERROR
             * ------------------------------------------------------------
             */

            <View className="items-center rounded-[20px] bg-white p-8">

              <Text className="text-[42px]">
                📡
              </Text>

              <Text className="mt-4 text-center text-[17px] font-extrabold text-[#0F172A]">
                Couldn't load properties
              </Text>

              <Text className="mt-2 text-center text-[12px] leading-5 text-[#64748B]">
                {loadError}
              </Text>

              <Pressable
                onPress={
                  handleRetry
                }
                className="mt-5 rounded-full bg-[#2563EB] px-6 py-3"
              >

                <Text className="text-[12px] font-bold text-white">
                  Try Again
                </Text>

              </Pressable>

            </View>

          ) : results.length ===
            0 ? (

            /*
             * ------------------------------------------------------------
             * NO RESULTS
             * ------------------------------------------------------------
             */

            <View className="items-center rounded-[20px] bg-white p-8">

              <Text className="text-[42px]">
                {isPGSearch
                  ? "🏠"
                  : isNearby
                  ? "📍"
                  : "🔍"}
              </Text>

              <Text className="mt-4 text-center text-[17px] font-extrabold text-[#0F172A]">

                {isPGSearch
                  ? "No matching PGs found"
                  : isNearby
                  ? "No nearby properties found"
                  : "No properties found"}

              </Text>

              <Text className="mt-2 text-center text-[12px] leading-5 text-[#64748B]">

                {isPGSearch
                  ? "No PG matches all of the selected preferences. Try changing the area, PG type, room sharing, or AC preference."
                  : isNearby
                  ? `No PGs or hostels with valid location data were found within ${radiusKm} km. Try a larger radius.`
                  : "Try another PG name, area or city, or change your filters."}

              </Text>

              {hasActiveFilters && (
                <Pressable
                  onPress={
                    resetAll
                  }
                  className="mt-5 rounded-full bg-[#2563EB] px-6 py-3"
                >

                  <Text className="text-[12px] font-bold text-white">
                    Show All Properties
                  </Text>

                </Pressable>
              )}

            </View>

          ) : (

            /*
             * ------------------------------------------------------------
             * MATCHING LISTINGS
             * ------------------------------------------------------------
             */

            results.map(
              ({
                listing,
                distance,
              }) => (

                <View
                  key={
                    listing.id
                  }
                >

                  {distance !==
                    null && (
                    <Text className="mb-1.5 ml-1 text-[11px] font-bold text-[#2563EB]">
                      📍{" "}
                      {formatDistance(
                        distance
                      )}
                    </Text>
                  )}

                  <ListingCard
                    listing={
                      listing
                    }
                    onPress={() =>
                      router.push(
                        {
                          pathname:
                            "/(user)/listing/[id]",

                          params: {
                            id: String(
                              listing.id
                            ),
                          },
                        }
                      )
                    }
                  />

                </View>
              )
            )

          )}

        </View>

      </ScrollView>

    </View>
  );
}