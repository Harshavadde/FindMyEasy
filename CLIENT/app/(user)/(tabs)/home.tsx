import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ComponentRef } from "react";

import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  type TextInputInstance,
  type ScrollViewInstance,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import * as Location from "expo-location";

import {
  router,
  useLocalSearchParams,
} from "expo-router";

import ListingCard from "../../../components/ListingCard";
import {
  getCuratedListingProximity,
  getPublicListingProximity,
  getPublicListings,
  type ListingProximityBadge,
} from "../../../services/api";
import type { Listing } from "../../../types/listing";

/*
 * ============================================================================
 * TYPES & CONSTANTS
 * ============================================================================
 */

type SuggestionType =
  | "property"
  | "area"
  | "city"
  | "metro";

type SearchSuggestion = {
  id: string;
  type: SuggestionType;
  title: string;
  subtitle: string;
  listing?: Listing;
  placeName?: string;
};

type NearbyMode =
  | "all"
  | "nearby";

type GenderFilter =
  | "All"
  | "Boy's"
  | "Girl's"
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

type BrowseLocation = {
  name: string;
  city: string;
  type: "area" | "city";
};

const FEATURED_CITIES: {
  name: string;
  landmark: string;
  icon: string;
  color: string;
}[] = [
  {
    name: "Hyderabad",
    landmark: "Charminar",
    icon: "🕌",
    color: "#FFF1E6",
  },
  {
    name: "Bengaluru",
    landmark: "Vidhana Soudha",
    icon: "🏛️",
    color: "#E8F4EA",
  },
  {
    name: "Chennai",
    landmark: "Marina Beach",
    icon: "🌊",
    color: "#E6F4FA",
  },
  {
    name: "Mumbai",
    landmark: "Gateway of India",
    icon: "🌉",
    color: "#F1ECFA",
  },
  {
    name: "Pune",
    landmark: "Shaniwar Wada",
    icon: "🏰",
    color: "#FFF6DF",
  },
];

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
  propertyType: string;
  city: string;
  areas: string[];
  types: string[];
  sharing: string[];
  acTypes: string[];
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
  "Boy's",
  "Girl's",
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

