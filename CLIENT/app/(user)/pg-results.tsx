import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";

import ListingCard from "../../components/ListingCard";
import ListingDetailSheet from "../../components/ListingDetailSheet";
import ScheduleVisitModal from "../../components/ScheduleVisitModal";
import { USER_SCREEN_BACKGROUND } from "../../constants/userDesign";
import { useScheduledVisitsStore } from "../../store/scheduledVisitsStore";
import { useFavoritesStore } from "../../store/favoritesStore";
import { getPublicListings } from "../../services/api";
import {
  matchesAcType,
  matchesArea,
  matchesCity,
  matchesPGType,
  matchesRoomSharing,
} from "../../services/pgFilters";
import type { Listing } from "../../types/listing";
import type { NewScheduledVisit } from "../../types/visit";

type PgSearchFilters = {
  propertyType: string;
  city: string;
  areas: string[];
  types: string[];
  sharing: string[];
  acTypes: string[];
};

function firstParam(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseArray(value?: string): string[] {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export default function PgResults() {
  const [visitListing, setVisitListing] = useState<Listing | null>(null);
  const [detailListing, setDetailListing] = useState<Listing | null>(null);
  const addScheduledVisit = useScheduledVisitsStore(
    (state) => state.addVisit
  );
  const showToast = useFavoritesStore((state) => state.showToast);

  const submitVisitRequest = (visit: NewScheduledVisit) => {
    addScheduledVisit(visit);
    setVisitListing(null);
    showToast("Visit request saved for this session.");
  };

  const {
    propertyType: propertyTypeParam,
    pgCity: cityParam,
    pgAreas: areasParam,
    pgTypes: typesParam,
    pgSharing: sharingParam,
    pgAcTypes: acTypesParam,
  } = useLocalSearchParams<{
    propertyType?: string | string[];
    pgCity?: string | string[];
    pgAreas?: string | string[];
    pgTypes?: string | string[];
    pgSharing?: string | string[];
    pgAcTypes?: string | string[];
  }>();
  const propertyType = firstParam(propertyTypeParam);
  const city = firstParam(cityParam);
  const areas = firstParam(areasParam);
  const types = firstParam(typesParam);
  const sharing = firstParam(sharingParam);
  const acTypes = firstParam(acTypesParam);

  const filters = useMemo<PgSearchFilters | null>(
    () =>
      city
        ? {
            propertyType: propertyType === "Hostel" ? "Hostel" : "PG",
            city,
            areas: parseArray(areas),
            types: parseArray(types),
            sharing: parseArray(sharing),
            acTypes: parseArray(acTypes),
          }
        : null,
    [propertyType, city, areas, types, sharing, acTypes]
  );

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadListings = useCallback(
    async (forceRefresh = false) => {
      if (!filters) {
        setLoadError("The selected PG filters are incomplete.");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setLoadError(null);
      try {
        setListings(await getPublicListings({ forceRefresh }));
      } catch (error) {
        console.error("PG results listings error:", error);
        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load PG listings. Please try again."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

  const results = useMemo(
    () =>
      filters
        ? listings.filter(
            (listing) =>
              String(listing.property_type).trim().toLowerCase() ===
                filters.propertyType.toLowerCase() &&
              matchesCity(listing.city, filters.city) &&
              matchesArea(listing.area, filters.areas) &&
              matchesPGType(listing.gender, filters.types) &&
              matchesRoomSharing(listing.sharing, filters.sharing) &&
              matchesAcType(listing.ac_type, filters.acTypes)
          )
        : [],
    [filters, listings]
  );

  const editFilters = () => {
    if (!filters) return;

    router.push({
      pathname: "/(user)/PG",
      params: {
        filterMode: "edit",
        propertyType: filters.propertyType,
        pgCity: filters.city,
        pgAreas: JSON.stringify(filters.areas),
        pgTypes: JSON.stringify(filters.types),
        pgSharing: JSON.stringify(filters.sharing),
        pgAcTypes: JSON.stringify(filters.acTypes),
      },
    });
  };

  const onRefresh = () => {
    setRefreshing(true);
    void loadListings(true);
  };

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: USER_SCREEN_BACKGROUND }}
      edges={["top"]}
    >
      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 36,
          flexGrow: 1,
        }}
        ListHeaderComponent={
          <View className="pb-5">
            <View className="mb-5 flex-row items-center">
              <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-white"
              >
                <MaterialCommunityIcons
                  name="arrow-left"
                  size={21}
                  color="#0F172A"
                />
              </Pressable>
              <View className="flex-1">
                <Text className="text-[22px] font-extrabold text-[#0F172A]">
                  {filters?.propertyType ?? "PG"} Results
                </Text>
                <Text className="mt-1 text-[12px] text-[#64748B]">
                  {filters
                    ? `${filters.city} · ${filters.areas.join(", ") || "All areas"}`
                    : "Filtered stays"}
                </Text>
              </View>
              <Pressable
                onPress={editFilters}
                accessibilityRole="button"
                className="rounded-full bg-[#EAF2FF] px-4 py-2.5"
              >
                <Text className="text-[12px] font-bold text-[#2563EB]">
                  Edit
                </Text>
              </Pressable>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-[14px] font-extrabold text-[#0F172A]">
                Matching properties
              </Text>
              <Text className="text-[12px] font-bold text-[#2563EB]">
                {results.length} found
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <ListingCard
            listing={item}
            onScheduleVisit={() => setVisitListing(item)}
            onPress={() => setDetailListing(item)}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <View className="items-center pt-12">
              <ActivityIndicator size="large" color="#2563EB" />
              <Text className="mt-3 text-[12px] text-[#64748B]">
                Finding matching properties...
              </Text>
            </View>
          ) : loadError ? (
            <View className="items-center rounded-[20px] bg-white p-8">
              <Text className="text-center text-[15px] font-extrabold text-[#0F172A]">
                Couldn’t load PG results
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
                No matching properties
              </Text>
              <Text className="mt-2 text-center text-[12px] text-[#64748B]">
                Try changing your area or PG preferences.
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
  );
}
