
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ownerFetch } from "../../../constants/api";


import {

  ActivityIndicator,

  Alert,

  KeyboardAvoidingView,

  KeyboardTypeOptions,

  Linking,

  Modal,

  Platform,

  Pressable,

  ScrollView,

  Text,

  TextInput,

  View,

} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";



import { router, useLocalSearchParams  } from "expo-router";

import * as Location from "expo-location";

import DateTimePicker, {

  DateTimePickerEvent,

} from "@react-native-community/datetimepicker";

import ListingLocationMap from "../../../components/ListingLocationMap";
import type {
  ListingLocationMapHandle,
  LocationCoordinate,
  LocationRegion,
} from "../../../components/ListingLocationMap.types";



import {

  API_BASE_URL,

  ApiError,

  postJson,

} from "../../../constants/api";



// ============================================================================

// TYPES & CONSTANTS

// ============================================================================



type PropertyType = "PG" | "Hostel";

type GenderType = "Boy's" | "Girl's" | "Co-living";

type ACType = "AC" | "Non-AC";

type YesNo = "Yes" | "No";

type FoodType = "Veg" | "Non-Veg" | "Both";

type SharingType = "1" | "2" | "3" | "4" | "5" | "10";


type SharingPricing = {
  id?: string;
  key: string;
  sharing_type: SharingType;
  ac_type: ACType;
  floor: string;
  monthly_price: string;
  total_beds: string;
  available_beds: string;
  filled_beds: string;
  isConfirmed?: boolean;
};




const GENDER_OPTIONS: GenderType[] = ["Boy's", "Girl's", "Co-living"];

const FOOD_TYPES: FoodType[] = ["Veg", "Non-Veg", "Both"];

const SHARING_OPTIONS: SharingType[] = ["1", "2", "3", "4", "5", "10"];



const FACILITIES = [

  "Wi-Fi",

  "Parking",

  "WashingMachine",

  "Attached Bathroom",

  "Power Backup",

  "CCTV",

];



const CREATE_LISTING_PATH = "/api/v1/owner/listings";



const DEFAULT_REGION: LocationRegion = {

  latitude: 17.385,

  longitude: 78.4867,

  latitudeDelta: 0.08,

  longitudeDelta: 0.08,

};



// ============================================================================

// HELPERS

// ============================================================================



function getErrorMessage(error: unknown, fallback: string): string {

  if (error instanceof Error && error.message) return error.message;

  if (typeof error === "string" && error) return error;

  return fallback;

}



function toggleInList(list: string[], value: string) {

  return list.includes(value)

    ? list.filter((item) => item !== value)

    : [...list, value];

}



/** Date -> "8:00 AM" */

function formatTime(date: Date): string {

  let hours = date.getHours();

  const minutes = date.getMinutes();

  const suffix = hours >= 12 ? "PM" : "AM";



  hours = hours % 12 || 12;



  return `${hours}:${String(minutes).padStart(2, "0")} ${suffix}`;

}



/** "8:00 AM" -> Date (today at that time) */

function parseTime(value: string): Date | null {

  const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(value.trim());

  if (!match) return null;



  let hours = Number(match[1]) % 12;

  if (match[3] === "PM") hours += 12;



  const date = new Date();

  date.setHours(hours, Number(match[2]), 0, 0);

  return date;

}



function toMinutes(value: string): number | null {
  const date = parseTime(value);

  return date ? date.getHours() * 60 + date.getMinutes() : null;
}


type GooglePlaceSuggestion = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  formattedAddress: string;
};

function normalizePlaceText(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseGooglePlaceSuggestion(prediction: any): GooglePlaceSuggestion | null {
  const placeId = normalizePlaceText(prediction?.placeId ?? prediction?.id);
  if (!placeId) return null;

  const mainText = normalizePlaceText(
    prediction?.structuredFormat?.mainText?.text ??
      prediction?.text?.text ??
      prediction?.description
  );

  const secondaryText = normalizePlaceText(
    prediction?.structuredFormat?.secondaryText?.text ??
      prediction?.text?.text ??
      prediction?.description
  );

  const formattedAddress = [mainText, secondaryText]
    .filter(Boolean)
    .join(", ")
    .trim();

  return {
    placeId,
    mainText: mainText || "Selected location",
    secondaryText: secondaryText || "Tap to use this place",
    formattedAddress: formattedAddress || mainText || "Selected location",
  };
}

function getCityAndAreaFromAddress(formattedAddress: string) {
  const parts = formattedAddress
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return { city: "", area: "" };
  }

  const city = parts[parts.length - 2] || parts[parts.length - 3] || "";
  const area = parts[parts.length - 3] || parts[parts.length - 4] || "";

  return { city, area };
}

// ============================================================================

// SCREEN
// ============================================================================