const EXPLORE_CATEGORIES = [
  {
    icon: "🚇",
    label: "Near Metro",
    subtitle: "Within 500m",
    action: "place",
    filter: "metro",
    background: "#EFF6FF",
    border: "#DBEAFE",
  },
  {
    icon: "💻",
    label: "IT Parks",
    subtitle: "Hitech/Gachibowli",
    action: "place",
    filter: "it-park",
    background: "#F5F3FF",
    border: "#EDE9FE",
  },
  {
    icon: "👦",
    label: "Boy's PG",
    subtitle: "Food Included",
    action: "gender",
    filter: "Boy's",
    background: "#F0F9FF",
    border: "#E0F2FE",
  },
  {
    icon: "👧",
    label: "Girl's PG",
    subtitle: "24/7 Security",
    action: "gender",
    filter: "Girl's",
    background: "#FDF2F8",
    border: "#FCE7F3",
  },
  {
    icon: "🏠",
    label: "Co-Living",
    subtitle: "Luxury Stays",
    action: "gender",
    filter: "Co-living",
    background: "#ECFDF5",
    border: "#D1FAE5",
  },
  {
    icon: "🎓",
    label: "Coaching Hub",
    subtitle: "Quiet Study Areas",
    action: "place",
    filter: "coaching",
    background: "#FFFBEB",
    border: "#FEF3C7",
  },
] as const;

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

  if (type === "metro") {
    return "🚇";
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
 * Boy's
 * Girl's
 * Co-living
 *
 * Existing Listing data uses:
 *
 * Boy's
 * Girl's
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
       * Boy's
       * matches Boy's / Men / Boys
       */

      if (
        selectedType ===
        "Boy's"
      ) {
        return (
          gender === "Boy's" ||
          gender === "men" ||
          gender === "boys"
        );
      }

      /*
       * Girl's
       * matches Girl's / Women / Girls
       */

      if (
        selectedType ===
        "Girl's"
      ) {
        return (
          gender === "Girl's" ||
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
  listingSharing: Listing["sharing"],
  selectedSharing: string[]
): boolean {
  // No sharing filter selected means allow all.
  if (selectedSharing.length === 0) {
    return true;
  }

  // Listing has no sharing data.
  if (!Array.isArray(listingSharing)) {
    return false;
  }

  // Extract sharing_type from each sharing object.
  const listingValues = listingSharing.map((item) =>
    normalizeSharing(String(item.sharing_type ?? ""))
  );

  // Match when any selected sharing type is available.
  return selectedSharing.some((selected) =>
    listingValues.includes(normalizeSharing(selected))
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
  selectedAcTypes: string[]
): boolean {
  // No AC option selected means allow both AC and Non-AC.
  if (selectedAcTypes.length === 0) {
    return true;
  }

  // Match any selected AC option.
  return selectedAcTypes.some(
    (selectedType) =>
      normalizeText(listingAcType) === normalizeText(selectedType)
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
    propertyType,
    pgCity,
    pgAreas,
    pgTypes,
    pgSharing,
    pgAcTypes,
  } = useLocalSearchParams<{
    pgSearch?: string;
    propertyType?: string;
    pgCity?: string;
    pgAreas?: string;
    pgTypes?: string;
    pgSharing?: string;
    pgAcTypes?: string;
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
  const [proximityBadges, setProximityBadges] = useState<
    Record<string, ListingProximityBadge | null>
  >({});
  const [metroSearchBadges, setMetroSearchBadges] = useState<
    Record<string, ListingProximityBadge | null>
  >({});

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

  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [alphabetRailVisible, setAlphabetRailVisible] = useState(true);
  const [locationSearch, setLocationSearch] = useState("");
  const [locationPickerCity, setLocationPickerCity] = useState<string | null>(
    null
  );
  const [browseLocation, setBrowseLocation] = useState<BrowseLocation | null>(
    null
  );
  const cityDirectoryRef = useRef<ScrollViewInstance | null>(null);
  const cityLetterOffsetsRef = useRef<Record<string, number>>({});
  const alphabetRailRef = useRef<ComponentRef<typeof View> | null>(null);
  const alphabetRailFrameRef = useRef({ top: 0, height: 0 });

  const [
    genderFilter,
    setGenderFilter,
  ] =
    useState<GenderFilter>(
      "All"
    );

  const [pgFilterModalVisible, setPgFilterModalVisible] = useState(false);

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
    useRef<TextInputInstance | null>(null);

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

  const [currentPlace, setCurrentPlace] = useState({
    title: "Set your location",
    subtitle: "Allow location access to find your area",
  });



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
          propertyType: String(propertyType ?? "PG"),
          city: String(pgCity),
          areas: parseArray(pgAreas),
          types: parseArray(pgTypes),
          sharing: parseArray(pgSharing),
          acTypes: parseArray(pgAcTypes),
        };
      },
      [
        pgSearch,
        propertyType,
        pgCity,
        pgAreas,
        pgTypes,
        pgSharing,
        pgAcTypes,
      ]
    );

  const [draftPropertyType, setDraftPropertyType] = useState<"PG" | "Hostel">("PG");
  const [draftCity, setDraftCity] = useState("");
  const [draftAreas, setDraftAreas] = useState<string[]>([]);
  const [draftTypes, setDraftTypes] = useState<string[]>([]);
  const [draftSharing, setDraftSharing] = useState<string[]>([]);
  const [draftAcTypes, setDraftAcTypes] = useState<string[]>([]);

  const filterCities = [
    "Hyderabad",
    "Bengaluru",
    "Chennai",
    "Pune",
    "Mumbai",
  ];

  const filterCityAreas: Record<string, string[]> = {
    Hyderabad: [
      "Madhapur", "Gachibowli", "Kondapur", "Hitech City",
      "Kukatpally", "Ameerpet", "Begumpet", "Banjara Hills",
      "Jubilee Hills", "Secunderabad",
    ],
    Bengaluru: [
      "Whitefield", "Marathahalli", "Electronic City",
      "Koramangala", "HSR Layout", "BTM Layout",
      "Bellandur", "Indiranagar", "Yelahanka", "Hebbal",
    ],
    Chennai: [
      "T Nagar", "Anna Nagar", "Velachery", "Guindy", "Adyar", "OMR",
    ],
    Pune: [
      "Hinjewadi", "Wakad", "Baner", "Kharadi", "Viman Nagar", "Kothrud",
    ],
    Mumbai: [
      "Andheri", "Powai", "Bandra", "Goregaon", "Thane", "Navi Mumbai",
    ],
  };

  const locationCities = useMemo(() => {
    const cities = new Map<string, string>();
    filterCities.forEach((city) => cities.set(normalizeText(city), city));
    listings.forEach((listing) => {
      const city = String(listing.city ?? "").trim();
      if (city && !cities.has(normalizeText(city))) {
        cities.set(normalizeText(city), city);
      }
    });
    return Array.from(cities.values()).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [listings]);

  const locationAreas = useMemo(() => {
    if (!locationPickerCity) return [];

    const areas = new Map<string, string>();
    (filterCityAreas[locationPickerCity] ?? []).forEach((area) =>
      areas.set(normalizeText(area), area)
    );
    listings.forEach((listing) => {
      if (normalizeText(listing.city) !== normalizeText(locationPickerCity)) {
        return;
      }
      const area = String(listing.area ?? "").trim();
      if (area && !areas.has(normalizeText(area))) {
        areas.set(normalizeText(area), area);
      }
    });

    return Array.from(areas.values()).sort((a, b) => a.localeCompare(b));
  }, [listings, locationPickerCity]);

  const filteredLocationCities = useMemo(() => {
    const query = normalizeText(locationSearch);
    if (!query) return locationCities;
    return locationCities.filter((city) =>
      normalizeText(city).includes(query)
    );
  }, [locationCities, locationSearch]);

  const groupedLocationCities = useMemo(() => {
    const groups = new Map<string, string[]>();
    filteredLocationCities.forEach((city) => {
      const letter = city.charAt(0).toUpperCase();
      const cities = groups.get(letter) ?? [];
      cities.push(city);
      groups.set(letter, cities);
    });
    return Array.from(groups.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );
  }, [filteredLocationCities]);

  const locationAlphabet = useMemo(
    () => groupedLocationCities.map(([letter]) => letter),
    [groupedLocationCities]
  );

  const filteredLocationAreas = useMemo(() => {
    const query = normalizeText(locationSearch);
    if (!query) return locationAreas;
    return locationAreas.filter((area) =>
      normalizeText(area).includes(query)
    );
  }, [locationAreas, locationSearch]);

  const filterSharingOptions = [
    "Single Sharing",
    "2 Sharing",
    "3 Sharing",
    "4 Sharing",
    "5 Sharing",
    "6 Sharing",
    "7+ Sharing",
  ];

  const toggleDraftValue = (
    value: string,
    values: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter(
      values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value]
    );
  };

  const openPgFilters = () => {
    setDraftPropertyType(
      pgFilters?.propertyType === "Hostel" ? "Hostel" : "PG"
    );
    setDraftCity(pgFilters?.city ?? "");
    setDraftAreas(pgFilters?.areas ?? []);
    setDraftTypes(pgFilters?.types ?? []);
    setDraftSharing(pgFilters?.sharing ?? []);
    setDraftAcTypes(pgFilters?.acTypes ?? []);
    setPgFilterModalVisible(true);
  };

  const applyPgFilters = () => {
    if (!draftCity) {
      Alert.alert("Select a city", "Please select a city to find PGs or hostels.");
      return;
    }

    router.replace({
      pathname: "/(user)/home",
      params: {
        pgSearch: "true",
        propertyType: draftPropertyType,
        pgCity: draftCity,
        pgAreas: JSON.stringify(draftAreas),
        pgTypes: JSON.stringify(draftTypes),
        pgSharing: JSON.stringify(draftSharing),
        pgAcTypes: JSON.stringify(draftAcTypes),
      },
    });

    setPgFilterModalVisible(false);
  };

 const clearPgFilters = () => {
  setSearchText("");
  setNearbyMode("all");
  setGenderFilter("All");
  setSortMode("recommended");
  setSearchFocused(false);

  Keyboard.dismiss();

  router.replace("/(user)/home");
};
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
      async (forceRefresh = false) => {

        try {

          setLoadError(null);

          const data =
            await getPublicListings({ forceRefresh });

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

  useEffect(() => {
    let active = true;

    if (listings.length === 0) {
      setProximityBadges({});
      setMetroSearchBadges({});
      return () => {
        active = false;
      };
    }

    setProximityBadges(getCuratedListingProximity(listings));
    setMetroSearchBadges(getCuratedListingProximity(listings, "metro"));

    void Promise.all([
      getPublicListingProximity(listings),
      getPublicListingProximity(listings, "metro"),
    ])
      .then(([badges, metroBadges]) => {
        if (active) {
          setProximityBadges(badges);
          setMetroSearchBadges(metroBadges);
        }
      })
      .catch((error: unknown) => {
        console.warn("Unable to load listing proximity badges:", error);
      });

    return () => {
      active = false;
    };
  }, [listings]);

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

      loadListings(true);
    };

  /*
   * ==========================================================================
   * RETRY
   * ==========================================================================
   */

  const handleRetry =
    () => {

      setLoading(true);

      loadListings(true);
    };

  /*
   * ==========================================================================
   * LOCATION
   * ==========================================================================
   */

  const getCurrentLocation = useCallback(
    async (
      silent = false
    ): Promise<Coordinates | null> => {
      try {
        const { status } =
          await Location.requestForegroundPermissionsAsync();

        if (status !== "granted") {
          setCurrentPlace({
            title: "Location access needed",
            subtitle: "Tap here to allow location access",
          });
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
          setCurrentPlace({
            title: "Location is turned off",
            subtitle: "Turn on your device location and try again",
          });
          if (!silent) {
            Alert.alert(
              "Location Services Disabled",
              "Please turn on GPS/location services and try again."
            );
          }
          return null;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        return {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
      } catch (
        error: unknown
      ) {
        console.warn(
          "Location error:",
          getErrorMessage(error, "Unknown")
        );
        setCurrentPlace({
          title: "Location unavailable",
          subtitle: "Check location settings and try again",
        });
        if (!silent) {
          Alert.alert(
            "Unable to Get Location",
            "We couldn't get your current location. Please try again."
          );
        }
        return null;
      }
    },
    []
  );

  const fetchCurrentPlace = useCallback(
    async (showErrors = false): Promise<Coordinates | null> => {
      setLocationLoading(true);

      try {
        const coordinates = await getCurrentLocation(!showErrors);
        if (!coordinates) return null;

        setCurrentCoordinates(coordinates);

        try {
          const [address] = await Location.reverseGeocodeAsync(coordinates);
          if (!address) {
            setCurrentPlace({
              title: "Location found",
              subtitle: "Your area could not be identified",
            });
          } else {
            const title =
              address.district ||
              address.subregion ||
              address.city ||
              address.region ||
              "Location found";
            const cityOrRegion =
              address.city && address.city !== title
                ? address.city
                : address.region && address.region !== title
                  ? address.region
                  : null;
            const subtitle =
              cityOrRegion
                ? `${cityOrRegion}${address.country ? `, ${address.country}` : ""}`
                : address.country || "Your area could not be identified";

            setCurrentPlace({ title, subtitle });
          }
        } catch (error: unknown) {
          console.warn(
            "Location reverse geocoding error:",
            getErrorMessage(error, "Unknown")
          );
          setCurrentPlace({
            title: "Location found",
            subtitle: "Could not identify your area",
          });
        }

        return coordinates;
      } finally {
        setLocationLoading(false);
      }
    },
    [getCurrentLocation]
  );

  useEffect(() => {
    let active = true;

    const loadCurrentPlace = async () => {
      try {
        await fetchCurrentPlace(false);
      } catch (error: unknown) {
        console.warn(
          "Unable to load current location:",
          getErrorMessage(error, "Unknown")
        );
        if (active) {
          setCurrentPlace({
            title: "Location unavailable",
            subtitle: "Tap to try finding your location again",
          });
        }
      }
    };

    void loadCurrentPlace();

    return () => {
      active = false;
    };
  }, [fetchCurrentPlace]);

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

      setBrowseLocation(null);

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

  const handleNearMe = async () => {
    const location = await fetchCurrentPlace(true);
    if (!location) return;

    let detectedAreaNames: string[] = [];
    let detectedCity = "";
    try {
      const [address] = await Location.reverseGeocodeAsync(location);
      detectedAreaNames = [
        address?.district,
        address?.subregion,
        address?.name,
        address?.street,
      ].filter((value): value is string => Boolean(value));
      detectedCity = address?.city ?? address?.region ?? "";
    } catch (error: unknown) {
      console.warn(
        "Unable to identify current browsing area:",
        getErrorMessage(error, "Unknown")
      );
    }

    const detectedAreaListing = listings.find(
      (listing) =>
        detectedAreaNames.some(
          (area) =>
            normalizeText(area) === normalizeText(listing.area)
        ) &&
        (!detectedCity ||
          normalizeText(listing.city) === normalizeText(detectedCity))
    );
    const nearestListing = listings
      .flatMap((listing) => {
        const latitude = Number(listing.latitude);
        const longitude = Number(listing.longitude);
        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          !listing.area?.trim() ||
          !listing.city?.trim()
        ) {
          return [];
        }

        return [{
          listing,
          distance: getDistanceKm(
            location.latitude,
            location.longitude,
            latitude,
            longitude
          ),
        }];
      })
      .sort((a, b) => a.distance - b.distance)[0];

    if (detectedAreaListing) {
      setBrowseLocation({
        name: detectedAreaListing.area.trim(),
        city: detectedAreaListing.city.trim(),
        type: "area",
      });
    } else if (nearestListing && nearestListing.distance <= 20) {
      setBrowseLocation({
        name: nearestListing.listing.area.trim(),
        city: nearestListing.listing.city.trim(),
        type: "area",
      });
    } else {
      const currentCity = detectedCity.trim() || "Current location";
      setBrowseLocation({
        name: currentCity,
        city: currentCity,
        type: "city",
      });
    }

    setNearbyMode("all");
    setSearchText("");
    setSearchFocused(false);
    Keyboard.dismiss();
  };

  const getExploreLocationScope = () => {
    if (browseLocation?.type === "area") {
      return { area: browseLocation.name, city: browseLocation.city };
    }
    if (browseLocation?.type === "city") {
      return { area: "", city: browseLocation.name };
    }

    const currentArea = listings.find(
      (listing) =>
        normalizeText(listing.area) === normalizeText(currentPlace.title)
    )?.area;
    if (currentArea) {
      return {
        area: currentArea,
        city: listings.find(
          (listing) =>
            normalizeText(listing.area) === normalizeText(currentArea)
        )?.city ?? "",
      };
    }

    const currentCity = listings.find(
      (listing) =>
        normalizeText(listing.city) === normalizeText(currentPlace.title)
    )?.city;
    if (currentCity) return { area: "", city: currentCity };

    return { area: "", city: "" };
  };

  const handleExploreNearMe = async () => {
    Keyboard.dismiss();
    setLocationLoading(true);

    try {
      const liveLocation =
        currentCoordinates ?? (await getCurrentLocation(true));
      const selectedLabel = browseLocation
        ? `${browseLocation.name}, ${browseLocation.city}`
        : currentPlace.title;
      let selectedLocation = liveLocation;

      if (browseLocation) {
        try {
          const [geocodedLocation] = await Location.geocodeAsync(
            `${browseLocation.name}, ${browseLocation.city}`
          );
          if (geocodedLocation) {
            selectedLocation = {
              latitude: geocodedLocation.latitude,
              longitude: geocodedLocation.longitude,
            };
          }
        } catch (error: unknown) {
          console.warn(
            "Unable to geocode selected nearby-search location:",
            getErrorMessage(error, "Unknown")
          );
        }

        if (selectedLocation === liveLocation) {
          const matchingListings = listings.filter((listing) => {
            const matchesArea =
              browseLocation.type === "area" &&
              normalizeText(listing.area) ===
                normalizeText(browseLocation.name);
            const matchesCity =
              normalizeText(listing.city) ===
              normalizeText(browseLocation.city) &&
              (browseLocation.type === "city" || matchesArea);
            return matchesCity;
          });
          const listingCoordinates = matchingListings.flatMap((listing) => {
            const latitude = Number(listing.latitude);
            const longitude = Number(listing.longitude);
            return Number.isFinite(latitude) &&
              Number.isFinite(longitude) &&
              latitude >= -90 &&
              latitude <= 90 &&
              longitude >= -180 &&
              longitude <= 180
              ? [{ latitude, longitude }]
              : [];
          });

          if (listingCoordinates.length > 0) {
            selectedLocation = {
              latitude:
                listingCoordinates.reduce(
                  (total, point) => total + point.latitude,
                  0
                ) / listingCoordinates.length,
              longitude:
                listingCoordinates.reduce(
                  (total, point) => total + point.longitude,
                  0
                ) / listingCoordinates.length,
            };
          }
        }
      }

      router.push({
        pathname: "/(user)/nearby-pgs",
        params: {
          selectedLocation: selectedLabel,
          selectedLocationType: browseLocation?.type ?? "current",
          selectedLatitude: selectedLocation
            ? String(selectedLocation.latitude)
            : "",
          selectedLongitude: selectedLocation
            ? String(selectedLocation.longitude)
            : "",
          liveLatitude: liveLocation ? String(liveLocation.latitude) : "",
          liveLongitude: liveLocation ? String(liveLocation.longitude) : "",
        },
      });
    } finally {
      setLocationLoading(false);
    }
  };

  /*
   * ==========================================================================
   * METRO / COACHING / OFFICES
   * ==========================================================================
   */

  const handleNearbyPlaceSearch =
    async (
      resultFilter: "metro" | "it-park" | "coaching"
    ) => {
      setLocationLoading(
        true
      );

      try {
        const liveLocation =
          currentCoordinates ?? (await getCurrentLocation(true));
        if (!liveLocation) return;

        const locationScope = getExploreLocationScope();
        let selectedLocation: Coordinates | null = browseLocation
          ? null
          : liveLocation;
        if (browseLocation) {
          try {
            const [geocodedLocation] = await Location.geocodeAsync(
              `${browseLocation.name}, ${browseLocation.city}`
            );
            if (geocodedLocation) {
              selectedLocation = {
                latitude: geocodedLocation.latitude,
                longitude: geocodedLocation.longitude,
              };
            }
          } catch (error: unknown) {
            console.warn(
              "Unable to geocode selected nearby-results location:",
              getErrorMessage(error, "Unknown")
            );
          }

          if (!selectedLocation) {
            const matchesSelectedLocation = listings.filter(
              (listing) =>
                (!locationScope.area ||
                  normalizeText(listing.area) ===
                    normalizeText(locationScope.area)) &&
                (!locationScope.city ||
                  normalizeText(listing.city) ===
                    normalizeText(locationScope.city))
            );
            const validCoordinates = matchesSelectedLocation.flatMap(
              (listing) => {
                const latitude = Number(listing.latitude);
                const longitude = Number(listing.longitude);
                return Number.isFinite(latitude) &&
                  Number.isFinite(longitude) &&
                  latitude >= -90 &&
                  latitude <= 90 &&
                  longitude >= -180 &&
                  longitude <= 180
                  ? [{ latitude, longitude }]
                  : [];
              }
            );
            if (validCoordinates.length > 0) {
              selectedLocation = {
                latitude:
                  validCoordinates.reduce(
                    (total, point) => total + point.latitude,
                    0
                  ) / validCoordinates.length,
                longitude:
                  validCoordinates.reduce(
                    (total, point) => total + point.longitude,
                    0
                  ) / validCoordinates.length,
              };
            }
          }
        }

        const selectedLabel = browseLocation
          ? `${browseLocation.name}, ${browseLocation.city}`
          : currentPlace.title;
        router.push({
          pathname: "/(user)/nearby-pgs",
          params: {
            resultMode: "place",
            resultFilter,
            selectedLocation: selectedLabel,
            selectedLocationType: browseLocation?.type ?? "current",
            selectedArea: locationScope.area,
            selectedCity: locationScope.city,
            selectedLatitude: selectedLocation
              ? String(selectedLocation.latitude)
              : "",
            selectedLongitude: selectedLocation
              ? String(selectedLocation.longitude)
              : "",
            liveLatitude: String(liveLocation.latitude),
            liveLongitude: String(liveLocation.longitude),
          },
        });
      } catch (error: unknown) {
        console.warn(
          "Unable to open nearby PG results:",
          getErrorMessage(error, "Unknown")
        );
        Alert.alert(
          "Unable to Find Nearby PGs",
          "Please check your location settings and try again."
        );
      } finally {
        setLocationLoading(false);
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

      const metroNames = Array.from(
        new Set(
          Object.values(metroSearchBadges)
            .filter(
              (badge): badge is ListingProximityBadge =>
                badge?.type === "metro" &&
                normalizeText(badge.name).includes(query)
            )
            .map((badge) => badge.name)
        )
      )
        .slice(0, 4)
        .map((name) => ({
          id: `metro-${normalizeText(name)}`,
          type: "metro" as const,
          title: name,
          subtitle: "Metro station",
          placeName: name,
        }));
      if (
        normalizeText(searchText).includes("metro") &&
        metroNames.length === 0
      ) {
        metroNames.push({
          id: "metro-all",
          type: "metro",
          title: "Metro stations",
          subtitle: "PGs near metro stations",
          placeName: "",
        });
      }

      return [
        ...properties,
        ...areas,
        ...cities,
        ...metroNames,
      ].slice(0, 12);

    }, [
      listings,
      metroSearchBadges,
      searchText,
    ]);

  /*
   * ==========================================================================
   * SELECT SEARCH SUGGESTION
   * ==========================================================================
   */

  const openSearchResults = (
    query: string,
    resultType: "search" | "area" | "city" | "metro" = "search",
    city?: string,
    placeName = query
  ) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    Keyboard.dismiss();
    setSearchFocused(false);
    const locationScope = getExploreLocationScope();
    const selectedArea =
      resultType === "area"
        ? trimmedQuery
        : resultType === "metro"
          ? locationScope.area
          : "";
    const selectedCity =
      resultType === "area"
        ? city ?? locationScope.city
        : resultType === "city"
          ? trimmedQuery
          : resultType === "metro"
            ? locationScope.city
            : "";
    const selectedLocationLabel = browseLocation
      ? `${browseLocation.name}, ${browseLocation.city}`
      : currentPlace.title;

    router.push({
      pathname: "/(user)/nearby-pgs",
      params: {
        resultMode:
          resultType === "metro"
            ? "place"
            : resultType === "area" || resultType === "city"
              ? "area"
              : "search",
        resultFilter: resultType === "metro" ? "metro" : "",
        resultQuery: trimmedQuery,
        selectedLocation:
          resultType === "area" || resultType === "city"
            ? resultType === "city"
              ? trimmedQuery
              : `${trimmedQuery}, ${selectedCity}`
            : selectedLocationLabel,
        selectedLocationType:
          resultType === "city"
            ? "city"
            : resultType === "area" || browseLocation
              ? "area"
              : "current",
        selectedArea,
        selectedCity,
        placeName: resultType === "metro" ? placeName : "",
        selectedLatitude: "",
        selectedLongitude: "",
      },
    });
  };

  const handleSelectSuggestion = (suggestion: SearchSuggestion) => {
    openSearchResults(
      suggestion.title,
      suggestion.type === "property" ? "search" : suggestion.type,
      suggestion.type === "area"
        ? suggestion.subtitle.replace(/^Area in\s+/i, "")
        : undefined,
      suggestion.placeName ?? suggestion.title
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

          items =
            listings
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
          items =
            items.filter(
              ({ listing }) =>
                matchesPGType(
                  String(
                    readField(
                      listing,
                      "gender"
                    ) ?? ""
                  ),
                  [genderFilter]
                )
            );
        }

        if (browseLocation?.type === "area") {
          const cityListings = listings.filter(
            (listing) =>
              normalizeText(listing.city) ===
              normalizeText(browseLocation.city)
          );
          const areaCoordinates = cityListings.flatMap((listing) => {
            if (
              normalizeText(listing.area) !==
              normalizeText(browseLocation.name)
            ) {
              return [];
            }
            const latitude = Number(listing.latitude);
            const longitude = Number(listing.longitude);
            return Number.isFinite(latitude) &&
              Number.isFinite(longitude) &&
              latitude >= -90 &&
              latitude <= 90 &&
              longitude >= -180 &&
              longitude <= 180
              ? [{ latitude, longitude }]
              : [];
          });
          const areaAnchor = areaCoordinates.length
            ? {
                latitude:
                  areaCoordinates.reduce(
                    (total, point) => total + point.latitude,
                    0
                  ) / areaCoordinates.length,
                longitude:
                  areaCoordinates.reduce(
                    (total, point) => total + point.longitude,
                    0
                  ) / areaCoordinates.length,
              }
            : null;

          items = items
            .filter(
              ({ listing }) =>
                normalizeText(listing.city) ===
                normalizeText(browseLocation.city)
            )
            .map(({ listing }) => {
              const isSelectedArea =
                normalizeText(listing.area) ===
                normalizeText(browseLocation.name);
              const latitude = Number(listing.latitude);
              const longitude = Number(listing.longitude);
              const hasValidCoordinates =
                Number.isFinite(latitude) &&
                Number.isFinite(longitude) &&
                latitude >= -90 &&
                latitude <= 90 &&
                longitude >= -180 &&
                longitude <= 180;
              const distance =
                isSelectedArea
                  ? 0
                  : areaAnchor && hasValidCoordinates
                    ? getDistanceKm(
                        areaAnchor.latitude,
                        areaAnchor.longitude,
                        latitude,
                        longitude
                      )
                    : Number.POSITIVE_INFINITY;

              return { listing, distance };
            });
        } else if (browseLocation?.type === "city") {
          items = items.filter(
            ({ listing }) =>
              normalizeText(listing.city) ===
              normalizeText(browseLocation.name)
          );
        } else if (genderFilter !== "All") {
          const currentPlaceName = normalizeText(currentPlace.title);
          const currentCityName = normalizeText(
            currentPlace.subtitle.split(",")[0]
          );
          const hasMatchingArea = listings.some(
            (listing) =>
              normalizeText(listing.area) === currentPlaceName
          );
          const hasMatchingCity = listings.some(
            (listing) =>
              normalizeText(listing.city) === currentPlaceName
          );
          const hasSubtitleCity = listings.some(
            (listing) =>
              normalizeText(listing.city) === currentCityName
          );

          if (hasMatchingArea) {
            items = items.filter(
              ({ listing }) =>
                normalizeText(listing.area) === currentPlaceName
            );
          } else if (hasMatchingCity) {
            items = items.filter(
              ({ listing }) =>
                normalizeText(listing.city) === currentPlaceName
            );
          } else if (hasSubtitleCity) {
            items = items.filter(
              ({ listing }) =>
                normalizeText(listing.city) === currentCityName
            );
          }
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

                const propertyTypeMatches =
                  normalizeText(listing.property_type) ===
                  normalizeText(pgFilters.propertyType);

                if (!propertyTypeMatches) {
                  return false;
                }

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

                const acMatches = matchesAcType(
                  String(readField(listing, "ac_type") ?? ""),
                  pgFilters.acTypes
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

        if (browseLocation?.type === "area") {
          items = [...items].sort((a, b) => {
            const aInSelectedArea =
              normalizeText(a.listing.area) ===
              normalizeText(browseLocation.name);
            const bInSelectedArea =
              normalizeText(b.listing.area) ===
              normalizeText(browseLocation.name);
            if (aInSelectedArea !== bInSelectedArea) {
              return aInSelectedArea ? -1 : 1;
            }
            if (!aInSelectedArea) {
              return (a.distance ?? Number.POSITIVE_INFINITY) -
                (b.distance ?? Number.POSITIVE_INFINITY);
            }
            return 0;
          });
        }

        return items;

      },
      [
        listings,
        nearbyMode,
        currentCoordinates,
        radiusKm,
        genderFilter,
        browseLocation,
        currentPlace,
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

  const hasSearchInput =
    searchText.trim()
      .length > 0;

  const showSuggestions =
    searchFocused &&
    hasSearchInput;

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
    browseLocation !== null ||
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
      : "Recommended Stays";

  /*
   * RESULTS SUBTITLE
   */

  const resultsSubtitle =
    isPGSearch
      ? `PGs matching your selected preferences`
      : isNearby
        ? `PGs and hostels within ${radiusKm} km`
        : browseLocation
          ? browseLocation.type === "area"
            ? `Area in ${browseLocation.city}`
            : "Available stays in this city"
        : "";

  const openSortOptions = () => {
    Alert.alert("Sort stays", "Choose how to order the listings.", [
      {
      text: "Recommended",
      onPress: () => setSortMode("recommended"),
      },
      {
      text: "Price: Low to High",
      onPress: () => setSortMode("price_low"),
      },
      {
      text: "Price: High to Low",
      onPress: () => setSortMode("price_high"),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const openPreferences = () => {
    router.push({
      pathname: "/(user)/PG",
      params: pgFilters
      ? {
          filterMode: "edit",
          propertyType: pgFilters.propertyType,
          pgCity: pgFilters.city,
          pgAreas: JSON.stringify(pgFilters.areas),
          pgTypes: JSON.stringify(pgFilters.types),
          pgSharing: JSON.stringify(pgFilters.sharing),
          pgAcTypes: JSON.stringify(pgFilters.acTypes),
        }
      : { filterMode: "new" },
    });
  };

  const openLocationPicker = () => {
    setLocationSearch("");
    setLocationPickerCity(browseLocation?.city ?? null);
    setAlphabetRailVisible(true);
    setLocationPickerVisible(true);
  };

  const chooseLocationCity = (city: string) => {
    setLocationPickerCity(city);
    setLocationSearch("");
  };

  const scrollToCityLetter = (letter: string) => {
    const offset = cityLetterOffsetsRef.current[letter];
    if (offset !== undefined) {
      cityDirectoryRef.current?.scrollTo({ y: offset, animated: true });
    }
  };

  const scrubCityAlphabet = (pageY: number) => {
    const { top, height } = alphabetRailFrameRef.current;
    if (!height || !locationAlphabet.length) return;

    const index = Math.max(
      0,
      Math.min(
        locationAlphabet.length - 1,
        Math.floor(((pageY - top) / height) * locationAlphabet.length)
      )
    );
    scrollToCityLetter(locationAlphabet[index]);
  };

  const measureAlphabetRail = () => {
    alphabetRailRef.current?.measureInWindow((_x, y, _width, height) => {
      alphabetRailFrameRef.current = { top: y, height };
    });
  };

  const applyLocationCity = (city: string) => {
    selectBrowseLocation({ name: city, city, type: "city" });
  };

  const selectBrowseLocation = (location: BrowseLocation) => {
    Keyboard.dismiss();
    setLocationPickerVisible(false);
    setLocationSearch("");
    setLocationPickerCity(null);
    setBrowseLocation(location);
    setNearbyMode("all");
    setCurrentCoordinates(null);
    setSearchText("");
    setSearchFocused(false);

    if (pgFilters) {
      router.replace("/(user)/home");
    }
  };

  const clearBrowseLocation = () => {
    setBrowseLocation(null);
    setLocationPickerVisible(false);
    setLocationSearch("");
    setLocationPickerCity(null);
  };

  const openMapDataAttribution = async () => {
    try {
      await Linking.openURL("https://www.openstreetmap.org/copyright");
    } catch (error: unknown) {
      console.warn("Unable to open OpenStreetMap attribution:", error);
      Alert.alert(
        "Map data attribution",
        "OpenStreetMap contributor information could not be opened."
      );
    }
  };

  const handleGenderCategory = async (gender: GenderFilter) => {
    setLocationLoading(true);
    try {
      const liveLocation =
        currentCoordinates ?? (await getCurrentLocation(true));
      if (!liveLocation) return;

      const locationScope = getExploreLocationScope();
      let selectedLocation: Coordinates | null = browseLocation
        ? null
        : liveLocation;
      if (browseLocation) {
        const matchingListings = listings.filter(
        (listing) =>
          (!locationScope.area ||
            normalizeText(listing.area) ===
              normalizeText(locationScope.area)) &&
          (!locationScope.city ||
            normalizeText(listing.city) ===
              normalizeText(locationScope.city))
        );
        const validCoordinates = matchingListings.flatMap((listing) => {
          const latitude = Number(listing.latitude);
          const longitude = Number(listing.longitude);
          return Number.isFinite(latitude) &&
            Number.isFinite(longitude) &&
            latitude >= -90 &&
            latitude <= 90 &&
            longitude >= -180 &&
            longitude <= 180
            ? [{ latitude, longitude }]
            : [];
        });
        if (validCoordinates.length > 0) {
          selectedLocation = {
            latitude:
              validCoordinates.reduce((total, point) => total + point.latitude, 0) /
              validCoordinates.length,
            longitude:
              validCoordinates.reduce((total, point) => total + point.longitude, 0) /
              validCoordinates.length,
          };
        }
      }

      router.push({
        pathname: "/(user)/nearby-pgs",
        params: {
          resultMode: "gender",
          resultFilter: gender,
          selectedLocation: browseLocation
            ? `${browseLocation.name}, ${browseLocation.city}`
            : currentPlace.title,
          selectedLocationType: browseLocation?.type ?? "current",
          selectedArea: locationScope.area,
          selectedCity: locationScope.city,
          selectedLatitude: selectedLocation
            ? String(selectedLocation.latitude)
            : "",
          selectedLongitude: selectedLocation
            ? String(selectedLocation.longitude)
            : "",
          liveLatitude: String(liveLocation.latitude),
          liveLongitude: String(liveLocation.longitude),
        },
      });
    } catch (error: unknown) {
      console.warn("Unable to open filtered PG results:", error);
      Alert.alert(
        "Unable to Find PGs",
        "Please check your location settings and try again."
      );
    } finally {
      setLocationLoading(false);
    }
  };

  /*
   * ==========================================================================
   * UI
   * ==========================================================================
   */

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC]" edges={["top"]}>
      <View className="border-b border-[#E2E8F0] bg-white px-4 pb-3 pt-2">
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={openLocationPicker}
            accessibilityRole="button"
            accessibilityLabel={`Selected location: ${
              browseLocation?.name ?? currentPlace.title
            }. Tap to choose an area or city`}
            className="mr-3 flex-1 flex-row items-center"
          >
            <View className="mr-2.5 h-10 w-10 items-center justify-center rounded-full bg-[#EFF6FF]">
              <MaterialCommunityIcons
                name="map-marker"
                size={20}
                color="#2563EB"
              />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center">
                <Text
                  numberOfLines={1}
                  className="max-w-[220px] text-[13px] font-extrabold text-[#0F172A]"
                >
                  {browseLocation?.name ??
                    (locationLoading
                      ? "Finding your location..."
                      : currentPlace.title)}
                </Text>
                <MaterialCommunityIcons
                  name="chevron-down"
                  size={16}
                  color="#94A3B8"
                />
              </View>
              <Text
                numberOfLines={1}
                className="mt-0.5 text-[10px] text-[#64748B]"
              >
                {browseLocation
                  ? browseLocation.city
                  : currentPlace.subtitle}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() =>
              Alert.alert(
                "Notifications",
                "Listing notifications will appear here when available."
              )
            }
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            className="mr-2 h-10 w-10 items-center justify-center rounded-full bg-[#F1F5F9]"
          >
            <MaterialCommunityIcons
              name="bell-outline"
              size={19}
              color="#475569"
            />
          </Pressable>
          <Pressable
            onPress={openPreferences}
            accessibilityRole="button"
            accessibilityLabel="Open search preferences"
            className="h-10 w-10 items-center justify-center rounded-full bg-[#F1F5F9]"
          >
            <MaterialCommunityIcons
              name="tune-variant"
              size={19}
              color="#475569"
            />
          </Pressable>
        </View>

        <View className="mt-3 flex-row items-center">
          <View className="flex-1 flex-row items-center rounded-[14px] bg-[#F1F5F9] px-3">
            <MaterialCommunityIcons
              name="magnify"
              size={19}
              color="#94A3B8"
            />
            <TextInput
              ref={inputRef}
              value={searchText}
              onChangeText={handleSearchTextChange}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
              placeholder="Search PG name, area or metro station..."
              placeholderTextColor="#94A3B8"
              returnKeyType="search"
              onSubmitEditing={() =>
                openSearchResults(
                  searchText,
                  normalizeText(searchText).includes("metro")
                    ? "metro"
                    : "search"
                )
              }
              className="h-[44px] flex-1 px-2 text-[12px] text-[#0F172A]"
              accessibilityLabel="Search PG name, area or metro station"
            />
            {searchText.length > 0 ? (
              <Pressable
                onPress={handleClearSearch}
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
          </View>
        </View>

        {showSuggestions && (
          <View className="mt-2 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white">
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
                    backgroundColor: pressed ? "#F8FAFC" : "#FFFFFF",
                  })}
                >
                  <View className="h-9 w-9 items-center justify-center rounded-full bg-[#EFF6FF]">
                    <Text className="text-[17px]">
                      {getSuggestionIcon(suggestion.type)}
                    </Text>
                  </View>
                  <View className="ml-3 flex-1">
                    <Text
                      numberOfLines={1}
                      className="text-[13px] font-bold text-[#0F172A]"
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
              <View className="px-5 py-5">
                <Text className="text-center text-[13px] font-bold text-[#0F172A]">
                  No matching properties
                </Text>
                <Text className="mt-1 text-center text-[11px] text-[#64748B]">
                  Try another PG name, area or city.
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={() => {
          Keyboard.dismiss();
          setSearchFocused(false);
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 28,
        }}
      >
        <View className="overflow-hidden rounded-[20px] bg-[#2563EB] p-4">
          <View
            className="absolute bottom-0 right-0 top-0 rounded-l-full bg-[#4F46E5]"
            style={{ width: "43%", opacity: 0.8 }}
          />
          <View className="absolute -bottom-10 -right-5 h-36 w-36 rounded-full bg-[#818CF8] opacity-20" />
          <View className="relative">
            <Text className="self-start rounded-md bg-[#FFFFFF33] px-2 py-1 text-[10px] font-extrabold uppercase text-white">
              Zero Brokerage
            </Text>
            <Text className="mt-2 text-[18px] font-extrabold leading-6 text-white">
              Verified PGs Near Your Office & Metro
            </Text>
            <Text className="mt-1 text-[12px] leading-[18px] text-[#DBEAFE]">
              Check live distance to your workspace before booking.
            </Text>
            <Pressable
              onPress={() => void handleExploreNearMe()}
              disabled={locationLoading}
              accessibilityRole="button"
              accessibilityLabel="Explore PGs near my current location"
              className="mt-3 self-start flex-row items-center rounded-[10px] bg-white px-3.5 py-2"
            >
              {locationLoading ? (
                <ActivityIndicator size="small" color="#1D4ED8" />
              ) : (
                <>
                  <Text className="text-[12px] font-bold text-[#1D4ED8]">
                    Explore Near Me
                  </Text>
                  <MaterialCommunityIcons
                    name="arrow-right"
                    size={15}
                    color="#1D4ED8"
                    style={{ marginLeft: 5 }}
                  />
                </>
              )}
            </Pressable>
          </View>
        </View>

        <View className="mt-6">
          <View className="mb-2.5 flex-row items-center justify-between">
            <Text className="text-[13px] font-extrabold uppercase text-[#0F172A]">
              Explore by needs
            </Text>
            <Pressable
              onPress={openPreferences}
              accessibilityRole="button"
              accessibilityLabel="View all search preferences"
            >
              <Text className="text-[12px] font-bold text-[#2563EB]">
                View All
              </Text>
            </Pressable>
          </View>

          <View className="flex-row flex-wrap justify-between">
            {EXPLORE_CATEGORIES.map((category) => (
              <Pressable
                key={category.label}
                onPress={() => {
                  if (category.action === "place") {
                    void handleNearbyPlaceSearch(category.filter);
                  } else {
                    handleGenderCategory(category.filter);
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={`${category.label}: ${category.subtitle}`}
                className="mb-2.5 items-center justify-center rounded-[20px] border px-2"
                style={{
                  width: "31.8%",
                  height: 134,
                  backgroundColor: category.background,
                  borderColor: category.border,
                }}
              >
                <View className="mb-2 h-10 w-10 items-center justify-center rounded-[14px] bg-white">
                  <Text className="text-[19px]">{category.icon}</Text>
                </View>
                <Text
                  numberOfLines={1}
                  className="text-center text-[12px] font-bold text-[#0F172A]"
                >
                  {category.label}
                </Text>
                <Text
                  numberOfLines={1}
                  className="mt-2 text-center text-[10px] text-[#94A3B8]"
                >
                  {category.subtitle}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {isPGSearch && pgFilters ? (
          <View className="mb-4 mt-2 rounded-[16px] border border-[#DBEAFE] bg-white p-3.5">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-[10px] font-extrabold text-[#2563EB]">
                  YOUR PREFERENCES
                </Text>
                <Text className="mt-1 text-[13px] font-bold text-[#0F172A]">
                  {pgFilters.city} · {pgFilters.areas.join(", ") || "All areas"}
                </Text>
              </View>
              <Pressable
                onPress={openPreferences}
                className="rounded-full bg-[#EFF6FF] px-3.5 py-2"
              >
                <Text className="text-[11px] font-bold text-[#2563EB]">
                  Change
                </Text>
              </Pressable>
            </View>
            <Pressable
              onPress={clearPgFilters}
              className="mt-2 self-start"
            >
              <Text className="text-[10px] font-semibold text-[#64748B]">
                Clear preferences
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View className="mb-3 mt-4 flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-[15px] font-extrabold uppercase text-[#0F172A]">
              {resultsTitle}
            </Text>
            {resultsSubtitle ? (
              <Text className="mt-1 text-[10px] text-[#64748B]">
                {resultsSubtitle}
              </Text>
            ) : null}
          </View>
          <View className="flex-row items-center">
            <View className="mr-2 rounded-full bg-[#D1FAE5] px-2.5 py-1">
              <Text className="text-[10px] font-bold text-[#047857]">
                {results.length} Available
              </Text>
            </View>
            <Pressable
              onPress={openSortOptions}
              accessibilityRole="button"
              accessibilityLabel={`Sort stays. Current sort: ${
                SORT_OPTIONS.find((option) => option.value === sortMode)?.label
              }`}
              className="h-8 w-8 items-center justify-center rounded-full bg-white"
            >
              <MaterialCommunityIcons
                name="sort"
                size={18}
                color="#475569"
              />
            </Pressable>
          </View>
        </View>
        {Object.values(proximityBadges).some(Boolean) ? (
          <Pressable
            onPress={() => void openMapDataAttribution()}
            accessibilityRole="link"
            className="-mt-2 mb-2 self-start"
          >
            <Text className="text-[9px] text-[#64748B]">
              Nearby place data © OpenStreetMap contributors
            </Text>
          </Pressable>
        ) : null}

        <View>
          {loading ? (
            <View className="items-center py-16">
              <ActivityIndicator size="large" color="#2563EB" />
              <Text className="mt-3 text-[12px] text-[#64748B]">
                Loading properties...
              </Text>
            </View>
          ) : loadError ? (
            <View className="items-center rounded-[20px] border border-[#E2E8F0] bg-white p-8">
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
                <Text className="text-[12px] font-bold text-white">Try Again</Text>
              </Pressable>
            </View>
          ) : results.length === 0 ? (
            <View className="items-center rounded-[20px] border border-[#E2E8F0] bg-white p-8">
              <Text className="text-[42px]">
                {isPGSearch ? "🏠" : isNearby ? "📍" : "🔍"}
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
              <View key={listing.id} style={{ paddingBottom: 12 }}>
                {isNearby && distance !== null && (
                  <Text className="mb-1.5 ml-1 text-[11px] font-bold text-[#2563EB]">
                    📍 {formatDistance(distance)}
                  </Text>
                )}
                <ListingCard
                  listing={listing}
                  imageHeight={260}
                  elevated
                  proximityBadge={proximityBadges[listing.id] ?? null}
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

      <Modal
        visible={locationPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLocationPickerVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close location picker"
            onPress={() => setLocationPickerVisible(false)}
            onTouchStart={() => setLocationPickerVisible(false)}
            className="flex-1"
          />
          <View className="h-[88%] rounded-t-[28px] bg-white px-5 pb-6 pt-5">
            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-1 flex-row items-center">
                {locationPickerCity ? (
                  <Pressable
                    onPress={() => {
                      setLocationPickerCity(null);
                      setLocationSearch("");
                        setAlphabetRailVisible(true);
                      }}
                    accessibilityRole="button"
                    accessibilityLabel="Back to city selection"
                    className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-[#F1F5F9]"
                  >
                    <MaterialCommunityIcons
                      name="arrow-left"
                      size={20}
                      color="#475569"
                    />
                  </Pressable>
                ) : null}
                <View className="flex-1">
                <Text className="text-[20px] font-extrabold text-[#0F172A]">
                  {locationPickerCity ? "Choose an area" : "Choose your city"}
                </Text>
                <Text className="mt-1 text-[12px] text-[#64748B]">
                  {locationPickerCity
                    ? `Explore neighborhoods in ${locationPickerCity}`
                    : "Select a city to see its neighborhoods"}
                </Text>
                </View>
              </View>
              <Pressable
                onPress={() => setLocationPickerVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
                className="h-10 w-10 items-center justify-center rounded-full bg-[#F1F5F9]"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color="#475569"
                />
              </Pressable>
            </View>

            <View className="mb-3 flex-row items-center rounded-[14px] bg-[#F1F5F9] px-3">
              <MaterialCommunityIcons
                name="magnify"
                size={19}
                color="#94A3B8"
              />
              <TextInput
                value={locationSearch}
                onFocus={() => setAlphabetRailVisible(false)}
                onChangeText={(text) => {
                  setAlphabetRailVisible(false);
                  setLocationSearch(text);
                }}
                placeholder={
                  locationPickerCity
                    ? `Search areas in ${locationPickerCity}`
                    : "Search city"
                }
                placeholderTextColor="#94A3B8"
                className="h-[48px] flex-1 px-2 text-[14px] text-[#0F172A]"
                accessibilityLabel="Search areas and cities"
              />
              {locationSearch.length > 0 ? (
                <Pressable
                  onPress={() => setLocationSearch("")}
                  accessibilityRole="button"
                  accessibilityLabel="Clear location search"
                  hitSlop={8}
                >
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={19}
                    color="#94A3B8"
                  />
                </Pressable>
              ) : null}
            </View>

            <Pressable
              onPress={() => {
                setBrowseLocation(null);
                setLocationPickerVisible(false);
                void handleNearMe();
              }}
              className="mb-2 flex-row items-center rounded-[14px] border border-[#DBEAFE] px-3 py-3"
            >
              <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-[#EFF6FF]">
                <MaterialCommunityIcons
                  name="crosshairs-gps"
                  size={20}
                  color="#2563EB"
                />
              </View>
              <View className="flex-1">
                <Text className="text-[13px] font-bold text-[#2563EB]">
                  Use my current location
                </Text>
                <Text className="mt-0.5 text-[11px] text-[#64748B]">
                  Show stays closest to you
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color="#94A3B8"
              />
            </Pressable>

            {browseLocation ? (
              <Pressable
                onPress={clearBrowseLocation}
                className="mb-2 flex-row items-center rounded-[14px] px-3 py-3"
              >
                <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-[#F1F5F9]">
                  <MaterialCommunityIcons
                    name="map-outline"
                    size={20}
                    color="#475569"
                  />
                </View>
                <Text className="flex-1 text-[13px] font-bold text-[#334155]">
                  Browse all locations
                </Text>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color="#94A3B8"
                />
              </Pressable>
            ) : null}

            {locationPickerCity ? (
              <Pressable
                onPress={() => applyLocationCity(locationPickerCity)}
                className="mb-3 flex-row items-center rounded-[16px] border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-3"
              >
                <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-white">
                  <MaterialCommunityIcons
                    name="city-variant-outline"
                    size={20}
                    color="#2563EB"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[13px] font-bold text-[#1D4ED8]">
                    All areas in {locationPickerCity}
                  </Text>
                  <Text className="mt-0.5 text-[11px] text-[#64748B]">
                    Show every available stay in this city
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color="#2563EB"
                />
              </Pressable>
            ) : null}

            <View className="flex-1">
              {locationPickerCity ? (
                <>
                  <Text className="mb-2 mt-1 text-[11px] font-extrabold uppercase tracking-[0.7px] text-[#64748B]">
                    {locationSearch ? "Matching areas" : "Popular areas"}
                  </Text>
                  <ScrollView
                    className="flex-1"
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    {filteredLocationAreas.length > 0 ? (
                      filteredLocationAreas.map((area) => (
                        <Pressable
                          key={`${locationPickerCity}:${area}`}
                          onPress={() =>
                            selectBrowseLocation({
                              name: area,
                              city: locationPickerCity,
                              type: "area",
                            })
                          }
                          className="flex-row items-center border-b border-[#F1F5F9] px-1 py-3"
                        >
                          <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-[#F8FAFC]">
                            <MaterialCommunityIcons
                              name="map-marker-outline"
                              size={19}
                              color="#64748B"
                            />
                          </View>
                          <View className="flex-1">
                            <Text className="text-[13px] font-bold text-[#0F172A]">
                              {area}
                            </Text>
                            <Text className="mt-0.5 text-[11px] text-[#64748B]">
                              Area · {locationPickerCity}
                            </Text>
                          </View>
                          <MaterialCommunityIcons
                            name="chevron-right"
                            size={19}
                            color="#94A3B8"
                          />
                        </Pressable>
                      ))
                    ) : (
                      <View className="items-center py-8">
                        <Text className="text-[13px] font-bold text-[#0F172A]">
                          No areas found
                        </Text>
                        <Text className="mt-1 text-[11px] text-[#64748B]">
                          Try a different area or choose all areas in this city.
                        </Text>
                      </View>
                    )}
                  </ScrollView>
                </>
              ) : (
                <>
                  {!locationSearch ? (
                    <View className="mb-4">
                      <Text className="mb-2.5 text-[12px] font-extrabold text-[#0F172A]">
                        Popular destinations
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingRight: 8 }}
                      >
                        {FEATURED_CITIES.filter((featured) =>
                          locationCities.some(
                            (city) =>
                              normalizeText(city) ===
                              normalizeText(featured.name)
                          )
                        ).map((featured) => (
                          <Pressable
                            key={featured.name}
                            onPress={() => chooseLocationCity(featured.name)}
                            accessibilityRole="button"
                            accessibilityLabel={`${featured.name}, famous for ${featured.landmark}`}
                            className="mr-3 overflow-hidden rounded-[18px] border border-[#E2E8F0]"
                            style={{ width: 142 }}
                          >
                            <View
                              className="h-[76px] items-center justify-center"
                              style={{ backgroundColor: featured.color }}
                            >
                              <Text className="text-[34px]">
                                {featured.icon}
                              </Text>
                            </View>
                            <View className="px-3 py-2.5">
                              <Text className="text-[12px] font-extrabold text-[#0F172A]">
                                {featured.name}
                              </Text>
                              <Text
                                numberOfLines={1}
                                className="mt-0.5 text-[10px] text-[#64748B]"
                              >
                                {featured.landmark}
                              </Text>
                            </View>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  ) : null}

                  <View className="mb-2 flex-row items-center justify-between">
                    <Text className="text-[12px] font-extrabold text-[#0F172A]">
                      {locationSearch ? "Search results" : "All cities"}
                    </Text>
                    <Text className="text-[10px] text-[#64748B]">
                      {filteredLocationCities.length} cities
                    </Text>
                  </View>

                  {groupedLocationCities.length > 0 ? (
                    <View className="flex-1 flex-row">
                      <ScrollView
                        ref={cityDirectoryRef}
                        className="flex-1"
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                        scrollEventThrottle={16}
                        onTouchStart={() => {
                          if (alphabetRailVisible) {
                            setAlphabetRailVisible(false);
                          }
                        }}
                        onScroll={() => {
                          if (alphabetRailVisible) {
                            setAlphabetRailVisible(false);
                          }
                        }}
                      >
                        {groupedLocationCities.map(([letter, cities]) => (
                          <View
                            key={letter}
                            onLayout={(event) => {
                              cityLetterOffsetsRef.current[letter] =
                                event.nativeEvent.layout.y;
                            }}
                          >
                            {cities.map((city) => (
                              <Pressable
                                key={city}
                                onPress={() => chooseLocationCity(city)}
                                className="justify-center border-b border-[#E5E7EB] px-1 py-4"
                              >
                                <Text className="text-[15px] font-semibold text-[#0F172A]">
                                  {city}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        ))}
                      </ScrollView>

                      {locationAlphabet.length > 1 &&
                      alphabetRailVisible ? (
                        <View
                          ref={alphabetRailRef}
                          onLayout={measureAlphabetRail}
                          onTouchStart={(event) =>
                            scrubCityAlphabet(event.nativeEvent.pageY)
                          }
                          onTouchMove={(event) =>
                            scrubCityAlphabet(event.nativeEvent.pageY)
                          }
                          className="ml-1.5 w-7 self-stretch items-center justify-around"
                        >
                          {locationAlphabet.map((letter) => (
                            <Pressable
                              key={letter}
                              onPress={() => scrollToCityLetter(letter)}
                              accessibilityRole="button"
                              accessibilityLabel={`Jump to cities starting with ${letter}`}
                              className="min-h-[22px] w-7 items-center justify-center"
                            >
                              <Text className="text-[10px] font-bold text-[#2563EB]">
                                {letter}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  ) : (
                    <View className="flex-1 items-center justify-center">
                      <MaterialCommunityIcons
                        name="map-search-outline"
                        size={36}
                        color="#94A3B8"
                      />
                      <Text className="mt-3 text-[13px] font-bold text-[#0F172A]">
                        No cities found
                      </Text>
                      <Text className="mt-1 text-[11px] text-[#64748B]">
                        Try another city name.
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}