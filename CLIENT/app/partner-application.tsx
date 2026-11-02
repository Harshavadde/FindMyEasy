import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Location from "expo-location";
import { SafeAreaView } from "react-native-safe-area-context";
import ListingLocationMap from "../components/ListingLocationMap";
import type {
  LocationCoordinate,
  LocationRegion,
} from "../components/ListingLocationMap.types";
import { normalizeIndianPhoneNumber } from "../services/auth";
import {
  getOwnerApplicationSubmitError,
  submitOwnerApplication,
  type OwnerApplicationInput,
  type OwnerApplicationResult,
  type OwnerRelationship,
} from "../services/ownerApplications";

const COLORS = {
  brand: "#2563EB",
  ink: "#0F172A",
  muted: "#64748B",
  line: "#E2E8F0",
  canvas: "#F5F8FC",
  danger: "#B91C1C",
};

const RELATIONSHIPS: {
  value: OwnerRelationship;
  label: string;
}[] = [
  { value: "PROPERTY_OWNER", label: "Property Owner" },
  { value: "PROPERTY_MANAGER", label: "Property Manager" },
  { value: "AUTHORIZED_REPRESENTATIVE", label: "Authorized Representative" },
];

const INITIAL_REGION: LocationRegion = {
  latitude: 17.385,
  longitude: 78.4867,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

type PlaceSuggestion = {
  placeId: string;
  title: string;
  address: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline = false,
  maxLength,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  multiline?: boolean;
  maxLength?: number;
  editable?: boolean;
}) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-[13px] font-bold text-[#334155]">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize={keyboardType === "email-address" ? "none" : "words"}
        className={`rounded-2xl border border-[#E2E8F0] bg-white px-4 text-[15px] text-[#0F172A] ${
          multiline ? "min-h-[104px] py-3" : "h-[52px]"
        }`}
        editable={editable}
        keyboardType={keyboardType}
        maxLength={maxLength}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        textAlignVertical={multiline ? "top" : "center"}
        value={value}
      />
    </View>
  );
}

function StepHeading({ title, description }: { title: string; description: string }) {
  return (
    <View className="mb-6">
      <Text className="text-[22px] font-extrabold text-[#0F172A]">{title}</Text>
      <Text className="mt-2 text-[14px] leading-5 text-[#64748B]">
        {description}
      </Text>
    </View>
  );
}

function ApplicationConfirmation({
  result,
}: {
  result: OwnerApplicationResult;
}) {
  return (
    <View className="rounded-3xl border border-[#DCE7F5] bg-white p-6">
      <View className="mb-5 h-14 w-14 items-center justify-center rounded-full bg-[#DCFCE7]">
        <Text className="text-[26px] font-extrabold text-[#15803D]">✓</Text>
      </View>
      <Text className="text-[24px] font-extrabold text-[#0F172A]">
        Application submitted
      </Text>
      <Text className="mt-2 text-[14px] leading-6 text-[#64748B]">
        Your application is awaiting FindEasy Admin review. No Owner account has
        been created yet. Phone verification was not performed as part of this
        submission.
      </Text>
      <View className="mt-6 rounded-2xl bg-[#F1F5F9] p-4">
        <Text className="text-[11px] font-bold tracking-wider text-[#64748B]">
          APPLICATION REFERENCE
        </Text>
        <Text selectable className="mt-1 text-[20px] font-extrabold text-[#0F172A]">
          {result.application_reference}
        </Text>
        <Text className="mt-1 text-[13px] font-semibold text-[#2563EB]">
          Status: {result.status}
        </Text>
      </View>
      <View className="mt-4 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-4">
        <Text className="text-[13px] font-extrabold text-[#92400E]">
          Save your private status access key
        </Text>
        <Text selectable className="mt-2 text-[14px] leading-5 text-[#78350F]">
          {result.status_access_key}
        </Text>
        <Text className="mt-2 text-[12px] leading-5 text-[#92400E]">
          This key is shown once. Keep it private; it is required with your
          reference to check your application status.
        </Text>
      </View>
    </View>
  );
}