export default function CreateListing() {


  const { listingId, mode } = useLocalSearchParams<{
  listingId?: string;
  mode?: string;
}>();

const isEditMode = mode === "edit" && Boolean(listingId);

  // --------------------------------------------------------------------------

  // Basic

  // --------------------------------------------------------------------------



  const [propertyName, setPropertyName] = useState("");

  const [ownerPhone, setOwnerPhone] = useState("");

  const [propertyType, setPropertyType] = useState<PropertyType>("PG");

  const [gender, setGender] = useState<GenderType>("Boy's");

  const [description, setDescription] = useState("");



  // --------------------------------------------------------------------------

  // Pricing
  // --------------------------------------------------------------------------

  const [securityDeposit, setSecurityDeposit] = useState("");

  // --------------------------------------------------------------------------
  // Sharing & Beds
  // --------------------------------------------------------------------------

  const [sharingPricing, setSharingPricing] = useState<SharingPricing[]>([]);

  const [acType, setAcType] = useState<ACType>("Non-AC");



  // --------------------------------------------------------------------------

  // Facilities & food

  // --------------------------------------------------------------------------



  const [facilities, setFacilities] = useState<string[]>([]);



  const [foodAvailable, setFoodAvailable] = useState<YesNo>("No");

  const [foodType, setFoodType] = useState<FoodType>("Veg");



  const [breakfastStart, setBreakfastStart] = useState("");

  const [breakfastEnd, setBreakfastEnd] = useState("");

  const [lunchStart, setLunchStart] = useState("");

  const [lunchEnd, setLunchEnd] = useState("");

  const [dinnerStart, setDinnerStart] = useState("");

  const [dinnerEnd, setDinnerEnd] = useState("");



  // --------------------------------------------------------------------------

  // Location

  // --------------------------------------------------------------------------



  const [city, setCity] = useState("");

  const [area, setArea] = useState("");

  const [address, setAddress] = useState("");



  const [latitude, setLatitude] = useState<number | null>(null);

  const [longitude, setLongitude] = useState<number | null>(null);



  const [isGettingLocation, setIsGettingLocation] = useState(false);



  const mapRef = useRef<ListingLocationMapHandle>(null);



  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const [locationSearch, setLocationSearch] = useState("");

  const [placeSuggestions, setPlaceSuggestions] = useState<GooglePlaceSuggestion[]>([]);

  const [isSearchingLocation, setIsSearchingLocation] = useState(false);

  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);

  const [isFetchingPlaceDetails, setIsFetchingPlaceDetails] = useState(false);

  const [mapRegion, setMapRegion] = useState<LocationRegion>(DEFAULT_REGION);

  const [selectedLocation, setSelectedLocation] = useState<LocationCoordinate | null>(

    null

  );

  const suggestionsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const autocompleteRequestIdRef = useRef(0);

  const placeDetailRequestIdRef = useRef(0);



  // --------------------------------------------------------------------------

  // Rules & loading

  // --------------------------------------------------------------------------



  const [restrictions, setRestrictions] = useState("");

  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    return () => {
      if (suggestionsDebounceRef.current) {
        clearTimeout(suggestionsDebounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!showLocationPicker) {
      setPlaceSuggestions([]);
      setIsFetchingSuggestions(false);
    }
  }, [showLocationPicker]);

  useEffect(() => {
    if (!isEditMode || !listingId) return;

    let cancelled = false;

    const loadListingForEdit = async () => {
      try {
        const response = await ownerFetch(
          `/api/v1/owner/listings/${encodeURIComponent(listingId)}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.detail || "Could not load property details."
          );
        }

        if (cancelled) return;

        setPropertyName(data.name ?? "");
        setOwnerPhone(data.owner_phone ?? "");
        setPropertyType(data.property_type ?? "PG");
        setGender(data.gender ?? "Boy's");
        setDescription(data.description ?? "");
        setSecurityDeposit(
          data.security_deposit != null
            ? String(data.security_deposit)
            : ""
        );

        setSharingPricing(
        (data.sharing ?? []).map((item: any, index: number) => ({
          id: item.id ? String(item.id) : undefined,
          key: item.id
            ? String(item.id)
            : `existing-${index}-${Date.now()}`,
          sharing_type: String(item.sharing_type) as SharingType,
          ac_type: (item.ac_type ?? data.ac_type ?? "Non-AC") as ACType,
          floor: String(item.floor ?? ""),
          monthly_price: String(item.monthly_price ?? ""),
          total_beds: String(item.total_beds ?? ""),
          available_beds: String(item.available_beds ?? ""),
          filled_beds: String(item.filled_beds ?? ""),
          isConfirmed: true,
        }))
      );

        setAcType(data.ac_type ?? "Non-AC");
        setFacilities(data.facilities ?? []);
        setFoodAvailable(data.food_available ?? "No");
        setFoodType(data.food_type ?? "Veg");

        setBreakfastStart(data.breakfast_start_time ?? "");
        setBreakfastEnd(data.breakfast_end_time ?? "");
        setLunchStart(data.lunch_start_time ?? "");
        setLunchEnd(data.lunch_end_time ?? "");
        setDinnerStart(data.dinner_start_time ?? "");
        setDinnerEnd(data.dinner_end_time ?? "");

        setCity(data.city ?? "");
        setArea(data.area ?? "");
        setAddress(data.address ?? "");
        setRestrictions(data.restrictions ?? "");

        const lat =
          data.latitude != null ? Number(data.latitude) : null;
        const lng =
          data.longitude != null ? Number(data.longitude) : null;

        if (
          lat !== null &&
          lng !== null &&
          Number.isFinite(lat) &&
          Number.isFinite(lng)
        ) {
          setLatitude(lat);
          setLongitude(lng);

          const location = {
            latitude: lat,
            longitude: lng,
          };

          setSelectedLocation(location);
          setMapRegion({
            ...location,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        }
      } catch (error) {
        if (!cancelled) {
          Alert.alert(
            "Unable to load property",
            error instanceof Error
              ? error.message
              : "Please try again."
          );
        }
      }
    };

    void loadListingForEdit();

    return () => {
      cancelled = true;
    };
  }, [isEditMode, listingId]);




  // ==========================================================================
  // SHARING HELPERS
  // ==========================================================================

  const addSharingOption = () => {
  setSharingPricing((current) => [
    ...current,
    {
      key: `new-${Date.now()}-${Math.random()}`,
      sharing_type: "2",
      ac_type: "Non-AC",
      floor: "",
      monthly_price: "",
      total_beds: "",
      available_beds: "",
      filled_beds: "",
      isConfirmed: false,
    },
  ]);
};

const removeSharingOption = (key: string) => {
  setSharingPricing((current) =>
    current.filter((item) => item.key !== key)
  );
};


const updateSharing = (
  key: string,
  field: keyof SharingPricing,
  value: string
) => {
  setSharingPricing((current) =>
    current.map((item) => {
      if (item.key !== key) return item;

      const updated = { ...item, [field]: value };

      // Calculate Available Beds automatically.
      if (field === "total_beds" || field === "filled_beds") {
        const total = Number(
          field === "total_beds" ? value : item.total_beds
        );
        const filled = Number(
          field === "filled_beds" ? value : item.filled_beds
        );

        updated.available_beds =
          updated.total_beds.trim() !== "" &&
          updated.filled_beds.trim() !== "" &&
          Number.isInteger(total) &&
          Number.isInteger(filled) &&
          total >= 0 &&
          filled >= 0 &&
          filled <= total
            ? String(total - filled)
            : "";
      }

      // Editing a confirmed option makes it a draft again.
      updated.isConfirmed = false;

      return updated;
    })
  );
};




const confirmSharingOption = (item: SharingPricing) => {
  const total = Number(item.total_beds);
  const filled = Number(item.filled_beds);
  const price = Number(item.monthly_price);

  if (!item.monthly_price.trim() || !Number.isFinite(price) || price <= 0) {
    Alert.alert("Monthly amount required", "Enter a valid monthly amount.");
    return;
  }

  if (
    !item.total_beds.trim() ||
    !item.filled_beds.trim() ||
    !Number.isInteger(total) ||
    !Number.isInteger(filled) ||
    total <= 0 ||
    filled < 0 ||
    filled > total
  ) {
    Alert.alert(
      "Invalid bed counts",
      "Total beds must be greater than zero, and filled beds must be between zero and total beds."
    );
    return;
  }

  setSharingPricing((current) =>
    current.map((option) =>
      option.key === item.key
        ? {
            ...option,
            available_beds: String(total - filled),
            isConfirmed: true,
          }
        : option
    )
  );
};




  // ==========================================================================
  // VALIDATION

  // ==========================================================================



  const validate = (): [string, string] | null => {

    if (!propertyName.trim()) {

      return ["Property name required", "Please enter your PG or hostel name."];

    }



    if (ownerPhone.trim() && ownerPhone.trim().length !== 10) {

      return [

        "Invalid phone number",

        "Please enter a valid 10-digit phone number, or leave it empty.",

      ];

    }




    const confirmedSharing = sharingPricing.filter((item) => item.isConfirmed);

    if (confirmedSharing.length === 0) {
      return [
        "Sharing option required",
        "Please complete and confirm at least one sharing option using the Done button.",
      ];
    }

    for (const item of confirmedSharing) {
      const total = Number(item.total_beds);
      const available = Number(item.available_beds);
      const filled = Number(item.filled_beds);
      const price = Number(item.monthly_price);

      if (!item.monthly_price.trim() || price <= 0) {
        return [
          `${item.sharing_type} monthly price required`,
          `Please enter the monthly amount for ${item.sharing_type} sharing.`,
        ];
      }

      if (!item.total_beds.trim() || total <= 0) {
        return [
          `${item.sharing_type} total beds required`,
          `Please enter total beds for ${item.sharing_type} sharing.`,
        ];
      }

      if (!item.available_beds.trim()) {
        return [
          `${item.sharing_type} available beds required`,
          `Please enter available beds for ${item.sharing_type} sharing.`,
        ];
      }

      if (!item.filled_beds.trim()) {
        return [
          `${item.sharing_type} filled beds required`,
          `Please enter filled beds for ${item.sharing_type} sharing.`,
        ];
      }

      if (available > total) {
        return [
          `Invalid ${item.sharing_type} available beds`,
          `Available beds cannot be greater than total beds for ${item.sharing_type} sharing.`,
        ];
      }

      if (filled > total) {
        return [
          `Invalid ${item.sharing_type} filled beds`,
          `Filled beds cannot be greater than total beds for ${item.sharing_type} sharing.`,
        ];
      }

      if (available + filled !== total) {
        return [
          `Invalid ${item.sharing_type} bed count`,
          `${item.sharing_type}: available beds + filled beds must equal total beds.`,
        ];
      }
    }

    if (foodAvailable === "Yes") {

      const meals = [

        { name: "Breakfast", start: breakfastStart, end: breakfastEnd },

        { name: "Lunch", start: lunchStart, end: lunchEnd },

        { name: "Dinner", start: dinnerStart, end: dinnerEnd },

      ];



      for (const meal of meals) {

        if (Boolean(meal.start) !== Boolean(meal.end)) {

          return [

            `${meal.name} timing incomplete`,

            `Please select both the start and end time for ${meal.name.toLowerCase()}.`,

          ];

        }



        if (meal.start && meal.end) {

          const startMinutes = toMinutes(meal.start);

          const endMinutes = toMinutes(meal.end);



          if (

            startMinutes !== null &&

            endMinutes !== null &&

            endMinutes <= startMinutes

          ) {

            return [

              `Invalid ${meal.name.toLowerCase()} timing`,

              `${meal.name} end time must be later than the start time.`,

            ];

          }

        }

      }



      if (!meals.some((meal) => meal.start && meal.end)) {

        return [

          "Food timings required",

          "Please add the timing for at least one meal.",

        ];

      }

    }



    if (!city.trim()) return ["City required", "Please enter the city."];

    if (!area.trim()) return ["Area required", "Please enter the area."];



    if (!address.trim()) {

      return ["Address required", "Please enter the complete address."];

    }



    if (latitude === null || longitude === null) {

      return [

        "Property location required",

        "Please use your current location or select the exact property location on the map.",

      ];

    }



    return null;

  };



  // ==========================================================================

  // CREATE LISTING

  // ==========================================================================



  const handleCreateListing = async () => {

    if (isCreating) return;



    const error = validate();



    if (error) {

      Alert.alert(error[0], error[1]);

      return;

    }



    setIsCreating(true);



    const withFood = foodAvailable === "Yes";



    const payload = {

      owner_phone: ownerPhone.trim(),



      name: propertyName.trim(),

      property_type: propertyType,

      gender,

      description: "",



      security_deposit: securityDeposit.trim() ? Number(securityDeposit) : 0,

      sharing: sharingPricing.filter((item) => item.isConfirmed).map((item) => ({
  ...(item.id ? { id: item.id } : {}),
  sharing_type: item.sharing_type,
  ac_type: item.ac_type,
  floor: item.floor?.trim() || null,
  monthly_price: Number(item.monthly_price),
  total_beds: Number(item.total_beds),
  available_beds: Number(item.available_beds),
  filled_beds: Number(item.filled_beds),
})),

      ac_type: acType,

      facilities,



      food_available: foodAvailable,

      food_type: withFood ? foodType : null,

      breakfast_start_time: withFood ? breakfastStart || null : null,

      breakfast_end_time: withFood ? breakfastEnd || null : null,



      lunch_start_time: withFood ? lunchStart || null : null,

      lunch_end_time: withFood ? lunchEnd || null : null,



      dinner_start_time: withFood ? dinnerStart || null : null,

      dinner_end_time: withFood ? dinnerEnd || null : null,



      city: city.trim(),

      area: area.trim(),

      address: address.trim(),



      // FastAPI schema expects strings.

      latitude: latitude !== null ? String(latitude) : null,

      longitude: longitude !== null ? String(longitude) : null,



      restrictions: restrictions.trim() || null,

    };



    try {

      if (__DEV__) {

        console.log("POST", `${API_BASE_URL}${CREATE_LISTING_PATH}`);

        console.log("PAYLOAD:", JSON.stringify(payload, null, 2));

      }



      
      const url = isEditMode
        ? `${API_BASE_URL}/api/v1/owner/listings/${encodeURIComponent(String(listingId))}`
        : `${API_BASE_URL}${CREATE_LISTING_PATH}`;

      const response = await ownerFetch(
        isEditMode
          ? `/api/v1/owner/listings/${encodeURIComponent(String(listingId))}`
          : CREATE_LISTING_PATH,
        {
        method: isEditMode ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      
      if (!response.ok) {
        throw new Error(
          data?.detail ||
            (isEditMode
              ? "Failed to update property."
              : "Failed to create property.")
        );
      }

      if (isEditMode) {
        router.replace({
          pathname: "/(owner)/listings/listing-details",
          params: { listingId: String(listingId) },
        });
        return;
      }

      if (data?.id === undefined || data?.id === null) {
        throw new Error(
          "Property was created, but the server did not return its ID."
        );
      }

      router.push({
        pathname: "/(owner)/listings/photos",
        params: { listingId: String(data.id) },
      });


    } catch (err: unknown) {

      console.warn("Create listing error:", getErrorMessage(err, "Unknown error"));



      let title = "Could not create listing";

      let message = getErrorMessage(

        err,

        "Something went wrong while creating the listing."

      );



      if (

        err instanceof ApiError &&

        (err.kind === "network" || err.kind === "timeout")

      ) {

        title = "Cannot connect to server";

        message +=

          "\n\nPlease check:\n" +

          "• FastAPI is running with --host 0.0.0.0\n" +

          "• Phone and PC are on the same Wi-Fi\n" +

          "• Windows Firewall allows port 8000\n" +

          "• Your PC's IP has not changed";

      }



      Alert.alert(title, message);

    } finally {

      setIsCreating(false);

    }

  };



  // ==========================================================================

  // LOCATION

  // ==========================================================================



  /** Best-effort: pre-fills EMPTY city/area/address. Never blocks anything. */

  const fillAddressFromCoords = async (lat: number, lng: number) => {

    try {

      const [place] = await Location.reverseGeocodeAsync({

        latitude: lat,

        longitude: lng,

      });



      if (!place) return;



      if (!city.trim()) setCity(place.city || place.subregion || "");



      if (!area.trim()) {

        setArea(place.district || place.subregion || place.name || "");

      }



      if (!address.trim()) {

        setAddress(

          [place.name, place.street, place.district, place.city, place.postalCode]

            .filter(Boolean)

            .join(", ")

        );

      }

    } catch {

      // ignore reverse geocoding failures

    }

  };



  const handleUseCurrentLocation = async () => {
    if (isGettingLocation) return;

    try {
      setIsGettingLocation(true);

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Location permission required",
          "Please allow location permission so we can save your property location."
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const nextLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      setSelectedLocation(nextLocation);
      setLatitude(nextLocation.latitude);
      setLongitude(nextLocation.longitude);
      setMapRegion({
        ...nextLocation,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      mapRef.current?.animateToRegion(
        {
          ...nextLocation,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500
      );

      await fillAddressFromCoords(nextLocation.latitude, nextLocation.longitude);
    } catch (err: unknown) {
      console.warn("Location error:", getErrorMessage(err, "Unknown error"));

      Alert.alert(
        "Unable to get location",
        "Please make sure your phone's location/GPS is turned on and try again."
      );
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleMapLocationSelected = async (coordinate: LocationCoordinate) => {
    setSelectedLocation(coordinate);
    setMapRegion({
      ...coordinate,
      latitudeDelta: 0.008,
      longitudeDelta: 0.008,
    });

    await fillAddressFromCoords(coordinate.latitude, coordinate.longitude);
  };

  const openLocationPicker = () => {
    if (latitude !== null && longitude !== null) {
      const current = { latitude, longitude };

      setSelectedLocation(current);
      setMapRegion({
        ...current,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } else {
      setSelectedLocation(null);
    }

    setShowLocationPicker(true);
  };

  const fetchPlaceSuggestions = async (query: string) => {
    const trimmed = query.trim();

    if (trimmed.length < 3) {
      setPlaceSuggestions([]);
      setIsFetchingSuggestions(false);
      return;
    }

    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY?.trim();
    const requestId = ++autocompleteRequestIdRef.current;

    if (!apiKey) {
      console.warn("Google Places API key missing; EXPO_PUBLIC_GOOGLE_PLACES_API_KEY is not configured.");
      if (requestId === autocompleteRequestIdRef.current) {
        setPlaceSuggestions([]);
        setIsFetchingSuggestions(false);
      }
      Alert.alert(
        "Google Places unavailable",
        "Add EXPO_PUBLIC_GOOGLE_PLACES_API_KEY to the client .env file and restart Expo before searching by place name."
      );
      return;
    }

    setIsFetchingSuggestions(true);

    try {
      const response = await fetch(
        "https://places.googleapis.com/v1/places:autocomplete",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask":
              "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
          },
          body: JSON.stringify({
            input: trimmed,
            languageCode: "en",
            regionCode: "IN",
            locationBias: {
              circle: {
                center: { latitude: 17.385, longitude: 78.4867 },
                radius: 2000000,
              },
            },
            includedPrimaryTypes: [
              "establishment",
              "lodging",
              "apartment_building",
              "campground",
              "locality",
              "neighborhood",
              "street_address",
              "subpremise",
            ],
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Places autocomplete failed with ${response.status}${errorText ? `: ${errorText.slice(0, 300)}` : ""}`
        );
      }

      const data = await response.json();
      const suggestions = (data?.suggestions ?? [])
        .map((item: any) => parseGooglePlaceSuggestion(item?.placePrediction ?? item))
        .filter(Boolean) as GooglePlaceSuggestion[];

      if (requestId !== autocompleteRequestIdRef.current) return;

      setPlaceSuggestions(suggestions);
      setLocationSearch(trimmed);
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Google Places autocomplete failed");
      console.warn("Places autocomplete error:", message);

      if (requestId === autocompleteRequestIdRef.current) {
        setPlaceSuggestions([]);
        Alert.alert("Search unavailable", message);
      }
    } finally {
      if (requestId === autocompleteRequestIdRef.current) {
        setIsFetchingSuggestions(false);
      }
    }
  };

  const handleSearchPropertyLocation = async () => {
    const query = locationSearch.trim();

    if (!query) {
      Alert.alert(
        "Enter a location",
        "Please enter a property address, area, or city to search."
      );
      return;
    }

    if (isSearchingLocation) return;

    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY?.trim();

    if (apiKey) {
      const requestId = ++autocompleteRequestIdRef.current;
      setIsSearchingLocation(true);

      try {
        const response = await fetch(
          "https://places.googleapis.com/v1/places:autocomplete",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": apiKey,
              "X-Goog-FieldMask":
                "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
            },
            body: JSON.stringify({
              input: query,
              languageCode: "en",
              regionCode: "IN",
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Places autocomplete failed with ${response.status}${errorText ? `: ${errorText.slice(0, 300)}` : ""}`
          );
        }

        const data = await response.json();
        const suggestions = (data?.suggestions ?? [])
          .map((item: any) => parseGooglePlaceSuggestion(item?.placePrediction ?? item))
          .filter(Boolean) as GooglePlaceSuggestion[];

        if (requestId !== autocompleteRequestIdRef.current) return;

        if (suggestions.length === 0) {
          setPlaceSuggestions([]);
          Alert.alert(
            "Location not found",
            "We couldn't find that location. Try a more specific address or area."
          );
          return;
        }

        const firstSuggestion = suggestions[0];
        setPlaceSuggestions(suggestions);
        await handleSelectSuggestedPlace(firstSuggestion);
      } catch (error: unknown) {
        const message = getErrorMessage(error, "Unknown error");
        console.warn("Location search error:", message);

        Alert.alert(
          "Search failed",
          `Unable to search this location. ${message}`
        );
      } finally {
        if (requestId === autocompleteRequestIdRef.current) {
          setIsSearchingLocation(false);
        }
      }

      return;
    }

    Alert.alert(
      "Google Places unavailable",
      "Add EXPO_PUBLIC_GOOGLE_PLACES_API_KEY to the client .env file and restart Expo before searching by place name."
    );

    try {
      setIsSearchingLocation(true);

      const results = await Location.geocodeAsync(query);

      if (!results.length) {
        Alert.alert(
          "Location not found",
          "We couldn't find that location. Try a more specific address or area."
        );
        return;
      }

      const { latitude: lat, longitude: lng } = results[0];
      const nextLocation = { latitude: lat, longitude: lng };

      setSelectedLocation(nextLocation);
      setMapRegion({
        ...nextLocation,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      mapRef.current?.animateToRegion(
        {
          ...nextLocation,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500
      );
    } catch (err: unknown) {
      console.warn("Location search error:", getErrorMessage(err, "Unknown error"));

      Alert.alert(
        "Search failed",
        "Unable to search this location. Please try again."
      );
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const handleSelectSuggestedPlace = async (suggestion: GooglePlaceSuggestion) => {
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY?.trim();
    if (!apiKey) {
      setLocationSearch(suggestion.formattedAddress || suggestion.mainText);
      setPlaceSuggestions([]);
      return;
    }

    const requestId = ++placeDetailRequestIdRef.current;
    setIsFetchingPlaceDetails(true);
    setIsSearchingLocation(true);
    setPlaceSuggestions([]);

    try {
      const response = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(suggestion.placeId)}?fields=id,displayName,formattedAddress,addressComponents,location&key=${encodeURIComponent(apiKey)}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Place details failed with ${response.status}`);
      }

      const data = await response.json();
      const latitude = Number(data?.location?.latitude);
      const longitude = Number(data?.location?.longitude);

      if (requestId !== placeDetailRequestIdRef.current) return;

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error("Selected place has no valid coordinates");
      }

      const formattedAddress =
        normalizePlaceText(data?.formattedAddress) ||
        suggestion.formattedAddress ||
        suggestion.mainText;

      const nextLocation = { latitude, longitude };
      const { city: derivedCity, area: derivedArea } = getCityAndAreaFromAddress(formattedAddress);

      setSelectedLocation(nextLocation);
      setLatitude(latitude);
      setLongitude(longitude);
      setLocationSearch(formattedAddress);
      setAddress(formattedAddress);

      const placeCity =
        data?.addressComponents?.find((component: any) =>
          component?.types?.includes("locality")
        )?.longText ??
        data?.addressComponents?.find((component: any) =>
          component?.types?.includes("administrative_area_level_2")
        )?.longText ??
        derivedCity;

      const placeArea =
        data?.addressComponents?.find((component: any) =>
          component?.types?.includes("sublocality") ||
          component?.types?.includes("neighborhood") ||
          component?.types?.includes("sublocality_level_1")
        )?.longText ??
        data?.addressComponents?.find((component: any) =>
          component?.types?.includes("administrative_area_level_1")
        )?.longText ??
        derivedArea;

      if (!city.trim()) {
        setCity(placeCity || "");
      }
      if (!area.trim()) {
        setArea(placeArea || "");
      }

      setMapRegion({
        ...nextLocation,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      });
      mapRef.current?.animateToRegion(
        {
          ...nextLocation,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        },
        500
      );
    } catch (error: unknown) {
      if (requestId !== placeDetailRequestIdRef.current) return;

      console.warn(
        "Place details error:",
        getErrorMessage(error, "Google Places details failed")
      );

      Alert.alert(
        "Location details unavailable",
        "We could not load the selected place. You can still adjust the marker manually on the map."
      );
    } finally {
      if (requestId === placeDetailRequestIdRef.current) {
        setIsFetchingPlaceDetails(false);
        setIsSearchingLocation(false);
      }
    }
  };

  const handleConfirmPropertyLocation = async () => {
    if (!selectedLocation) {
      Alert.alert(
        "Select a location",
        "Please search for the property or tap on the map to select its location."
      );
      return;
    }

    const { latitude: lat, longitude: lng } = selectedLocation;

    setLatitude(lat);
    setLongitude(lng);
    setShowLocationPicker(false);

    if (!city.trim()) {
      await fillAddressFromCoords(lat, lng);
    }
  };


  const handleOpenGoogleMaps = async () => {

    if (latitude === null || longitude === null) {

      Alert.alert("Location required", "Please add the property location first.");

      return;

    }



    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;



    try {

      await Linking.openURL(url);

    } catch {

      Alert.alert(

        "Unable to open Google Maps",

        "Please make sure Google Maps or a browser is available on your device."

      );

    }

  };



  // ==========================================================================

  // UI

  // ==========================================================================



  return (

    <SafeAreaView className="flex-1 bg-[#F5F9FD]">

      <KeyboardAvoidingView

        style={{ flex: 1 }}

        behavior={Platform.OS === "ios" ? "padding" : undefined}

      >

        {/* HEADER */}



        <View className="border-b border-[#E8EEF5] bg-[#F5F9FD] px-5 pb-4 pt-4">

          <View className="flex-row items-center">

            <Pressable

              disabled={isCreating}

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



            <View className="flex-1">

              <Text className="text-[25px] font-extrabold text-[#0F172A]">

                {isEditMode ? "Edit Property" : "Add Property"}

              </Text>



              <Text className="mt-1 text-[12px] text-[#64748B]">

                Add details about your PG or hostel

              </Text>

            </View>

          </View>

        </View>



        <ScrollView

          showsVerticalScrollIndicator={false}

          keyboardShouldPersistTaps="handled"

          contentContainerStyle={{

            paddingHorizontal: 20,

            paddingTop: 18,

            paddingBottom: 50,

          }}

        >

          {/* 1. BASIC DETAILS */}



          <SectionHeader

            number="1"

            title="Basic Details"

          />



          <Card>

            <Field

              label="Property Name"

              required

              value={propertyName}

              onChangeText={setPropertyName}

              placeholder="e.g. Sri Sai Boy's"

            />



            <FieldLabel label="Property Type" required marginTop />



            <View className="flex-row">

              {(["PG", "Hostel"] as PropertyType[]).map((item) => (

                <OptionButton

                  key={item}

                  label={item}

                  selected={propertyType === item}

                  onPress={() => setPropertyType(item)}

                />

              ))}

            </View>



            <FieldLabel label="For" required marginTop />



            <View className="flex-row flex-wrap">

              {GENDER_OPTIONS.map((item) => (

                <OptionButton

                  key={item}

                  label={item}

                  selected={gender === item}

                  onPress={() => setGender(item)}

                />

              ))}

            </View>




            <Field

              label="Owner Phone Number"

              marginTop

              numeric

              maxLength={10}

              value={ownerPhone}

              onChangeText={setOwnerPhone}

              placeholder="e.g. 9876543210"

            />

          </Card>



          {/* 2. PRICING */}

          <SectionHeader
            number="2"
            title="Pricing"
          />

          <Card>
            <Field
              label="Security Deposit (₹)"
              numeric
              value={securityDeposit}
              onChangeText={setSecurityDeposit}
              placeholder="8000"
            />
          </Card>

          {/* 3. CAPACITY & SHARING */}

          <SectionHeader
            number="3"
            title="Sharing & Pricing"
          />

          <Card>
            <FieldLabel label="Sharing Options" required />

          <Pressable
            onPress={addSharingOption}
            className="mb-2 items-center rounded-[14px] bg-[#2563EB] px-4 py-3"
          >
            <Text className="text-[13px] font-extrabold text-white">
              + Add Sharing Option
            </Text>
          </Pressable>

          {sharingPricing.length === 0 && (
            <View className="mt-3 rounded-[14px] bg-[#FFF7ED] p-3">
              <Text className="text-[12px] font-bold text-[#9A3412]">
                Add at least one sharing option.
              </Text>
            </View>
          )}

          {sharingPricing.map((item, index) => (
            <View
              key={item.key}
              className="mt-4 rounded-[18px] bg-[#F8FAFC] p-4"
              style={{ borderWidth: 1, borderColor: "#E2E8F0" }}
            >
              {item.isConfirmed ? (
                <>
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-3">
                      <Text className="text-[15px] font-extrabold text-[#0F172A]">
                        {item.sharing_type} Sharing · {item.ac_type}
                      </Text>
                      <Text className="mt-1 text-[12px] font-bold text-[#15803D]">
                        ✓ Confirmed
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <Pressable
                        onPress={() =>
                          setSharingPricing((current) =>
                            current.map((option) =>
                              option.key === item.key
                                ? { ...option, isConfirmed: false }
                                : option
                            )
                          )
                        }
                        className="mr-4"
                      >
                        <Text className="text-[12px] font-bold text-[#2563EB]">Edit</Text>
                      </Pressable>
                      <Pressable onPress={() => removeSharingOption(item.key)}>
                        <Text className="text-[12px] font-bold text-[#DC2626]">Remove</Text>
                      </Pressable>
                    </View>
                  </View>

                  <View className="mt-3 rounded-[14px] bg-white p-3">
                    <Text className="text-[13px] font-bold text-[#334155]">
                      Monthly amount: ₹{item.monthly_price}
                    </Text>
                    <Text className="mt-2 text-[12px] text-[#475569]">
                      Total beds: {item.total_beds}  ·  Filled: {item.filled_beds}  ·  Available: {item.available_beds}
                    </Text>
                    {item.floor.trim() ? (
                      <Text className="mt-2 text-[12px] text-[#475569]">Floor: {item.floor}</Text>
                    ) : null}
                  </View>
                </>
              ) : (
                <>
                  <View className="mb-3 flex-row items-center justify-between">
                    <Text className="text-[15px] font-extrabold text-[#0F172A]">
                      Sharing Option {index + 1}
                    </Text>
                    <Pressable onPress={() => removeSharingOption(item.key)}>
                      <Text className="text-[12px] font-bold text-[#DC2626]">Remove</Text>
                    </Pressable>
                  </View>

                  <FieldLabel label="Sharing Type" required />
                  <View className="flex-row flex-wrap">
                    {SHARING_OPTIONS.map((type) => (
                      <OptionButton
                        key={type}
                        label={`${type} Sharing`}
                        selected={item.sharing_type === type}
                        onPress={() => updateSharing(item.key, "sharing_type", type)}
                      />
                    ))}
                  </View>

                  <FieldLabel label="AC Type" required marginTop />
                  <View className="flex-row flex-wrap">
                    {(["AC", "Non-AC"] as ACType[]).map((type) => (
                      <OptionButton
                        key={type}
                        label={type}
                        selected={item.ac_type === type}
                        onPress={() => updateSharing(item.key, "ac_type", type)}
                      />
                    ))}
                  </View>

                  <View className="mt-3">
                    <Field
                      label="Floor"
                      value={item.floor}
                      onChangeText={(value) => updateSharing(item.key, "floor", value)}
                      placeholder="e.g. Ground Floor, 1st Floor"
                    />
                  </View>

                  <View className="mt-3">
                    <Field
                      label="Monthly Amount (₹)"
                      required
                      numeric
                      value={item.monthly_price}
                      onChangeText={(value) => updateSharing(item.key, "monthly_price", value)}
                      placeholder="10000"
                    />
                  </View>

                  <View className="mt-3 flex-row">
                    <View className="mr-3 flex-1">
                      <Field
                        label="Total Beds"
                        required
                        numeric
                        value={item.total_beds}
                        onChangeText={(value) => updateSharing(item.key, "total_beds", value)}
                        placeholder="10"
                      />
                    </View>
                    <View className="flex-1">
                      <FieldLabel label="Available Beds" required />
                      <View className="mt-0 justify-center rounded-[15px] bg-[#EFF6FF] px-4" style={{ height: 50, borderWidth: 1, borderColor: "#BFDBFE" }}>
                        <Text className="text-[14px] font-bold text-[#1D4ED8]">
                          {item.available_beds || "—"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View className="mt-3">
                    <Field
                      label="Filled Beds"
                      required
                      numeric
                      value={item.filled_beds}
                      onChangeText={(value) => updateSharing(item.key, "filled_beds", value)}
                      placeholder="7"
                    />
                  </View>

                  <View className="mt-3 rounded-[13px] bg-[#EFF6FF] p-3">
                    <Text className="text-[12px] font-bold text-[#1E40AF]">
                      {item.available_beds || "—"} available + {item.filled_beds || "—"} filled = {item.total_beds || "—"} total
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => confirmSharingOption(item)}
                    className="mt-4 items-center rounded-[14px] bg-[#15803D] px-4 py-3"
                  >
                    <Text className="text-[13px] font-extrabold text-white">
                      ✓ Done — Confirm Sharing Option
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          ))}
          </Card>

          {/* 4. FACILITIES */}



          <SectionHeader

            number="4"

            title="Facilities"
          />



          <Card>

            <View className="flex-row flex-wrap">

              {FACILITIES.map((item) => (

                <OptionButton

                  key={item}

                  label={item}

                  selected={facilities.includes(item)}

                  onPress={() =>

                    setFacilities((prev) => toggleInList(prev, item))

                  }

                />

              ))}

            </View>

          </Card>



          {/* 5. FOOD */}



          <SectionHeader

            number="5"

            title="Food"
          />



          <Card>

            <FieldLabel label="Food Available" />



            <View className="flex-row">

              {(["Yes", "No"] as YesNo[]).map((item) => (

                <OptionButton

                  key={item}

                  label={item}

                  selected={foodAvailable === item}

                  onPress={() => {

                    setFoodAvailable(item);



                    if (item === "No") {

                      setFoodType("Veg");

                      setBreakfastStart("");

                      setBreakfastEnd("");

                      setLunchStart("");

                      setLunchEnd("");

                      setDinnerStart("");

                      setDinnerEnd("");

                    }

                  }}

                />

              ))}

            </View>



            {foodAvailable === "Yes" && (

              <>

                <FieldLabel label="Food Type" marginTop />



                <View className="flex-row flex-wrap">

                  {FOOD_TYPES.map((item) => (

                    <OptionButton

                      key={item}

                      label={item}

                      selected={foodType === item}

                      onPress={() => setFoodType(item)}

                    />

                  ))}

                </View>



                <MealTiming

                  icon="🍳"

                  title="Breakfast"

                  start={breakfastStart}

                  end={breakfastEnd}

                  onStartChange={setBreakfastStart}

                  onEndChange={setBreakfastEnd}

                  defaultStart="8:00 AM"

                  defaultEnd="10:00 AM"

                />



                <MealTiming

                  icon="🍛"

                  title="Lunch"

                  start={lunchStart}

                  end={lunchEnd}

                  onStartChange={setLunchStart}

                  onEndChange={setLunchEnd}

                  defaultStart="1:00 PM"

                  defaultEnd="3:00 PM"

                />



                <MealTiming

                  icon="🌙"

                  title="Dinner"

                  start={dinnerStart}

                  end={dinnerEnd}

                  onStartChange={setDinnerStart}

                  onEndChange={setDinnerEnd}

                  defaultStart="8:00 PM"

                  defaultEnd="10:00 PM"

                />



                <Text className="mt-1 text-[11px] leading-5 text-[#64748B]">

                  Add at least one meal. Leave a meal empty if it is not served.

                </Text>

              </>

            )}

          </Card>



          {/* 6. LOCATION */}



          <SectionHeader

            number="6"

            title="Location"

          />



          <Card>

            <Field

              label="City"

              required

              value={city}

              onChangeText={setCity}

              placeholder="e.g. Hyderabad"

            />



            <Field

              label="Area"

              required

              marginTop

              value={area}

              onChangeText={setArea}

              placeholder="e.g. Ramanthapur"

            />



            <Field

              label="Full Address"

              required

              marginTop

              multiline

              minHeight={90}

              value={address}

              onChangeText={setAddress}

              placeholder="Enter complete property address"

            />



            <View className="mt-5">

              <Text className="text-[14px] font-extrabold text-[#0F172A]">

                Property Location <Text className="text-[#DC2626]">*</Text>

              </Text>

            </View>



            <Pressable

              onPress={handleUseCurrentLocation}

              disabled={isGettingLocation}

              className="mt-4 flex-row items-center justify-center rounded-[15px] bg-[#EFF6FF] px-4 py-4"

              style={{ borderWidth: 1, borderColor: "#BFDBFE" }}

            >

              {isGettingLocation ? (

                <ActivityIndicator size="small" color="#2563EB" />

              ) : (

                <Text className="text-[14px] font-extrabold text-[#2563EB]">

                  📍 Use My Current Location

                </Text>

              )}

            </Pressable>



            <View className="my-3 flex-row items-center">

              <View className="h-[1px] flex-1 bg-[#E2E8F0]" />

              <Text className="mx-3 text-[11px] font-bold text-[#94A3B8]">

                OR

              </Text>

              <View className="h-[1px] flex-1 bg-[#E2E8F0]" />

            </View>



            <Pressable

              onPress={openLocationPicker}

              className="flex-row items-center justify-center rounded-[15px] bg-[#F8FAFC] px-4 py-4"

              style={{ borderWidth: 1, borderColor: "#E2E8F0" }}

            >

              <Text className="text-[14px] font-extrabold text-[#334155]">

                🗺️ Select Property Location

              </Text>

            </Pressable>



            {latitude !== null && longitude !== null && (

              <View className="mt-4 rounded-[16px] bg-[#ECFDF5] p-4">

                <View className="flex-row items-center">

                  <View className="h-9 w-9 items-center justify-center rounded-full bg-[#D1FAE5]">

                    <Text className="text-[17px]">✓</Text>

                  </View>



                  <View className="ml-3 flex-1">

                    <Text className="text-[13px] font-extrabold text-[#065F46]">

                      Property location selected

                    </Text>



                    <Text className="mt-1 text-[11px] text-[#047857]">

                      {latitude.toFixed(6)}, {longitude.toFixed(6)}

                    </Text>

                  </View>

                </View>



                <Pressable

                  onPress={handleOpenGoogleMaps}

                  className="mt-3 rounded-[12px] bg-[#2563EB] px-4 py-3"

                >

                  <Text className="text-center text-[12px] font-extrabold text-white">

                    🗺️ Open in Google Maps

                  </Text>

                </Pressable>

              </View>

            )}

          </Card>



          {/* 7. RESTRICTIONS */}



          <SectionHeader

            number="7"

            title="Restrictions & Rules"

          />



          <Card>

            <Field

              label="Rules / Restrictions"

              multiline

              minHeight={110}

              value={restrictions}

              onChangeText={setRestrictions}

              placeholder="e.g. No smoking, no alcohol, entry after 10 PM..."

            />

          </Card>



          {/* 8. PHOTOS */}



          <SectionHeader

            number="8"

            title="Photos"

          />



          <Card>

            <View className="rounded-[16px] bg-[#EFF6FF] p-4">

              <Text className="text-[14px] font-extrabold text-[#1E3A8A]">

                Photos are added next

              </Text>


            </View>

          </Card>



          {/* SAVE */}



          <Pressable

            disabled={isCreating}

            onPress={handleCreateListing}

            className="mt-6 h-[56px] flex-row items-center justify-center rounded-[18px] bg-[#2563EB]"

            style={({ pressed }) => ({

              opacity: isCreating ? 0.7 : pressed ? 0.9 : 1,

              shadowColor: "#2563EB",

              shadowOffset: { width: 0, height: 4 },

              shadowOpacity: 0.2,

              shadowRadius: 8,

              elevation: 4,

            })}

          >

            {isCreating ? (

              <>

                <ActivityIndicator size="small" color="#FFFFFF" />



                <Text className="ml-3 text-[15px] font-extrabold text-white">

                  Creating Property...

                </Text>

              </>

            ) : (

              <Text className="text-[15px] font-extrabold text-white">

                {isEditMode ? "Update Property" : "Save & Continue to Photos"}

              </Text>

            )}

          </Pressable>



          <Text className="mt-3 px-4 text-center text-[11px] leading-5 text-[#64748B]">

            Your property will first be saved as a draft. You can add photos and

            review it before publishing.

          </Text>

        </ScrollView>

      </KeyboardAvoidingView>



      {/* ====================================================================

          LOCATION PICKER MODAL

      ==================================================================== */}



      <Modal

        visible={showLocationPicker}

        animationType="slide"

        presentationStyle="pageSheet"

        onRequestClose={() => setShowLocationPicker(false)}

      >

        <SafeAreaView className="flex-1 bg-[#F5F9FD]">

          <View className="border-b border-[#E8EEF5] bg-white px-5 py-4">

            <View className="flex-row items-center justify-between">

              <View className="flex-1">

                <Text className="text-[20px] font-extrabold text-[#0F172A]">

                  Select Property Location

                </Text>



                <Text className="mt-1 text-[11px] text-[#64748B]">

                  Search, tap the map, or drag the marker

                </Text>

              </View>



              <Pressable

                onPress={() => setShowLocationPicker(false)}

                className="ml-3 h-10 w-10 items-center justify-center rounded-full bg-[#F1F5F9]"

              >

                <Text className="text-[20px] font-bold text-[#334155]">×</Text>

              </Pressable>

            </View>



            <View className="mt-4">
              <View className="flex-row">
                <View className="flex-1 flex-row items-center rounded-[14px] bg-[#F8FAFC] px-3" style={{ height: 50, borderWidth: 1, borderColor: "#E2E8F0" }}>
                  <Text className="mr-2 text-[16px]">🔍</Text>
                  <TextInput
                    value={locationSearch}
                    onChangeText={(text) => {
                      setLocationSearch(text);

                      if (suggestionsDebounceRef.current) {
                        clearTimeout(suggestionsDebounceRef.current);
                      }

                      if (text.trim().length >= 3) {
                        suggestionsDebounceRef.current = setTimeout(() => {
                          void fetchPlaceSuggestions(text);
                        }, 350);
                      } else {
                        setPlaceSuggestions([]);
                        setIsFetchingSuggestions(false);
                      }
                    }}
                    placeholder="Search places, streets, landmarks..."
                    placeholderTextColor="#94A3B8"
                    returnKeyType="search"
                    onSubmitEditing={handleSearchPropertyLocation}
                    className="flex-1 text-[14px] text-[#0F172A]"
                    style={{ marginRight: locationSearch.trim() ? 8 : 0 }}
                  />
                  {locationSearch.trim() ? (
                    <Pressable
                      onPress={() => {
                        setLocationSearch("");
                        setPlaceSuggestions([]);
                        setIsFetchingSuggestions(false);
                        if (suggestionsDebounceRef.current) {
                          clearTimeout(suggestionsDebounceRef.current);
                        }
                      }}
                      className="ml-2 h-7 w-7 items-center justify-center rounded-full bg-[#E2E8F0]"
                    >
                      <Text className="text-[14px] font-bold text-[#475569]">×</Text>
                    </Pressable>
                  ) : null}
                </View>

                <Pressable
                  onPress={handleSearchPropertyLocation}
                  disabled={isSearchingLocation}
                  className="ml-2 h-[50px] w-[54px] items-center justify-center rounded-[14px] bg-[#2563EB]"
                >
                  {isSearchingLocation ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text className="text-[20px]">🔍</Text>
                  )}
                </Pressable>
              </View>

              {locationSearch.trim().length >= 3 && (
                <View className="mt-2 rounded-[14px] border border-[#E2E8F0] bg-white shadow-sm">
                  {isFetchingSuggestions && (
                    <View className="flex-row items-center px-4 py-3">
                      <ActivityIndicator size="small" color="#2563EB" />
                      <Text className="ml-2 text-[12px] font-medium text-[#475569]">
                        Loading nearby suggestions...
                      </Text>
                    </View>
                  )}

                  {!isFetchingSuggestions && placeSuggestions.length === 0 && (
                    <View className="px-4 py-3">
                      <Text className="text-[12px] text-[#64748B]">
                        No places found for this search.
                      </Text>
                    </View>
                  )}

                  {!isFetchingSuggestions &&
                    placeSuggestions.map((suggestion) => (
                      <Pressable
                        key={suggestion.placeId}
                        onPress={() => void handleSelectSuggestedPlace(suggestion)}
                        className="flex-row items-start border-t border-[#F1F5F9] px-4 py-3"
                      >
                        <View className="mt-0.5 mr-2 h-6 w-6 items-center justify-center rounded-full bg-[#EFF6FF]">
                          <Text className="text-[12px]">📍</Text>
                        </View>
                        <View className="flex-1">
                          <Text className="text-[13px] font-extrabold text-[#0F172A]">
                            {suggestion.mainText}
                          </Text>
                          <Text className="mt-1 text-[11px] text-[#64748B]">
                            {suggestion.secondaryText}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                </View>
              )}
            </View>

          </View>



          <View className="flex-1">

            <ListingLocationMap
              ref={mapRef}
              initialRegion={mapRegion}
              selectedLocation={selectedLocation}
              onLocationSelected={(coordinate) => {
                void handleMapLocationSelected(coordinate);
              }}
            />



            <View

              pointerEvents="none"

              className="absolute left-5 right-5 top-4 rounded-[14px] bg-white px-4 py-3"

              style={{

                shadowColor: "#0F172A",

                shadowOffset: { width: 0, height: 2 },

                shadowOpacity: 0.12,

                shadowRadius: 6,

                elevation: 3,

              }}

            >

              <Text className="text-center text-[12px] font-bold text-[#334155]">

                📍 Tap on the map to place the property marker

              </Text>

            </View>

          </View>



          <View className="border-t border-[#E8EEF5] bg-white px-5 pb-5 pt-4">

            {selectedLocation ? (

              <View className="mb-3 rounded-[14px] bg-[#F8FAFC] p-3">

                <Text className="text-[11px] font-bold text-[#64748B]">

                  Selected coordinates

                </Text>



                <Text className="mt-1 text-[13px] font-extrabold text-[#0F172A]">

                  {selectedLocation.latitude.toFixed(6)},{" "}

                  {selectedLocation.longitude.toFixed(6)}

                </Text>

              </View>

            ) : (

              <Text className="mb-3 text-center text-[12px] text-[#64748B]">

                Search for the property or tap the exact location on the map.

              </Text>

            )}



            <Pressable
              onPress={handleConfirmPropertyLocation}
              disabled={!selectedLocation || isFetchingPlaceDetails}
              className="h-[54px] items-center justify-center rounded-[16px] bg-[#2563EB]"
              style={{ opacity: selectedLocation && !isFetchingPlaceDetails ? 1 : 0.5 }}
            >
              {isFetchingPlaceDetails ? (
                <View className="flex-row items-center">
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text className="ml-2 text-[15px] font-extrabold text-white">
                    Loading place details...
                  </Text>
                </View>
              ) : (
                <Text className="text-[15px] font-extrabold text-white">
                  Confirm Property Location
                </Text>
              )}
            </Pressable>

          </View>

        </SafeAreaView>

      </Modal>

    </SafeAreaView>

  );

}



// ============================================================================

// REUSABLE COMPONENTS

// ============================================================================



function Card({ children }: { children: ReactNode }) {

  return <View className="rounded-[22px] bg-white p-5">{children}</View>;

}



function SectionHeader({

  number,

  title,

}: {

  number: string;

  title: string;

}) {

  return (

    <View className="mb-3 mt-5 flex-row items-center">

      <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-[#EAF2FF]">

        <Text className="text-[13px] font-extrabold text-[#2563EB]">

          {number}

        </Text>

      </View>



      <View className="flex-1">

        <Text className="text-[18px] font-extrabold text-[#0F172A]">

          {title}

        </Text>

      </View>

    </View>

  );

}



function FieldLabel({

  label,

  required = false,

  marginTop = false,

}: {

  label: string;

  required?: boolean;

  marginTop?: boolean;

}) {

  return (

    <View className={`flex-row items-center ${marginTop ? "mb-2 mt-5" : "mb-2"}`}>

      <Text className="text-[13px] font-bold text-[#334155]">{label}</Text>



      {required && (

        <Text className="ml-1 text-[13px] font-bold text-[#DC2626]">*</Text>

      )}

    </View>

  );

}



function Field({

  label,

  required,

  marginTop,

  value,

  onChangeText,

  placeholder,

  multiline,

  minHeight,

  numeric,

  maxLength,

}: {

  label: string;

  required?: boolean;

  marginTop?: boolean;

  value: string;

  onChangeText: (value: string) => void;

  placeholder: string;

  multiline?: boolean;

  minHeight?: number;

  numeric?: boolean;

  maxLength?: number;

}) {

  const keyboardType: KeyboardTypeOptions = numeric ? "number-pad" : "default";



  return (

    <View>

      <FieldLabel label={label} required={required} marginTop={marginTop} />



      <TextInput

        value={value}

        onChangeText={(text) =>

          onChangeText(numeric ? text.replace(/[^0-9]/g, "") : text)

        }

        placeholder={placeholder}

        placeholderTextColor="#94A3B8"

        keyboardType={keyboardType}

        maxLength={maxLength}

        multiline={multiline}

        textAlignVertical={multiline ? "top" : "center"}

        className={`rounded-[15px] bg-[#F8FAFC] px-4 text-[14px] text-[#0F172A] ${

          multiline ? "py-3" : ""

        }`}

        style={{

          ...(multiline ? { minHeight: minHeight ?? 90 } : { height: 50 }),

          borderWidth: 1,

          borderColor: "#E2E8F0",

        }}

      />

    </View>

  );

}



function OptionButton({

  label,

  selected,

  onPress,

}: {

  label: string;

  selected: boolean;

  onPress: () => void;

}) {

  return (

    <Pressable

      onPress={onPress}

      className={`mb-2 mr-2 rounded-full px-4 py-2.5 ${

        selected ? "bg-[#2563EB]" : "bg-[#F8FAFC]"

      }`}

      style={{

        borderWidth: 1,

        borderColor: selected ? "#2563EB" : "#E2E8F0",

      }}

    >

      <Text

        className={`text-[12px] font-bold ${

          selected ? "text-white" : "text-[#475569]"

        }`}

      >

        {selected ? "✓ " : ""}

        {label}

      </Text>

    </Pressable>

  );

}



// ----------------------------------------------------------------------------

// TIME PICKER FIELD

// ----------------------------------------------------------------------------



function TimeField({

  label,

  value,

  onChange,

  defaultTime,

}: {

  label: string;

  value: string;

  onChange: (value: string) => void;

  defaultTime: string;

}) {

  const [open, setOpen] = useState(false);

  const [draft, setDraft] = useState<Date>(new Date());



  const openPicker = () => {

    setDraft(parseTime(value) ?? parseTime(defaultTime) ?? new Date());

    setOpen(true);

  };



  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {

    if (Platform.OS === "android") {

      setOpen(false);



      if (event.type === "set" && selected) {

        onChange(formatTime(selected));

      }



      return;

    }



    if (selected) setDraft(selected);

  };



  return (

    <View className="flex-1">

      <Text className="mb-1.5 text-[11px] font-bold text-[#64748B]">

        {label}

      </Text>



      <Pressable

        onPress={openPicker}

        className="h-[48px] flex-row items-center justify-between rounded-[14px] bg-white px-3"

        style={{ borderWidth: 1, borderColor: value ? "#BFDBFE" : "#E2E8F0" }}

      >

        <Text

          className="text-[13px] font-bold"

          style={{ color: value ? "#0F172A" : "#94A3B8" }}

        >

          {value || "Select time"}

        </Text>



        <Text className="text-[14px]">🕒</Text>

      </Pressable>



      {/* Android: native dialog */}

      {open && Platform.OS === "android" && (

        <DateTimePicker

          value={draft}

          mode="time"

          is24Hour={false}

          onChange={handleChange}

        />

      )}



      {/* iOS: bottom sheet with spinner */}

      {Platform.OS === "ios" && (

        <Modal

          transparent

          visible={open}

          animationType="fade"

          onRequestClose={() => setOpen(false)}

        >

          <View className="flex-1 justify-end">

            <Pressable

              onPress={() => setOpen(false)}

              style={{

                position: "absolute",

                top: 0,

                left: 0,

                right: 0,

                bottom: 0,

                backgroundColor: "rgba(15,23,42,0.4)",

              }}

            />



            <View className="rounded-t-[24px] bg-white pb-8">

              <View className="flex-row items-center justify-between border-b border-[#E8EEF5] px-5 py-4">

                <Pressable onPress={() => setOpen(false)}>

                  <Text className="text-[15px] font-bold text-[#64748B]">

                    Cancel

                  </Text>

                </Pressable>



                <Text className="text-[15px] font-extrabold text-[#0F172A]">

                  {label} time

                </Text>



                <Pressable

                  onPress={() => {

                    onChange(formatTime(draft));

                    setOpen(false);

                  }}

                >

                  <Text className="text-[15px] font-extrabold text-[#2563EB]">

                    Done

                  </Text>

                </Pressable>

              </View>



              <DateTimePicker

                value={draft}

                mode="time"

                display="spinner"

                themeVariant="light"

                onChange={handleChange}

                style={{ height: 200 }}

              />

            </View>

          </View>

        </Modal>

      )}

    </View>

  );

}



function MealTiming({

  icon,

  title,

  start,

  end,

  onStartChange,

  onEndChange,

  defaultStart,

  defaultEnd,

}: {

  icon: string;

  title: string;

  start: string;

  end: string;

  onStartChange: (value: string) => void;

  onEndChange: (value: string) => void;

  defaultStart: string;

  defaultEnd: string;

}) {

  const hasAny = Boolean(start || end);



  return (

    <View

      className="mt-4 rounded-[18px] bg-[#F8FAFC] p-4"

      style={{ borderWidth: 1, borderColor: "#E2E8F0" }}

    >

      <View className="mb-3 flex-row items-center justify-between">

        <View className="flex-row items-center">

          <Text className="mr-2 text-[18px]">{icon}</Text>



          <Text className="text-[14px] font-extrabold text-[#0F172A]">

            {title}

          </Text>

        </View>



        {hasAny && (

          <Pressable

            onPress={() => {

              onStartChange("");

              onEndChange("");

            }}

          >

            <Text className="text-[12px] font-bold text-[#DC2626]">Clear</Text>

          </Pressable>

        )}

      </View>



      <View className="flex-row" style={{ columnGap: 12 }}>

        <TimeField

          label="Start"

          value={start}

          onChange={onStartChange}

          defaultTime={defaultStart}

        />



        <TimeField

          label="End"

          value={end}

          onChange={onEndChange}

          defaultTime={defaultEnd}

        />

      </View>

    </View>

  );

}