import { useCallback, useMemo, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
  KeyboardTypeOptions,
} from "react-native";

import { router } from "expo-router";
import * as Location from "expo-location";
import MapView, {
  Marker,
  Region,
} from "react-native-maps";

import {
  API_BASE_URL,
  ApiError,
  postJson,
} from "../../../constants/api";

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

type PropertyType = "PG" | "Hostel";
type GenderType = "Men's" | "Women's" | "Co-living";
type ACType = "AC" | "Non-AC";
type YesNo = "Yes" | "No";

const GENDER_OPTIONS: GenderType[] = [
  "Men's",
  "Women's",
  "Co-living",
];

const SHARING_OPTIONS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "10",
];

const FACILITIES = [
  "Wi-Fi",
  "Parking",
  "Laundry",
  "Attached Bathroom",
  "Power Backup",
  "CCTV",
];

const CREATE_LISTING_PATH = "/api/v1/owner/listings";

// ============================================================================
// HELPERS
// ============================================================================

function getErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error) {
    return error;
  }

  return fallback;
}

function toggleInList(
  list: string[],
  value: string
) {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

// ============================================================================
// SCREEN
// ============================================================================

export default function CreateListing() {
  // --------------------------------------------------------------------------
  // Basic
  // --------------------------------------------------------------------------

  const [propertyName, setPropertyName] = useState("");

  // Owner phone is only collected for now.
  // No OTP or validation is performed at this stage.
  const [ownerPhone, setOwnerPhone] = useState("");

  const [propertyType, setPropertyType] =
    useState<PropertyType>("PG");

  const [gender, setGender] =
    useState<GenderType>("Men's");

  const [description, setDescription] = useState("");

  // --------------------------------------------------------------------------
  // Pricing
  // --------------------------------------------------------------------------

  const [monthlyPrice, setMonthlyPrice] = useState("");
  const [securityDeposit, setSecurityDeposit] = useState("");

  // --------------------------------------------------------------------------
  // Beds
  // --------------------------------------------------------------------------

  const [totalBeds, setTotalBeds] = useState("");
  const [availableBeds, setAvailableBeds] = useState("");

  const [sharing, setSharing] = useState<string[]>([]);

  const [acType, setAcType] =
    useState<ACType>("Non-AC");

  // --------------------------------------------------------------------------
  // Facilities & food
  // --------------------------------------------------------------------------

  const [facilities, setFacilities] = useState<string[]>([]);

  const [foodAvailable, setFoodAvailable] =
    useState<YesNo>("No");

  const [breakfastTime, setBreakfastTime] =
    useState("");

  const [lunchTime, setLunchTime] =
    useState("");

  const [dinnerTime, setDinnerTime] =
    useState("");

  // --------------------------------------------------------------------------
  // Location
  // --------------------------------------------------------------------------

  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");

  const [latitude, setLatitude] =
    useState<number | null>(null);

  const [longitude, setLongitude] =
    useState<number | null>(null);

  const [isGettingLocation, setIsGettingLocation] =
    useState(false);
  

const [showLocationPicker, setShowLocationPicker] = useState(false);
const [locationSearch, setLocationSearch] = useState("");
const [isSearchingLocation, setIsSearchingLocation] = useState(false);

const [mapRegion, setMapRegion] = useState<Region>({
  latitude: 17.3850,
  longitude: 78.4867,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
});

const [selectedLocation, setSelectedLocation] = useState<{
  latitude: number;
  longitude: number;
} | null>(null);

  // --------------------------------------------------------------------------
  // Rules & loading
  // --------------------------------------------------------------------------

  const [restrictions, setRestrictions] =
    useState("");

  const [isCreating, setIsCreating] =
    useState(false);

  // --------------------------------------------------------------------------
  // Filled beds
  // --------------------------------------------------------------------------

  const filledBeds = useMemo(() => {
    const total = Number(totalBeds) || 0;
    const available = Number(availableBeds) || 0;

    return Math.max(total - available, 0);
  }, [totalBeds, availableBeds]);

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  const validate = useCallback(
    (): [string, string] | null => {
      if (!propertyName.trim()) {
        return [
          "Property name required",
          "Please enter your PG or hostel name.",
        ];
      }

      if (!description.trim()) {
        return [
          "Description required",
          "Please describe your PG or hostel.",
        ];
      }

      if (
        !monthlyPrice.trim() ||
        Number(monthlyPrice) <= 0
      ) {
        return [
          "Monthly price required",
          "Please enter a valid monthly price.",
        ];
      }

      const total = Number(totalBeds);
      const available = Number(availableBeds);

      if (!totalBeds.trim() || total <= 0) {
        return [
          "Total beds required",
          "Total beds must be greater than 0.",
        ];
      }

      if (!availableBeds.trim()) {
        return [
          "Available beds required",
          "Please enter the available beds.",
        ];
      }

      if (available > total) {
        return [
          "Invalid available beds",
          "Available beds cannot be greater than total beds.",
        ];
      }

      if (sharing.length === 0) {
        return [
          "Sharing option required",
          "Please select at least one sharing option.",
        ];
      }

      if (!city.trim()) {
        return [
          "City required",
          "Please enter the city.",
        ];
      }

      if (!area.trim()) {
        return [
          "Area required",
          "Please enter the area.",
        ];
      }

      if (!address.trim()) {
        return [
          "Address required",
          "Please enter the complete address.",
        ];
      }

      if (latitude === null || longitude === null) {
  return [
    "Property location required",
    "Please use your current location or select the exact property location on the map.",
  ];
}

      if (
        foodAvailable === "Yes" &&
        !breakfastTime.trim() &&
        !lunchTime.trim() &&
        !dinnerTime.trim()
      ) {
        return [
          "Food timings",
          "Please enter at least one food timing.",
        ];
      }

      return null;
    },
    [
      propertyName,
      description,
      monthlyPrice,
      totalBeds,
      availableBeds,
      sharing,
      city,
      area,
      address,
      latitude,
      longitude,
      foodAvailable,
      breakfastTime,
      lunchTime,
      dinnerTime,
    ]
  );

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
      // Owner phone is collected now only for identifying
      // duplicate properties. OTP will be added later.
      owner_phone: ownerPhone.trim() || null,

      name: propertyName.trim(),

      property_type: propertyType,

      gender,

      description: description.trim(),

      monthly_price: Number(monthlyPrice),

      security_deposit: securityDeposit.trim()
        ? Number(securityDeposit)
        : 0,

      total_beds: Number(totalBeds),

      available_beds: Number(availableBeds),

      filled_beds: filledBeds,

      sharing,

      ac_type: acType,

      facilities,

      food_available: foodAvailable,

      breakfast_time: withFood
        ? breakfastTime.trim() || null
        : null,

      lunch_time: withFood
        ? lunchTime.trim() || null
        : null,

      dinner_time: withFood
        ? dinnerTime.trim() || null
        : null,

      city: city.trim(),

      area: area.trim(),

      address: address.trim(),

      // FastAPI schema expects strings.
      latitude:
        latitude !== null
          ? String(latitude)
          : null,

      longitude:
        longitude !== null
          ? String(longitude)
          : null,

      restrictions:
        restrictions.trim() || null,
    };

    try {
      if (__DEV__) {
        console.log(
          "POST",
          `${API_BASE_URL}${CREATE_LISTING_PATH}`
        );

        console.log(
          "PAYLOAD:",
          JSON.stringify(payload, null, 2)
        );
      }

      const data = await postJson<{
        id?: number | string;
        status?: string;
      }>(
        CREATE_LISTING_PATH,
        payload
      );

      if (
        data?.id === undefined ||
        data?.id === null
      ) {
        throw new ApiError(
          "http",
          "The listing was created but the server did not return a listing ID."
        );
      }

      router.push({
        pathname: "/(owner)/listings/photos",
        params: {
          listingId: String(data.id),
        },
      });
    } catch (err: unknown) {
      console.warn(
        "Create listing error:",
        getErrorMessage(
          err,
          "Unknown error"
        )
      );

      let title = "Could not create listing";

      let message = getErrorMessage(
        err,
        "Something went wrong while creating the listing."
      );

      if (
        err instanceof ApiError &&
        (
          err.kind === "network" ||
          err.kind === "timeout"
        )
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
  // CURRENT LOCATION
  // ==========================================================================

  const handleUseCurrentLocation =
    async () => {
      if (isGettingLocation) return;

      try {
        setIsGettingLocation(true);

        const { status } =
          await Location.requestForegroundPermissionsAsync();

        if (status !== "granted") {
          Alert.alert(
            "Location permission required",
            "Please allow location permission so we can save your property location."
          );

          return;
        }

        const position =
          await Location.getCurrentPositionAsync(
            {
              accuracy: Location.Accuracy.High,
            }
          );

        const lat =
          position.coords.latitude;

        const lng =
          position.coords.longitude;

        setLatitude(lat);
        setLongitude(lng);

        // Best-effort reverse geocoding.
        // It never blocks saving.
        try {
          const [place] =
            await Location.reverseGeocodeAsync(
              {
                latitude: lat,
                longitude: lng,
              }
            );

          if (place) {
            if (!city.trim()) {
              setCity(
                place.city ||
                  place.subregion ||
                  ""
              );
            }

            if (!area.trim()) {
              setArea(
                place.district ||
                  place.subregion ||
                  place.name ||
                  ""
              );
            }

            if (!address.trim()) {
              setAddress(
                [
                  place.name,
                  place.street,
                  place.district,
                  place.city,
                  place.postalCode,
                ]
                  .filter(Boolean)
                  .join(", ")
              );
            }
          }
        } catch {
          // Ignore reverse geocoding failures.
        }

        Alert.alert(
          "Location added",
          `Latitude: ${lat.toFixed(
            6
          )}\nLongitude: ${lng.toFixed(6)}`
        );
      } catch (err: unknown) {
        console.warn(
          "Location error:",
          getErrorMessage(
            err,
            "Unknown error"
          )
        );

        Alert.alert(
          "Unable to get location",
          "Please make sure your phone's location/GPS is turned on and try again."
        );
      } finally {
        setIsGettingLocation(false);
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

    const result = results[0];

    const latitude = result.latitude;
    const longitude = result.longitude;

    setMapRegion({
      latitude,
      longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });

    setSelectedLocation({
      latitude,
      longitude,
    });
  } catch (error) {
    console.error("Property location search error:", error);

    Alert.alert(
      "Search failed",
      "Unable to search this location. Please try again."
    );
  } finally {
    setIsSearchingLocation(false);
  }
};


const handleMapPress = (event: any) => {
  const { latitude, longitude } = event.nativeEvent.coordinate;

  setSelectedLocation({
    latitude,
    longitude,
  });

  setMapRegion((previous) => ({
    ...previous,
    latitude,
    longitude,
  }));
};


const handleConfirmPropertyLocation = async () => {
  if (!selectedLocation) {
    Alert.alert(
      "Select a location",
      "Please search for the property or tap on the map to select its location."
    );
    return;
  }

  const { latitude, longitude } = selectedLocation;

  setLatitude(latitude);
  setLongitude(longitude);

  // Try to automatically fill address/city/area.
  try {
    const [place] = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });

    if (place) {
      if (!city.trim()) {
        setCity(place.city || place.subregion || "");
      }

      if (!area.trim()) {
        setArea(
          place.district ||
            place.subregion ||
            place.name ||
            ""
        );
      }

      if (!address.trim()) {
        setAddress(
          [
            place.name,
            place.street,
            place.district,
            place.city,
            place.postalCode,
          ]
            .filter(Boolean)
            .join(", ")
        );
      }
    }
  } catch (error) {
    console.warn(
      "Reverse geocoding failed:",
      error
    );
  }

  setShowLocationPicker(false);

  Alert.alert(
    "Property location selected",
    `Latitude: ${latitude.toFixed(
      6
    )}\nLongitude: ${longitude.toFixed(6)}`
  );
};

  // ==========================================================================
  // GOOGLE MAPS
  // ==========================================================================

  const handleOpenGoogleMaps =
    async () => {
      if (
        latitude === null ||
        longitude === null
      ) {
        Alert.alert(
          "Location required",
          "Please add the property location first."
        );

        return;
      }

      const url =
        `https://www.google.com/maps/search/?api=1` +
        `&query=${latitude},${longitude}`;

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
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        {/* HEADER */}

        <View className="border-b border-[#E8EEF5] bg-[#F5F9FD] px-5 pb-4 pt-4">
          <View className="flex-row items-center">
            <Pressable
              disabled={isCreating}
              onPress={() => router.back()}
              className="mr-3 h-11 w-11 items-center justify-center rounded-full bg-white"
              style={({ pressed }) => ({
                transform: [
                  {
                    scale: pressed
                      ? 0.94
                      : 1,
                  },
                ],
                shadowColor: "#64748B",
                shadowOffset: {
                  width: 0,
                  height: 2,
                },
                shadowOpacity: 0.08,
                shadowRadius: 6,
                elevation: 2,
              })}
            >
              <Text className="text-[24px] font-medium text-[#0F172A]">
                ‹
              </Text>
            </Pressable>

            <View className="flex-1">
              <Text className="text-[25px] font-extrabold text-[#0F172A]">
                Add Property
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
          {/* ================================================================
              1. BASIC DETAILS
          ================================================================ */}

          <SectionHeader
            number="1"
            title="Basic Details"
            description="Tell tenants about your property"
          />

          <Card>
            <Field
              label="Property Name"
              required
              value={propertyName}
              onChangeText={setPropertyName}
              placeholder="e.g. Sri Sai Boys PG"
            />

            <FieldLabel
              label="Property Type"
              required
              marginTop
            />

            <View className="flex-row">
              {(
                ["PG", "Hostel"] as PropertyType[]
              ).map((item) => (
                <OptionButton
                  key={item}
                  label={item}
                  selected={
                    propertyType === item
                  }
                  onPress={() =>
                    setPropertyType(item)
                  }
                />
              ))}
            </View>

            <FieldLabel
              label="For"
              required
              marginTop
            />

            <View className="flex-row flex-wrap">
              {GENDER_OPTIONS.map(
                (item) => (
                  <OptionButton
                    key={item}
                    label={item}
                    selected={
                      gender === item
                    }
                    onPress={() =>
                      setGender(item)
                    }
                  />
                )
              )}
            </View>

            <Field
              label="Description"
              required
              marginTop
              multiline
              minHeight={110}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your property, rooms and nearby facilities..."
            />

            {/* OWNER PHONE */}

            <Field
              label="Owner Phone Number"
              marginTop
              numeric
              value={ownerPhone}
              onChangeText={setOwnerPhone}
              placeholder="e.g. 9876543210"
            />

            <Text className="mt-2 text-[11px] leading-5 text-[#64748B]">
              Used to identify the owner and
              help verify duplicate properties.
              OTP verification will be added later.
            </Text>
          </Card>

          {/* ================================================================
              2. PRICING
          ================================================================ */}

          <SectionHeader
            number="2"
            title="Pricing"
            description="Set your monthly rent and deposit"
          />

          <Card>
            <View className="flex-row">
              <View className="mr-3 flex-1">
                <Field
                  label="Monthly Price (₹)"
                  required
                  numeric
                  value={monthlyPrice}
                  onChangeText={setMonthlyPrice}
                  placeholder="8000"
                />
              </View>

              <View className="flex-1">
                <Field
                  label="Security Deposit (₹)"
                  numeric
                  value={securityDeposit}
                  onChangeText={setSecurityDeposit}
                  placeholder="8000"
                />
              </View>
            </View>
          </Card>

          {/* ================================================================
              3. CAPACITY
          ================================================================ */}

          <SectionHeader
            number="3"
            title="Capacity & Sharing"
            description="Manage your beds and room sharing"
          />

          <Card>
            <View className="flex-row">
              <View className="mr-3 flex-1">
                <Field
                  label="Total Beds"
                  required
                  numeric
                  value={totalBeds}
                  onChangeText={setTotalBeds}
                  placeholder="20"
                />
              </View>

              <View className="flex-1">
                <Field
                  label="Available Beds"
                  required
                  numeric
                  value={availableBeds}
                  onChangeText={setAvailableBeds}
                  placeholder="8"
                />
              </View>
            </View>

            <View className="mt-3 rounded-[13px] bg-[#EFF6FF] p-3">
              <Text className="text-[12px] font-bold text-[#1E40AF]">
                Filled beds: {filledBeds}
              </Text>

              <Text className="mt-1 text-[11px] leading-5 text-[#1E40AF]">
                Calculated automatically as
                total beds minus available beds.
              </Text>
            </View>

            <FieldLabel
              label="Sharing Options"
              required
              marginTop
            />

            <View className="flex-row flex-wrap">
              {SHARING_OPTIONS.map(
                (item) => (
                  <OptionButton
                    key={item}
                    label={`${item} Sharing`}
                    selected={sharing.includes(
                      item
                    )}
                    onPress={() =>
                      setSharing((prev) =>
                        toggleInList(
                          prev,
                          item
                        )
                      )
                    }
                  />
                )
              )}
            </View>

            <FieldLabel
              label="AC Type"
              required
              marginTop
            />

            <View className="flex-row">
              {(
                ["AC", "Non-AC"] as ACType[]
              ).map((item) => (
                <OptionButton
                  key={item}
                  label={item}
                  selected={
                    acType === item
                  }
                  onPress={() =>
                    setAcType(item)
                  }
                />
              ))}
            </View>
          </Card>

          {/* ================================================================
              4. FACILITIES
          ================================================================ */}

          <SectionHeader
            number="4"
            title="Facilities"
            description="Select the facilities available"
          />

          <Card>
            <View className="flex-row flex-wrap">
              {FACILITIES.map(
                (item) => (
                  <OptionButton
                    key={item}
                    label={item}
                    selected={facilities.includes(
                      item
                    )}
                    onPress={() =>
                      setFacilities(
                        (prev) =>
                          toggleInList(
                            prev,
                            item
                          )
                      )
                    }
                  />
                )
              )}
            </View>
          </Card>

          {/* ================================================================
              5. FOOD
          ================================================================ */}

          <SectionHeader
            number="5"
            title="Food"
            description="Add food and meal timings"
          />

          <Card>
            <FieldLabel label="Food Available" />

            <View className="flex-row">
              {(
                ["Yes", "No"] as YesNo[]
              ).map((item) => (
                <OptionButton
                  key={item}
                  label={item}
                  selected={
                    foodAvailable === item
                  }
                  onPress={() => {
                    setFoodAvailable(item);

                    if (item === "No") {
                      setBreakfastTime("");
                      setLunchTime("");
                      setDinnerTime("");
                    }
                  }}
                />
              ))}
            </View>

            {foodAvailable === "Yes" && (
              <>
                <Field
                  label="Breakfast Time"
                  marginTop
                  value={breakfastTime}
                  onChangeText={
                    setBreakfastTime
                  }
                  placeholder="e.g. 8:00 AM"
                />

                <Field
                  label="Lunch Time"
                  marginTop
                  value={lunchTime}
                  onChangeText={setLunchTime}
                  placeholder="e.g. 1:00 PM"
                />

                <Field
                  label="Dinner Time"
                  marginTop
                  value={dinnerTime}
                  onChangeText={
                    setDinnerTime
                  }
                  placeholder="e.g. 8:00 PM"
                />
              </>
            )}
          </Card>

          {/* ================================================================
              6. LOCATION
          ================================================================ */}

          <SectionHeader
            number="6"
            title="Location"
            description="Tell tenants where you are located"
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

                        {/* LOCATION ACTIONS */}

            <View className="mt-5">
              <Text className="text-[14px] font-extrabold text-[#0F172A]">
                Property Location
              </Text>

              <Text className="mt-1 text-[12px] leading-5 text-[#64748B]">
                Choose the exact location of your PG or hostel. You can use
                your current location or select the property location manually.
              </Text>
            </View>

            {/* CURRENT LOCATION */}
            <Pressable
              onPress={handleUseCurrentLocation}
              disabled={isGettingLocation}
              className="mt-4 flex-row items-center justify-center rounded-[15px] bg-[#EFF6FF] px-4 py-4"
              style={{
                borderWidth: 1,
                borderColor: "#BFDBFE",
              }}
            >
              {isGettingLocation ? (
                <ActivityIndicator
                  size="small"
                  color="#2563EB"
                />
              ) : (
                <Text className="text-[14px] font-extrabold text-[#2563EB]">
                  📍 Use My Current Location
                </Text>
              )}
            </Pressable>

            {/* OR */}
            <View className="my-3 flex-row items-center">
              <View className="h-[1px] flex-1 bg-[#E2E8F0]" />

              <Text className="mx-3 text-[11px] font-bold text-[#94A3B8]">
                OR
              </Text>

              <View className="h-[1px] flex-1 bg-[#E2E8F0]" />
            </View>

            {/* SELECT ON MAP */}
            <Pressable
              onPress={() => {
                if (latitude !== null && longitude !== null) {
                  setSelectedLocation({
                    latitude,
                    longitude,
                  });

                  setMapRegion({
                    latitude,
                    longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  });
                }

                setShowLocationPicker(true);
              }}
              className="flex-row items-center justify-center rounded-[15px] bg-[#F8FAFC] px-4 py-4"
              style={{
                borderWidth: 1,
                borderColor: "#E2E8F0",
              }}
            >
              <Text className="text-[14px] font-extrabold text-[#334155]">
                🗺️ Select Property Location
              </Text>
            </Pressable>

            {/* SAVED LOCATION */}
            {latitude !== null && longitude !== null && (
              <View className="mt-4 rounded-[16px] bg-[#ECFDF5] p-4">
                <View className="flex-row items-center">
                  <View className="h-9 w-9 items-center justify-center rounded-full bg-[#D1FAE5]">
                    <Text className="text-[17px]">
                      ✓
                    </Text>
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

          {/* ================================================================
              7. RESTRICTIONS
          ================================================================ */}

          <SectionHeader
            number="7"
            title="Restrictions & Rules"
            description="Add important property rules"
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

          {/* ================================================================
              8. PHOTOS
          ================================================================ */}

          <SectionHeader
            number="8"
            title="Photos"
            description="Add photos after saving your property"
          />

          <Card>
            <View className="rounded-[16px] bg-[#EFF6FF] p-4">
              <Text className="text-[14px] font-extrabold text-[#1E3A8A]">
                Photos are added next
              </Text>

              <Text className="mt-1 text-[12px] leading-5 text-[#475569]">
                First save your property
                details. Then you can upload
                cover, property, room, bed,
                washroom and mess photos.
              </Text>
            </View>
          </Card>

          {/* ================================================================
              SAVE
          ================================================================ */}

          <Pressable
            disabled={isCreating}
            onPress={handleCreateListing}
            className="mt-6 h-[56px] flex-row items-center justify-center rounded-[18px] bg-[#2563EB]"
            style={({ pressed }) => ({
              opacity: isCreating
                ? 0.7
                : pressed
                ? 0.9
                : 1,

              shadowColor: "#2563EB",

              shadowOffset: {
                width: 0,
                height: 4,
              },

              shadowOpacity: 0.2,

              shadowRadius: 8,

              elevation: 4,
            })}
          >
            {isCreating ? (
              <>
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />

                <Text className="ml-3 text-[15px] font-extrabold text-white">
                  Creating Property...
                </Text>
              </>
            ) : (
              <Text className="text-[15px] font-extrabold text-white">
                Save & Continue to Photos
              </Text>
            )}
          </Pressable>

          <Text className="mt-3 px-4 text-center text-[11px] leading-5 text-[#64748B]">
            Your property will first be
            saved as a draft. You can add
            photos and review it before
            publishing.
          </Text>
        </ScrollView>


            <Modal
  visible={showLocationPicker}
  animationType="slide"
  presentationStyle="pageSheet"
  onRequestClose={() => setShowLocationPicker(false)}
>
  <SafeAreaView className="flex-1 bg-[#F5F9FD]">
    {/* HEADER */}
    <View className="border-b border-[#E8EEF5] bg-white px-5 py-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-[20px] font-extrabold text-[#0F172A]">
            Select Property Location
          </Text>

          <Text className="mt-1 text-[11px] text-[#64748B]">
            Search or tap anywhere on the map
          </Text>
        </View>

        <Pressable
          onPress={() => setShowLocationPicker(false)}
          className="ml-3 h-10 w-10 items-center justify-center rounded-full bg-[#F1F5F9]"
        >
          <Text className="text-[20px] font-bold text-[#334155]">
            ×
          </Text>
        </Pressable>
      </View>

      {/* SEARCH */}
      <View className="mt-4 flex-row">
        <TextInput
          value={locationSearch}
          onChangeText={setLocationSearch}
          placeholder="Search property location..."
          placeholderTextColor="#94A3B8"
          returnKeyType="search"
          onSubmitEditing={handleSearchPropertyLocation}
          className="flex-1 rounded-[14px] bg-[#F8FAFC] px-4 text-[14px] text-[#0F172A]"
          style={{
            height: 50,
            borderWidth: 1,
            borderColor: "#E2E8F0",
          }}
        />

        <Pressable
          onPress={handleSearchPropertyLocation}
          disabled={isSearchingLocation}
          className="ml-2 h-[50px] w-[54px] items-center justify-center rounded-[14px] bg-[#2563EB]"
        >
          {isSearchingLocation ? (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
            />
          ) : (
            <Text className="text-[20px]">
              🔍
            </Text>
          )}
        </Pressable>
      </View>
    </View>

    {/* MAP */}
    <View className="flex-1">
      <MapView
        style={{ flex: 1 }}
        region={mapRegion}
        onPress={handleMapPress}
      >
        {selectedLocation && (
          <Marker
            coordinate={selectedLocation}
            title="Property Location"
            description="Selected hostel / PG location"
          />
        )}
      </MapView>

      {/* MAP HINT */}
      <View className="absolute left-5 right-5 top-4 rounded-[14px] bg-white px-4 py-3 shadow">
        <Text className="text-center text-[12px] font-bold text-[#334155]">
          📍 Tap on the map to place the property marker
        </Text>
      </View>
    </View>

    {/* BOTTOM */}
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
        className="h-[54px] items-center justify-center rounded-[16px] bg-[#2563EB]"
      >
        <Text className="text-[15px] font-extrabold text-white">
          Confirm Property Location
        </Text>
      </Pressable>
    </View>
  </SafeAreaView>
</Modal>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================

function Card({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <View className="rounded-[22px] bg-white p-5">
      {children}
    </View>
  );
}

function SectionHeader({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
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

        <Text className="mt-0.5 text-[11px] text-[#64748B]">
          {description}
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
    <View
      className={`flex-row items-center ${
        marginTop
          ? "mb-2 mt-5"
          : "mb-2"
      }`}
    >
      <Text className="text-[13px] font-bold text-[#334155]">
        {label}
      </Text>

      {required && (
        <Text className="ml-1 text-[13px] font-bold text-[#DC2626]">
          *
        </Text>
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
}) {
  const keyboardType: KeyboardTypeOptions =
    numeric
      ? "number-pad"
      : "default";

  return (
    <View>
      <FieldLabel
        label={label}
        required={required}
        marginTop={marginTop}
      />

      <TextInput
        value={value}
        onChangeText={(text) =>
          onChangeText(
            numeric
              ? text.replace(
                  /[^0-9]/g,
                  ""
                )
              : text
          )
        }
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={
          multiline
            ? "top"
            : "center"
        }
        className={`rounded-[15px] bg-[#F8FAFC] px-4 text-[14px] text-[#0F172A] ${
          multiline ? "py-3" : ""
        }`}
        style={{
          ...(multiline
            ? {
                minHeight:
                  minHeight ?? 90,
              }
            : {
                height: 50,
              }),

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
        selected
          ? "bg-[#2563EB]"
          : "bg-[#F8FAFC]"
      }`}
      style={{
        borderWidth: 1,
        borderColor: selected
          ? "#2563EB"
          : "#E2E8F0",
      }}
    >
      <Text
        className={`text-[12px] font-bold ${
          selected
            ? "text-white"
            : "text-[#475569]"
        }`}
      >
        {selected ? "✓ " : ""}
        {label}
      </Text>
    </Pressable>
  );
}