export default function PartnerApplicationPage() {
  const [step, setStep] = useState(0);
  const [applicantName, setApplicantName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] =
    useState<OwnerRelationship>("PROPERTY_OWNER");
  const [pgName, setPgName] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [formattedAddress, setFormattedAddress] = useState("");
  const [coordinates, setCoordinates] = useState<LocationCoordinate | null>(null);
  const [latitudeInput, setLatitudeInput] = useState("");
  const [longitudeInput, setLongitudeInput] = useState("");
  const [region, setRegion] = useState(INITIAL_REGION);
  const [placeId, setPlaceId] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [placeQuery, setPlaceQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<OwnerApplicationResult | null>(null);

  const googlePlacesKey =
    process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY?.trim() ?? "";

  const locationUrl = useMemo(() => {
    if (!coordinates) return "";
    return `https://www.google.com/maps/search/?api=1&query=${coordinates.latitude},${coordinates.longitude}`;
  }, [coordinates]);

  function chooseCoordinates(location: LocationCoordinate) {
    setCoordinates(location);
    setLatitudeInput(String(location.latitude));
    setLongitudeInput(String(location.longitude));
    setFormattedAddress("");
    setRegion({
      ...location,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    setPlaceId("");
    setMapsUrl(
      `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`
    );
    setError("");
  }

  async function useCurrentLocation() {
    setError("");
    setIsLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setError(
          "Location permission was not granted. Search for the property or enter coordinates manually."
        );
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const location = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
      chooseCoordinates(location);

      try {
        const [place] = await Location.reverseGeocodeAsync(location);
        const formatted = [
          place?.name,
          place?.street,
          place?.district,
          place?.city,
          place?.postalCode,
        ]
          .filter(Boolean)
          .join(", ");
        if (formatted) setFormattedAddress(formatted);
      } catch {
        setFormattedAddress(address);
      }
    } catch {
      setError("Unable to read your current location. Try manual location entry.");
    } finally {
      setIsLocating(false);
    }
  }

  async function searchLocation() {
    const query = placeQuery.trim();
    if (!query || isSearching) return;
    setError("");
    setIsSearching(true);
    setSuggestions([]);
    try {
      if (googlePlacesKey) {
        const response = await fetch(
          "https://places.googleapis.com/v1/places:autocomplete",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": googlePlacesKey,
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
          throw new Error("Google Places search is unavailable right now.");
        }
        const data: unknown = await response.json();
        const suggestionsValue = asRecord(data)?.suggestions;
        const parsed: PlaceSuggestion[] = Array.isArray(suggestionsValue)
          ? suggestionsValue.flatMap((item): PlaceSuggestion[] => {
              const prediction = asRecord(asRecord(item)?.placePrediction);
              const structured = asRecord(prediction?.structuredFormat);
              const mainText = asRecord(structured?.mainText);
              const secondaryText = asRecord(structured?.secondaryText);
              const fallbackText = asRecord(prediction?.text);
              const placeId = getString(prediction?.placeId);
              if (!placeId) return [];
              const title =
                getString(mainText?.text) ??
                getString(fallbackText?.text) ??
                "Selected place";
              return [
                {
                  placeId,
                  title,
                  address:
                    getString(secondaryText?.text) ??
                    getString(fallbackText?.text) ??
                    title,
                },
              ];
            })
          : [];
        setSuggestions(parsed);
        if (!parsed.length) setError("No matching places found. Try a broader search.");
        return;
      }

      const matches = await Location.geocodeAsync(query);
      if (!matches.length) {
        setError("Location not found. Try a more specific address or enter coordinates.");
        return;
      }
      const match = matches[0];
      chooseCoordinates({
        latitude: match.latitude,
        longitude: match.longitude,
      });
      setFormattedAddress(query);
      setPlaceQuery(query);
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Unable to search for this location."
      );
    } finally {
      setIsSearching(false);
    }
  }

  async function selectPlace(place: PlaceSuggestion) {
    if (!googlePlacesKey) return;
    setIsSearching(true);
    setError("");
    try {
      const response = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(place.placeId)}`,
        {
          headers: {
            "X-Goog-Api-Key": googlePlacesKey,
            "X-Goog-FieldMask":
              "id,formattedAddress,location,googleMapsUri",
          },
        }
      );
      if (!response.ok) {
        throw new Error("Unable to load details for that place.");
      }
      const details: unknown = await response.json();
      const detailsRecord = asRecord(details);
      const placeLocation = asRecord(detailsRecord?.location);
      const latitude = Number(placeLocation?.latitude);
      const longitude = Number(placeLocation?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error("The selected place does not include valid coordinates.");
      }
      chooseCoordinates({ latitude, longitude });
      setPlaceId(getString(detailsRecord?.id) ?? place.placeId);
      setFormattedAddress(
        getString(detailsRecord?.formattedAddress) ?? place.address
      );
      setMapsUrl(
        getString(detailsRecord?.googleMapsUri) ??
          `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
      );
      setPlaceQuery(
        getString(detailsRecord?.formattedAddress) ?? place.title
      );
      setSuggestions([]);
    } catch (selectionError) {
      setError(
        selectionError instanceof Error
          ? selectionError.message
          : "Unable to select this place."
      );
    } finally {
      setIsSearching(false);
    }
  }

  function validateStep(): boolean {
    setError("");
    if (step === 0) {
      if (!applicantName.trim()) {
        setError("Enter your full name.");
        return false;
      }
      try {
        normalizeIndianPhoneNumber(phone);
      } catch {
        setError("Enter a valid Indian mobile number.");
        return false;
      }
      if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError("Enter a valid email address or leave it blank.");
        return false;
      }
    } else if (step === 1) {
      if (!pgName.trim() || !city.trim() || !area.trim() || !address.trim()) {
        setError("Complete the PG name, city, area, and full address.");
        return false;
      }
    } else if (step === 2 && !coordinates) {
      setError("Select the PG location on the map or enter its coordinates.");
      return false;
    } else if (step === 3 && !declarationAccepted) {
      setError("Accept the partnership declaration before submitting.");
      return false;
    }
    return true;
  }

  function setManualCoordinate(
    axis: keyof LocationCoordinate,
    value: string
  ) {
    const nextLatitudeInput =
      axis === "latitude" ? value : latitudeInput;
    const nextLongitudeInput =
      axis === "longitude" ? value : longitudeInput;
    setLatitudeInput(nextLatitudeInput);
    setLongitudeInput(nextLongitudeInput);

    if (!nextLatitudeInput.trim() || !nextLongitudeInput.trim()) {
      setCoordinates(null);
      setPlaceId("");
      setMapsUrl("");
      return;
    }
    const latitude = Number(nextLatitudeInput);
    const longitude = Number(nextLongitudeInput);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      setCoordinates(null);
      setPlaceId("");
      setMapsUrl("");
      return;
    }
    const next = { latitude, longitude };
    chooseCoordinates(next);
  }

  async function submitApplication() {
    if (isSubmitting || !validateStep()) return;
    if (!coordinates) {
      setError("Choose the PG location before submitting.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const payload: OwnerApplicationInput = {
        applicant_name: applicantName.trim(),
        applicant_phone: normalizeIndianPhoneNumber(phone),
        ...(email.trim() ? { applicant_email: email.trim() } : {}),
        relationship_type: relationship,
        pg_name: pgName.trim(),
        city: city.trim(),
        area: area.trim(),
        address: address.trim(),
        formatted_address: (formattedAddress || address).trim(),
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        ...(placeId ? { google_place_id: placeId } : {}),
        google_maps_url: mapsUrl || locationUrl,
        declaration_accepted: true,
      };
      setResult(await submitOwnerApplication(payload));
    } catch (submitError) {
      setError(getOwnerApplicationSubmitError(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  const stepTitles = [
    "Personal information",
    "PG information",
    "Location verification",
    "Review & submit",
  ];

  return (
    <SafeAreaView className="flex-1 bg-[#F5F8FC]">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="mx-auto w-full max-w-[720px] flex-1 px-5 py-6">
            {!result ? (
              <>
                <View className="mb-6 flex-row items-center">
                  <View className="mr-3 h-12 w-12 items-center justify-center rounded-2xl bg-[#2563EB]">
                    <Text className="text-[23px] font-black text-white">F</Text>
                  </View>
                  <View>
                    <Text className="text-[17px] font-extrabold text-[#0F172A]">
                      FindEasy Partner
                    </Text>
                    <Text className="text-[12px] font-semibold tracking-wider text-[#64748B]">
                      PARTNERSHIP APPLICATION
                    </Text>
                  </View>
                </View>

                <View className="mb-6 rounded-3xl border border-[#E2E8F0] bg-white p-5">
                  <View className="mb-3 flex-row justify-between">
                    {stepTitles.map((title, index) => (
                      <View className="flex-1 items-center" key={title}>
                        <View
                          className={`h-8 w-8 items-center justify-center rounded-full ${
                            index <= step ? "bg-[#2563EB]" : "bg-[#E2E8F0]"
                          }`}
                        >
                          <Text
                            className={`text-[12px] font-extrabold ${
                              index <= step ? "text-white" : "text-[#64748B]"
                            }`}
                          >
                            {index + 1}
                          </Text>
                        </View>
                        <Text
                          className="mt-2 text-center text-[10px] font-semibold text-[#64748B]"
                          numberOfLines={1}
                        >
                          {title}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <View className="h-1.5 overflow-hidden rounded-full bg-[#E2E8F0]">
                    <View
                      className="h-full rounded-full bg-[#2563EB]"
                      style={{ width: `${((step + 1) / 4) * 100}%` }}
                    />
                  </View>
                </View>

                <View className="rounded-3xl border border-[#E2E8F0] bg-white p-5 sm:p-7">
                  {step === 0 && (
                    <>
                      <StepHeading
                        title="Tell us about yourself"
                        description="Share your contact details and how you are connected to the PG."
                      />
                      <TextField
                        label="Full name *"
                        value={applicantName}
                        onChangeText={setApplicantName}
                        placeholder="Your full name"
                        maxLength={150}
                      />
                      <TextField
                        label="Mobile number *"
                        value={phone}
                        onChangeText={(value) =>
                          setPhone(value.replace(/[^\d+]/g, "").slice(0, 13))
                        }
                        placeholder="+91 98765 43210"
                        keyboardType="phone-pad"
                        maxLength={13}
                      />
                      <TextField
                        label="Email address (optional)"
                        value={email}
                        onChangeText={setEmail}
                        placeholder="you@example.com"
                        keyboardType="email-address"
                        maxLength={255}
                      />
                      <Text className="mb-3 text-[13px] font-bold text-[#334155]">
                        Your relationship with the PG *
                      </Text>
                      {RELATIONSHIPS.map((item) => {
                        const selected = relationship === item.value;
                        return (
                          <Pressable
                            accessibilityRole="radio"
                            accessibilityState={{ selected }}
                            className={`mb-2 rounded-2xl border px-4 py-4 ${
                              selected
                                ? "border-[#2563EB] bg-[#EFF6FF]"
                                : "border-[#E2E8F0] bg-white"
                            }`}
                            key={item.value}
                            onPress={() => setRelationship(item.value)}
                          >
                            <Text
                              className={`text-[14px] font-bold ${
                                selected ? "text-[#1D4ED8]" : "text-[#334155]"
                              }`}
                            >
                              {item.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </>
                  )}

                  {step === 1 && (
                    <>
                      <StepHeading
                        title="Tell us about the PG"
                        description="Enter the property details that FindEasy will review."
                      />
                      <TextField
                        label="PG / property name *"
                        value={pgName}
                        onChangeText={setPgName}
                        placeholder="Property name"
                        maxLength={200}
                      />
                      <TextField
                        label="City *"
                        value={city}
                        onChangeText={setCity}
                        placeholder="City"
                        maxLength={100}
                      />
                      <TextField
                        label="Area / locality *"
                        value={area}
                        onChangeText={setArea}
                        placeholder="Area or locality"
                        maxLength={150}
                      />
                      <TextField
                        label="Complete PG address *"
                        value={address}
                        onChangeText={setAddress}
                        placeholder="Building, street, locality, city and PIN code"
                        multiline
                        maxLength={2000}
                      />
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <StepHeading
                        title="Verify the PG location"
                        description="Allow location access, search for the property, tap the map, or enter coordinates manually."
                      />
                      <Pressable
                        className="mb-4 h-[50px] items-center justify-center rounded-2xl bg-[#EFF6FF]"
                        disabled={isLocating}
                        onPress={() => void useCurrentLocation()}
                      >
                        {isLocating ? (
                          <ActivityIndicator color={COLORS.brand} />
                        ) : (
                          <Text className="font-extrabold text-[#2563EB]">
                            Use current location
                          </Text>
                        )}
                      </Pressable>
                      <View className="mb-2 flex-row">
                        <TextInput
                          accessibilityLabel="Search property location"
                          className="h-[50px] flex-1 rounded-2xl border border-[#E2E8F0] bg-white px-4 text-[14px]"
                          onChangeText={setPlaceQuery}
                          onSubmitEditing={() => void searchLocation()}
                          placeholder="Search address, area, landmark"
                          placeholderTextColor="#94A3B8"
                          returnKeyType="search"
                          value={placeQuery}
                        />
                        <Pressable
                          className="ml-2 h-[50px] items-center justify-center rounded-2xl bg-[#2563EB] px-4"
                          disabled={isSearching}
                          onPress={() => void searchLocation()}
                        >
                          {isSearching ? (
                            <ActivityIndicator color="#FFFFFF" />
                          ) : (
                            <Text className="font-bold text-white">Search</Text>
                          )}
                        </Pressable>
                      </View>
                      {!googlePlacesKey && (
                        <Text className="mb-3 text-[11px] leading-4 text-[#64748B]">
                          Google Places is not configured. Address search uses
                          device geocoding when available; the map and manual
                          coordinate fields remain available.
                        </Text>
                      )}
                      {googlePlacesKey &&
                        suggestions.map((suggestion) => (
                          <Pressable
                            className="mb-2 rounded-xl border border-[#E2E8F0] bg-white p-3"
                            key={suggestion.placeId}
                            onPress={() => void selectPlace(suggestion)}
                          >
                            <Text className="font-bold text-[#0F172A]">
                              {suggestion.title}
                            </Text>
                            <Text className="mt-1 text-[12px] text-[#64748B]">
                              {suggestion.address}
                            </Text>
                          </Pressable>
                        ))}
                      <View className="my-3 h-[280px] overflow-hidden rounded-2xl border border-[#E2E8F0]">
                        <ListingLocationMap
                          initialRegion={region}
                          selectedLocation={coordinates}
                          onLocationSelected={chooseCoordinates}
                        />
                      </View>
                      <Text className="mb-3 text-[12px] text-[#64748B]">
                        Tap the map to set the PG pin. On the web map preview,
                        use the manual coordinates below.
                      </Text>
                      <View className="flex-row">
                        <View className="mr-2 flex-1">
                          <TextField
                            label="Latitude"
                            value={latitudeInput}
                            onChangeText={(value) =>
                              setManualCoordinate("latitude", value)
                            }
                            placeholder="e.g. 17.3850"
                            keyboardType="numeric"
                          />
                        </View>
                        <View className="ml-2 flex-1">
                          <TextField
                            label="Longitude"
                            value={longitudeInput}
                            onChangeText={(value) =>
                              setManualCoordinate("longitude", value)
                            }
                            placeholder="e.g. 78.4867"
                            keyboardType="numeric"
                          />
                        </View>
                      </View>
                      {coordinates && (
                        <View className="rounded-2xl bg-[#F0FDF4] p-4">
                          <Text className="text-[13px] font-extrabold text-[#166534]">
                            Location selected
                          </Text>
                          <Text className="mt-1 text-[12px] text-[#166534]">
                            {coordinates.latitude.toFixed(6)},{" "}
                            {coordinates.longitude.toFixed(6)}
                          </Text>
                          {formattedAddress ? (
                            <Text className="mt-2 text-[12px] text-[#166534]">
                              {formattedAddress}
                            </Text>
                          ) : null}
                          {placeId ? (
                            <Text className="mt-1 text-[11px] text-[#166534]">
                              Google Place ID saved
                            </Text>
                          ) : null}
                        </View>
                      )}
                    </>
                  )}

                  {step === 3 && (
                    <>
                      <StepHeading
                        title="Review your application"
                        description="Check the details before sending your application to FindEasy."
                      />
                      {[
                        ["Applicant", applicantName, 0],
                        ["Mobile", phone, 0],
                        ["Email", email || "Not provided", 0],
                        [
                          "Relationship",
                          RELATIONSHIPS.find(
                            (item) => item.value === relationship
                          )?.label ?? "",
                          0,
                        ],
                        ["PG name", pgName, 1],
                        ["City", city, 1],
                        ["Area", area, 1],
                        ["Address", address, 1],
                        [
                          "Coordinates",
                          coordinates
                            ? `${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`
                            : "Not selected",
                          2,
                        ],
                        ["Formatted location", formattedAddress || address, 2],
                        ["Google Place ID", placeId || "Not available", 2],
                      ].map(([label, value, editStep]) => (
                        <View
                          className="mb-3 flex-row items-start justify-between border-b border-[#F1F5F9] pb-3"
                          key={String(label)}
                        >
                          <View className="mr-3 flex-1">
                            <Text className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                              {label}
                            </Text>
                            <Text className="mt-1 text-[14px] font-semibold text-[#0F172A]">
                              {value}
                            </Text>
                          </View>
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => setStep(Number(editStep))}
                          >
                            <Text className="font-bold text-[#2563EB]">Edit</Text>
                          </Pressable>
                        </View>
                      ))}
                      {mapsUrl || locationUrl ? (
                        <Pressable
                          className="mb-4"
                          onPress={() =>
                            void Linking.openURL(mapsUrl || locationUrl)
                          }
                        >
                          <Text className="font-bold text-[#2563EB]">
                            Open selected location in Google Maps
                          </Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{
                          checked: declarationAccepted,
                        }}
                        className="flex-row items-start rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4"
                        onPress={() =>
                          setDeclarationAccepted((accepted) => !accepted)
                        }
                      >
                        <View
                          className={`mr-3 mt-0.5 h-5 w-5 items-center justify-center rounded border ${
                            declarationAccepted
                              ? "border-[#2563EB] bg-[#2563EB]"
                              : "border-[#94A3B8] bg-white"
                          }`}
                        >
                          {declarationAccepted ? (
                            <Text className="text-[12px] font-extrabold text-white">
                              ✓
                            </Text>
                          ) : null}
                        </View>
                        <Text className="flex-1 text-[13px] leading-5 text-[#334155]">
                          I confirm these details are accurate and authorize
                          FindEasy to review this partnership application.
                        </Text>
                      </Pressable>
                    </>
                  )}

                  {error ? (
                    <Text
                      accessibilityRole="alert"
                      className="mt-4 rounded-xl bg-[#FEF2F2] px-4 py-3 text-[13px] leading-5 text-[#B91C1C]"
                    >
                      {error}
                    </Text>
                  ) : null}

                  <View className="mt-6 flex-row">
                    {step > 0 ? (
                      <Pressable
                        className="mr-2 h-[52px] flex-1 items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white"
                        disabled={isSubmitting}
                        onPress={() => {
                          setError("");
                          setStep((current) => current - 1);
                        }}
                      >
                        <Text className="font-extrabold text-[#334155]">
                          Back
                        </Text>
                      </Pressable>
                    ) : null}
                    {step < 3 ? (
                      <Pressable
                        className="h-[52px] flex-1 items-center justify-center rounded-2xl bg-[#2563EB]"
                        onPress={() => {
                          if (validateStep()) setStep((current) => current + 1);
                        }}
                      >
                        <Text className="font-extrabold text-white">
                          Continue
                        </Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        className="h-[52px] flex-1 items-center justify-center rounded-2xl bg-[#2563EB]"
                        disabled={isSubmitting}
                        onPress={() => void submitApplication()}
                      >
                        {isSubmitting ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text className="font-extrabold text-white">
                            Submit partnership application
                          </Text>
                        )}
                      </Pressable>
                    )}
                  </View>
                  <Text className="mt-4 text-center text-[11px] leading-4 text-[#64748B]">
                    Applying does not create an Owner account or publish a
                    property. FindEasy will review your application first.
                  </Text>
                </View>
              </>
            ) : (
              <ApplicationConfirmation result={result} />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
