import { useCallback, useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

import { router } from "expo-router";

import ListingCard from "../../components/ListingCard";
import {
  getPublicListings,
} from "../../services/api";

import type { Listing } from "../../types/listing";

export default function UserHome() {
  const [listings, setListings] =
    useState<Listing[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const loadListings = useCallback(
    async () => {
      try {
        const data =
          await getPublicListings();

        setListings(data);
      } catch (error: any) {
        console.error(
          "User listings error:",
          error
        );

        Alert.alert(
          "Unable to load properties",
          error?.message ||
            "Please check your internet connection and try again."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadListings();
  };

  return (
    <View className="flex-1 bg-[#F5F9FD]">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 55,
          paddingBottom: 40,
        }}
      >
        <Text className="text-[13px] font-bold text-[#2563EB]">
          FindMyEasy
        </Text>

        <Text className="mt-1 text-[27px] font-extrabold text-[#0F172A]">
          Find your perfect stay
        </Text>

        <Text className="mt-2 text-[13px] leading-5 text-[#64748B]">
          Explore PGs and hostels from owners around you.
        </Text>

        <View className="mt-6 rounded-[18px] bg-[#2563EB] p-5">
          <Text className="text-[12px] font-bold text-[#BFDBFE]">
            AVAILABLE PROPERTIES
          </Text>

          <Text className="mt-1 text-[28px] font-extrabold text-white">
            {listings.length}
          </Text>

          <Text className="mt-1 text-[11px] text-[#DBEAFE]">
            PGs & hostels available right now
          </Text>
        </View>

        <View className="mt-7 flex-row items-center justify-between">
          <View>
            <Text className="text-[19px] font-extrabold text-[#0F172A]">
              All Properties
            </Text>

            <Text className="mt-1 text-[11px] text-[#64748B]">
              Properties from all owners
            </Text>
          </View>

          <Text className="text-[12px] font-bold text-[#2563EB]">
            {listings.length} found
          </Text>
        </View>

        <View className="mt-4">
          {loading ? (
            <View className="items-center py-16">
              <ActivityIndicator
                size="large"
                color="#2563EB"
              />

              <Text className="mt-3 text-[12px] text-[#64748B]">
                Loading properties...
              </Text>
            </View>
          ) : listings.length === 0 ? (
            <View className="items-center rounded-[20px] bg-white p-8">
              <Text className="text-[42px]">
                🏠
              </Text>

              <Text className="mt-4 text-center text-[17px] font-extrabold text-[#0F172A]">
                No properties found
              </Text>

              <Text className="mt-2 text-center text-[12px] leading-5 text-[#64748B]">
                No PGs or hostels have been added yet.
              </Text>
            </View>
          ) : (
            listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onPress={() =>
                  router.push({
                    pathname:
                      "/(user)/listing/[id]",
                    params: {
                      id: listing.id,
                    },
                  })
                }
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}