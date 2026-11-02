import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";

import ListingCard from "../../components/ListingCard";
import ListingLocationMap from "../../components/ListingLocationMap";
import type {
  LocationCoordinate,
  LocationRegion,
} from "../../components/ListingLocationMap.types";
import {
  getCuratedListingProximity,
  getPublicListingProximity,
  getPublicListings,
} from "../../services/api";
import type { ListingProximityBadge } from "../../services/api";
import type { Listing } from "../../types/listing";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type NearbyListing = {
  listing: Listing;
  distanceKm: number;
  proximityBadge?: ListingProximityBadge | null;
};

const MAX_DISTANCE_KM = 20;
const CURRENT_LOCATION_TIMEOUT_MS = 12_000;

function getDistanceKm(from: Coordinates, to: Coordinates) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    6371 *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

function formatDistance(distanceKm: number) {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

function normalizeLocationName(value: string) {
  return value
    .toLowerCase()
    .replace(/\bhi[\s-]*tec\b/g, "hitech")
    .replace(/[^a-z0-9]/g, "");
}

async function getCurrentCoordinates(): Promise<Coordinates> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Location lookup timed out. Please try again.")),
          CURRENT_LOCATION_TIMEOUT_MS
        );
      }),
    ]);

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export default function NearbyPGsScreen() {
  const {
    selectedLocation: selectedLocationParam,
    selectedLocationType: selectedLocationTypeParam,
    resultMode: resultModeParam,
    resultFilter: resultFilterParam,
    resultQuery: resultQueryParam,
    placeName: placeNameParam,
    selectedArea: selectedAreaParam,
    selectedCity: selectedCityParam,
    selectedLatitude: selectedLatitudeParam,
    selectedLongitude: selectedLongitudeParam,
    liveLatitude: liveLatitudeParam,
    liveLongitude: liveLongitudeParam,
  } = useLocalSearchParams<{
    selectedLocation?: string;
    selectedLocationType?: string;
    resultMode?: string;
    resultFilter?: string;
    resultQuery?: string;
    placeName?: string;
    selectedArea?: string;
    selectedCity?: string;
    selectedLatitude?: string;
    selectedLongitude?: string;
    liveLatitude?: string;
    liveLongitude?: string;
  }>();
  const selectedLocationLabel =
    typeof selectedLocationParam === "string"
      ? selectedLocationParam
      : "your selected location";
  const selectedLocation = useMemo<LocationCoordinate | null>(() => {
    const latitude = Number(selectedLatitudeParam);
    const longitude = Number(selectedLongitudeParam);
    return Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      selectedLatitudeParam &&
      selectedLongitudeParam
      ? { latitude, longitude }
      : null;
  }, [selectedLatitudeParam, selectedLongitudeParam]);
  const passedLiveLocation = useMemo<Coordinates | null>(() => {
    const latitude = Number(liveLatitudeParam);
    const longitude = Number(liveLongitudeParam);
    return Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      liveLatitudeParam &&
      liveLongitudeParam
      ? { latitude, longitude }
      : null;
  }, [liveLatitudeParam, liveLongitudeParam]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [proximityBadges, setProximityBadges] = useState<
    Record<string, ListingProximityBadge | null>
  >({});
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locationLabel, setLocationLabel] = useState("Your current location");
  const [liveCoordinates, setLiveCoordinates] = useState<Coordinates | null>(
    null
  );
  const [pinCoordinates, setPinCoordinates] =
    useState<LocationCoordinate | null>(selectedLocation);
  const [needsLocationChoice, setNeedsLocationChoice] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNearbyPGs = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCoordinates(null);
    setListings([]);

    const listingsPromise = getPublicListings()
      .then((availableListings) => {
        setListings(availableListings);
        return availableListings;
      })
      .catch((listingsError: unknown) => {
        console.warn("Unable to load nearby PG listings:", listingsError);
        setError(
          listingsError instanceof Error
            ? listingsError.message
            : "Unable to load PG listings. Check your connection and try again."
        );
        return null;
      });

    try {
        const resultMode =
          typeof resultModeParam === "string" ? resultModeParam : "nearby";
        const selectedArea =
          typeof selectedAreaParam === "string" ? selectedAreaParam : "";
        const selectedCity =
          typeof selectedCityParam === "string" ? selectedCityParam : "";
        const scopedResults =
          resultMode === "search" ||
          resultMode === "area" ||
          ((resultMode === "place" || resultMode === "gender") &&
            Boolean(selectedArea || selectedCity));

        if (scopedResults) {
          const availableListings = await listingsPromise;
          if (!availableListings) return;

          const scopedListings = availableListings.filter(
            (listing) =>
              (!selectedArea ||
                normalizeLocationName(listing.area) ===
                  normalizeLocationName(selectedArea)) &&
              (!selectedCity ||
                normalizeLocationName(listing.city) ===
                  normalizeLocationName(selectedCity))
          );
          const validCoordinates = scopedListings.flatMap((listing) => {
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
          const anchor =
            selectedLocation ??
            (validCoordinates.length
              ? {
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
                }
              : null);

          setCoordinates(anchor);
          setLocationLabel(selectedLocationLabel);
          setNeedsLocationChoice(false);
          if (resultMode === "place") {
            const proximityType =
              resultFilterParam === "metro"
                ? "metro"
                : resultFilterParam === "bus"
                  ? "bus"
                : resultFilterParam === "coaching"
                  ? "education"
                  : "landmark";
            setProximityBadges(
              getCuratedListingProximity(
                availableListings,
                proximityType,
                typeof placeNameParam === "string" ? placeNameParam : undefined
              )
            );
            setProximityBadges(
              await getPublicListingProximity(
                availableListings,
                proximityType,
                typeof placeNameParam === "string" ? placeNameParam : undefined
              )
            );
          }
          return;
        }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Allow location access to find PGs closest to you.");
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setError("Turn on your device location, then try again.");
        return;
      }

      let currentCoordinates = passedLiveLocation;
      if (!currentCoordinates) {
        const lastKnownPosition = await Location.getLastKnownPositionAsync({
          maxAge: 90_000,
          requiredAccuracy: 1_000,
        });
        currentCoordinates = lastKnownPosition
          ? {
              latitude: lastKnownPosition.coords.latitude,
              longitude: lastKnownPosition.coords.longitude,
            }
          : await getCurrentCoordinates();
      }
      setLiveCoordinates(currentCoordinates);

      let liveAreaNames: string[] = [];
      let liveCityNames: string[] = [];
      const [availableListings] = await Promise.all([
        listingsPromise,
        (async () => {
          try {
            const [address] =
              await Location.reverseGeocodeAsync(currentCoordinates);
            liveAreaNames = [
              address?.name,
              address?.street,
              address?.district,
              address?.subregion,
            ].filter((value): value is string => Boolean(value));
            liveCityNames = [
              address?.city,
              address?.subregion,
            ].filter((value): value is string => Boolean(value));
            const area =
              address?.district ||
              address?.subregion ||
              address?.city ||
              address?.region;
            const city =
              address?.city && address.city !== area ? address.city : null;
            setLocationLabel(
              area && city
                ? `${area}, ${city}`
                : area || "Your current location"
            );
          } catch (geocodeError: unknown) {
            console.warn(
              "Unable to identify nearby PG location:",
              geocodeError
            );
            setLocationLabel("Your current location");
          }
        })(),
      ]);
      if (!availableListings) return;

      if (resultMode === "place" || resultMode === "gender") {
        const anchor = selectedLocation ?? currentCoordinates;
        setCoordinates(anchor);
        if (selectedLocationTypeParam !== "current") {
          setLocationLabel(selectedLocationLabel);
        }
        setNeedsLocationChoice(false);
        if (resultMode === "place") {
          const proximityType =
            resultFilterParam === "metro"
              ? "metro"
              : resultFilterParam === "bus"
                ? "bus"
              : resultFilterParam === "coaching"
                ? "education"
                : "landmark";
          setProximityBadges(
            getCuratedListingProximity(
              availableListings,
              proximityType,
              typeof placeNameParam === "string" ? placeNameParam : undefined
            )
          );
          setProximityBadges(
            await getPublicListingProximity(
              availableListings,
              proximityType,
              typeof placeNameParam === "string" ? placeNameParam : undefined
            )
          );
        }
        return;
      }

      const selectedLocationType =
        typeof selectedLocationTypeParam === "string"
          ? selectedLocationTypeParam
          : "current";
      const selectedLocationName = selectedLocationLabel.split(",")[0];
      const normalizedSelectedName =
        normalizeLocationName(selectedLocationName);
      const relevantLiveLocationNames =
        selectedLocationType === "city"
          ? liveCityNames
          : liveAreaNames;
      const matchesSelectedLocation =
        selectedLocationType === "current" ||
        relevantLiveLocationNames.some(
          (name) => normalizeLocationName(name) === normalizedSelectedName
        );

      if (!matchesSelectedLocation && selectedLocation) {
        setPinCoordinates(selectedLocation);
        setLocationLabel(selectedLocationLabel);
        setNeedsLocationChoice(true);
      } else {
        setCoordinates(currentCoordinates);
        setNeedsLocationChoice(false);
      }
    } catch (loadError: unknown) {
      console.warn("Unable to load nearby PGs:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load nearby PGs. Check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  }, [
    passedLiveLocation,
    selectedLocation,
    selectedLocationLabel,
    selectedLocationTypeParam,
    resultModeParam,
    resultFilterParam,
  ]);

  useEffect(() => {
    void loadNearbyPGs();
  }, [loadNearbyPGs]);

  const nearbyPGs = useMemo<NearbyListing[]>(() => {
    const selectedArea =
      typeof selectedAreaParam === "string" ? selectedAreaParam : "";
    const selectedCity =
      typeof selectedCityParam === "string" ? selectedCityParam : "";
    const resultMode =
      typeof resultModeParam === "string" ? resultModeParam : "nearby";
    const resultFilter =
      typeof resultFilterParam === "string" ? resultFilterParam : "";
    const resultQuery =
      typeof resultQueryParam === "string"
        ? normalizeLocationName(resultQueryParam)
        : "";
    if (!coordinates && resultMode !== "search" && resultMode !== "area") {
      return [];
    }
    const matchesAreaOrCity = (listing: Listing) =>
      (!selectedArea ||
        normalizeLocationName(listing.area) ===
          normalizeLocationName(selectedArea)) &&
      (!selectedCity ||
        normalizeLocationName(listing.city) ===
          normalizeLocationName(selectedCity));
    const matchesGender = (listing: Listing) => {
      const gender = listing.gender.toLowerCase().replace(/[^a-z]/g, "");
      if (resultFilter === "Boy's") {
        return ["boys", "boy", "men", "male"].includes(gender);
      }
      if (resultFilter === "Girl's") {
        return ["girls", "girl", "women", "female"].includes(gender);
      }
      return gender === "coliving" || gender === "colive";
    };
    const matchesSearch = (listing: Listing) =>
      resultQuery
        .split(/\s+/)
        .filter(Boolean)
        .every((token) =>
          normalizeLocationName(
            `${listing.name} ${listing.area} ${listing.city} ${listing.address}`
          ).includes(token)
        );

    return listings
      .filter(
        (listing) => listing.property_type.trim().toLowerCase() === "pg"
      )
      .filter((listing) =>
        resultMode === "search" ? matchesSearch(listing) : true
      )
      .filter((listing) =>
        resultMode === "gender" ? matchesGender(listing) : true
      )
      .filter((listing) =>
        resultMode === "place" ||
        resultMode === "gender" ||
        resultMode === "area"
          ? matchesAreaOrCity(listing)
          : true
      )
      .flatMap((listing) => {
        if (resultMode === "search" && !coordinates) {
          return [{ listing, distanceKm: 0 }];
        }

        if (resultMode === "area" && !coordinates) {
          return [{ listing, distanceKm: 0 }];
        }

        if (resultMode === "place") {
          const proximityBadge = proximityBadges[String(listing.id)];
          if (!proximityBadge) return [];
          const latitude = Number(listing.latitude);
          const longitude = Number(listing.longitude);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return [];
          }
          const userDistanceKm = coordinates
            ? getDistanceKm(coordinates, {
                latitude,
                longitude,
              })
            : 0;
          if (
            !selectedArea &&
            !selectedCity &&
            userDistanceKm > MAX_DISTANCE_KM
          ) {
            return [];
          }
          return [
            {
              listing,
              distanceKm: proximityBadge.distance_m / 1000,
              proximityBadge,
            },
          ];
        }

        const latitude = Number(listing.latitude);
        const longitude = Number(listing.longitude);
        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          latitude < -90 ||
          latitude > 90 ||
          longitude < -180 ||
          longitude > 180
        ) {
          return resultMode === "area"
            ? [{ listing, distanceKm: Number.POSITIVE_INFINITY }]
            : [];
        }

        const distanceKm = coordinates
          ? getDistanceKm(coordinates, {
              latitude,
              longitude,
            })
          : 0;
        return distanceKm <= MAX_DISTANCE_KM ||
          ((resultMode === "gender" || resultMode === "area") &&
            Boolean(selectedArea || selectedCity))
          ? [{ listing, distanceKm }]
          : [];
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [
    coordinates,
    listings,
    proximityBadges,
    resultFilterParam,
    resultModeParam,
    resultQueryParam,
    selectedAreaParam,
    selectedCityParam,
  ]);

  const nearbyArea = locationLabel.split(",")[0].trim();
  const nearbyAreaLabel =
    nearbyArea === "Your current location" ? "your location" : nearbyArea;
  const resultMode =
    typeof resultModeParam === "string" ? resultModeParam : "nearby";
  const resultFilter =
    typeof resultFilterParam === "string" ? resultFilterParam : "";
  const resultTitle =
    resultMode === "search"
      ? typeof resultQueryParam === "string" && resultQueryParam
        ? `Results for "${resultQueryParam}"`
        : "Search Results"
      : resultMode === "area"
        ? `PGs in ${nearbyAreaLabel}`
        : resultMode === "place"
      ? resultFilter === "metro"
        ? typeof placeNameParam === "string" && placeNameParam
          ? `PGs Near ${placeNameParam}`
          : "PGs Near Metro"
        : resultFilter === "it-park"
          ? "PGs Near IT Parks"
          : resultFilter === "bus"
            ? "PGs Near Bus Stops"
          : "PGs Near Coaching Hubs"
      : resultMode === "gender"
        ? `${resultFilter} PGs`
        : "PGs Near You";
  const pinMapRegion: LocationRegion = {
    latitude: pinCoordinates?.latitude ?? selectedLocation?.latitude ?? 17.385,
    longitude:
      pinCoordinates?.longitude ?? selectedLocation?.longitude ?? 78.4867,
    latitudeDelta: 0.025,
    longitudeDelta: 0.025,
  };

  const useCurrentLocation = () => {
    if (!liveCoordinates) return;
    setCoordinates(liveCoordinates);
    setNeedsLocationChoice(false);
    setLocationLabel("Your current location");
  };

  const confirmPinnedLocation = () => {
    if (!pinCoordinates) return;
    setCoordinates(pinCoordinates);
    setNeedsLocationChoice(false);
    setLocationLabel(`Pinned near ${selectedLocationLabel}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC]" edges={["top"]}>
      <View className="flex-row items-center border-b border-[#E2E8F0] bg-white px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-[#F1F5F9]"
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={21}
            color="#0F172A"
          />
        </Pressable>
        <View className="flex-1">
          <Text className="text-[18px] font-extrabold text-[#0F172A]">
            {resultTitle}
          </Text>
          <View className="mt-0.5 flex-row items-center">
            <MaterialCommunityIcons
              name="map-marker"
              size={13}
              color="#2563EB"
            />
            <Text
              numberOfLines={1}
              className="ml-1 text-[11px] text-[#64748B]"
            >
              {locationLabel}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 28,
          flexGrow: 1,
        }}
      >
        <View className="mb-4 overflow-hidden rounded-[20px] bg-[#2563EB] px-4 py-4">
          <View className="absolute -bottom-5 -right-2">
            <MaterialCommunityIcons
              name="city-variant"
              size={100}
              color="#93C5FD"
              style={{ opacity: 0.35 }}
            />
          </View>
          <View className="flex-row items-center">
            <MaterialCommunityIcons
              name="home-variant"
              size={48}
              color="#FFFFFF"
              style={{ marginRight: 14 }}
            />
            <View className="flex-1">
              <Text className="text-[16px] font-extrabold text-white">
                {resultTitle}
              </Text>
              <Text
                numberOfLines={1}
                className="mt-1 text-[12px] text-[#DBEAFE]"
              >
                Find your perfect stay in {nearbyAreaLabel} ✨
              </Text>
            </View>
          </View>
        </View>

        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-[14px] font-extrabold uppercase text-[#0F172A]">
            {resultMode === "gender" ? `${resultFilter} PGs` : resultTitle}
          </Text>
          {!loading && !error ? (
            <Text className="rounded-full bg-[#D1FAE5] px-2.5 py-1 text-[10px] font-bold text-[#047857]">
              {nearbyPGs.length} found
            </Text>
          ) : null}
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center py-16">
            <ActivityIndicator size="large" color="#2563EB" />
            <Text className="mt-3 text-[12px] text-[#64748B]">
              Finding PGs near you...
            </Text>
          </View>
        ) : needsLocationChoice ? (
          <View className="rounded-[20px] border border-[#FDE68A] bg-white p-4">
            <View className="flex-row items-start">
              <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-[#FEF3C7]">
                <MaterialCommunityIcons
                  name="map-marker-alert"
                  size={21}
                  color="#D97706"
                />
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-extrabold text-[#0F172A]">
                  You’re away from {selectedLocationLabel}
                </Text>
                <Text className="mt-1 text-[12px] leading-5 text-[#64748B]">
                  Would you like to use your current location or pin a spot?
                </Text>
              </View>
            </View>

            <Pressable
              onPress={useCurrentLocation}
              className="mt-4 flex-row items-center justify-center rounded-[12px] bg-[#EFF6FF] px-4 py-3"
            >
              <MaterialCommunityIcons
                name="crosshairs-gps"
                size={17}
                color="#2563EB"
              />
              <Text className="ml-2 text-[12px] font-bold text-[#1D4ED8]">
                Use my current location
              </Text>
            </Pressable>

            <Text className="mb-2 mt-5 text-[12px] font-extrabold text-[#0F172A]">
              Or pin a spot near {selectedLocationLabel}
            </Text>
            <View className="h-[280px] overflow-hidden rounded-[16px]">
              <ListingLocationMap
                initialRegion={pinMapRegion}
                selectedLocation={pinCoordinates}
                onLocationSelected={setPinCoordinates}
              />
            </View>
            <Pressable
              onPress={confirmPinnedLocation}
              disabled={!pinCoordinates}
              className={`mt-4 items-center rounded-[12px] px-4 py-3 ${
                pinCoordinates ? "bg-[#2563EB]" : "bg-[#94A3B8]"
              }`}
            >
              <Text className="text-[12px] font-extrabold text-white">
                Confirm Pin & Show PGs
              </Text>
            </Pressable>
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center rounded-[20px] bg-white px-6 py-12">
            <MaterialCommunityIcons
              name="map-marker-alert-outline"
              size={42}
              color="#2563EB"
            />
            <Text className="mt-3 text-center text-[16px] font-extrabold text-[#0F172A]">
              Location needed
            </Text>
            <Text className="mt-2 text-center text-[12px] leading-5 text-[#64748B]">
              {error}
            </Text>
            <Pressable
              onPress={() => void loadNearbyPGs()}
              className="mt-5 rounded-full bg-[#2563EB] px-6 py-3"
            >
              <Text className="text-[12px] font-bold text-white">
                Try again
              </Text>
            </Pressable>
          </View>
        ) : nearbyPGs.length === 0 ? (
          <View className="flex-1 items-center justify-center rounded-[20px] bg-white px-6 py-12">
            <MaterialCommunityIcons
              name="home-search-outline"
              size={42}
              color="#94A3B8"
            />
            <Text className="mt-3 text-center text-[16px] font-extrabold text-[#0F172A]">
              {resultMode === "search"
                ? "No matching PGs found"
                : resultMode === "area"
                  ? `No PGs found in ${nearbyAreaLabel}`
                  : `No PGs within ${MAX_DISTANCE_KM} km`}
            </Text>
            <Text className="mt-2 text-center text-[12px] leading-5 text-[#64748B]">
              {resultMode === "place"
                ? `No PG listings near a ${
                    resultFilter === "metro"
                      ? "metro station"
                      : resultFilter === "it-park"
                        ? "IT park"
                        : resultFilter === "bus"
                          ? "bus stop"
                          : "coaching hub"
                  } were found near ${nearbyAreaLabel}.`
                : resultMode === "gender"
                  ? `No ${resultFilter.toLowerCase()} PG listings were found in ${nearbyAreaLabel}.`
                  : resultMode === "area"
                    ? `There are no PG listings available for ${nearbyAreaLabel}.`
                    : resultMode === "search"
                      ? `No PG listings matched "${resultQueryParam ?? ""}". Try another name, area, or metro station.`
                  : "There are no PG listings with valid location data within 20 km of you."}
            </Text>
          </View>
        ) : (
          nearbyPGs.map(({ listing, distanceKm, proximityBadge }) => (
            <View key={listing.id} style={{ paddingBottom: 12 }}>
              <ListingCard
                listing={listing}
                imageHeight={260}
                elevated
                distanceLabel={
                  resultMode === "search" ||
                  resultMode === "place" ||
                  resultMode === "area"
                    ? undefined
                    : formatDistance(distanceKm)
                }
                proximityBadge={proximityBadge}
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
      </ScrollView>
    </SafeAreaView>
  );
}
