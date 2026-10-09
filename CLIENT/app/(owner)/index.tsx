import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from "react-native";

import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { API_BASE_URL } from "../../constants/api";

// ============================================================
// TYPES
// ============================================================

type Listing = {
  id: string;
  name: string;
  property_type: string;
  gender: string;
  description: string | null;
  monthly_price: number;
  security_deposit: number | null;
  total_beds: number;
  available_beds: number;
  filled_beds: number;
  sharing: string[];
  ac_type: string;
  facilities: string[];
  food_available: string;
  breakfast_time: string | null;
  lunch_time: string | null;
  dinner_time: string | null;
  city: string;
  area: string;
  address: string;
  latitude: string | null;
  longitude: string | null;
  restrictions: string | null;
  status: string;
};

// ============================================================
// STAT CARD
// ============================================================

function StatCard({
  icon,
  value,
  label,
  bg,
  iconBg,
}: {
  icon: string;
  value: string;
  label: string;
  bg: string;
  iconBg: string;
}) {
  return (
    <View
      className="flex-1 rounded-[22px] p-4"
      style={{
        backgroundColor: bg,
        minHeight: 125,
      }}
    >
      <View
        className="h-11 w-11 items-center justify-center rounded-[14px]"
        style={{ backgroundColor: iconBg }}
      >
        <Text className="text-[20px]">
          {icon}
        </Text>
      </View>

      <Text className="mt-4 text-[25px] font-extrabold text-[#0F172A]">
        {value}
      </Text>

      <Text className="mt-1 text-[12px] font-medium text-[#64748B]">
        {label}
      </Text>
    </View>
  );
}

// ============================================================
// LISTING CARD
// ============================================================

function ListingCard({
  listing,
}: {
  listing: Listing;
}) {
  const handleOpenListingDetails = () => {
    console.log(
      "Opening listing details:",
      listing.id
    );

    router.push({
      pathname:
        "/(owner)/listings/listing-details",
      params: {
        id: String(listing.id),
      },
    });
  };

  return (
    <Pressable
      onPress={handleOpenListingDetails}
      className="mb-4 rounded-[22px] bg-white p-4"
      style={({ pressed }) => ({
        borderWidth: 1,
        borderColor: pressed
          ? "#14B8A6"
          : "#E8EEF5",
        transform: [
          {
            scale: pressed ? 0.985 : 1,
          },
        ],
        shadowColor: "#64748B",
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 2,
      })}
    >
      <View className="flex-row">

        {/* Property Image */}

        <View className="h-[92px] w-[92px] items-center justify-center rounded-[18px] bg-[#E8F8F5]">
          <Text className="text-[36px]">
            🏠
          </Text>
        </View>

        {/* Property Information */}

        <View className="ml-4 flex-1">

          <View className="flex-row items-start justify-between">

            <Text
              className="flex-1 pr-2 text-[17px] font-extrabold text-[#0F172A]"
              numberOfLines={2}
            >
              {listing.name}
            </Text>

            <View className="rounded-full bg-[#E7F8F1] px-2.5 py-1">
              <Text className="text-[10px] font-bold capitalize text-[#0F9F75]">
                {listing.status}
              </Text>
            </View>

          </View>

          <Text
            className="mt-1 text-[12px] text-[#64748B]"
            numberOfLines={1}
          >
            📍 {listing.area}, {listing.city}
          </Text>

          <Text className="mt-2 text-[12px] font-semibold text-[#475569]">
            {listing.property_type} •{" "}
            {listing.gender}
          </Text>

          <View className="mt-2 flex-row items-center justify-between">

            <Text className="text-[15px] font-extrabold text-[#2563EB]">
              ₹{listing.monthly_price}

              <Text className="text-[10px] font-medium text-[#64748B]">
                {" "}
                / month
              </Text>
            </Text>

            <Text className="text-[11px] font-semibold text-[#64748B]">
              {listing.available_beds} beds available
            </Text>

          </View>

        </View>

      </View>

      {/* Divider */}

      <View className="mt-4 h-[1px] bg-[#EEF2F7]" />

      {/* Bottom Action */}

      <View className="mt-3 flex-row items-center justify-between">

        <Text className="text-[12px] font-semibold text-[#64748B]">
          View property details
        </Text>

        <Text className="text-[18px] font-bold text-[#2563EB]">
          →
        </Text>

      </View>

    </Pressable>
  );
}

// ============================================================
// OWNER DASHBOARD
// ============================================================

export default function OwnerDashboard() {
  const [listings, setListings] =
    useState<Listing[]>([]);

  const [loadingListings, setLoadingListings] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  // ============================================================
  // LOAD LISTINGS
  // ============================================================

  const loadListings = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoadingListings(true);
        }

        const url =
          `${API_BASE_URL}/api/v1/owner/listings`;

        console.log(
          "===================================="
        );

        console.log(
          "LOADING OWNER LISTINGS"
        );

        console.log(
          "URL:",
          url
        );

        console.log(
          "===================================="
        );

        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        console.log(
          "LISTINGS HTTP STATUS:",
          response.status
        );

        const raw =
          await response.text();

        console.log(
          "LISTINGS RAW RESPONSE:",
          raw
        );

        if (!response.ok) {
          throw new Error(
            `Failed to load listings (${response.status})`
          );
        }

        const data: Listing[] =
          raw ? JSON.parse(raw) : [];

        console.log(
          "LISTINGS COUNT:",
          data.length
        );

        console.log(
          "LISTINGS DATA:",
          JSON.stringify(
            data,
            null,
            2
          )
        );

        setListings(
          Array.isArray(data)
            ? data
            : []
        );
      } catch (error) {
        console.error(
          "LOAD LISTINGS ERROR:",
          error
        );

        Alert.alert(
          "Unable to load listings",
          "We could not load your properties. Please check your connection and try again."
        );
      } finally {
        setLoadingListings(false);
        setRefreshing(false);
      }
    },
    []
  );

  // ============================================================
  // RELOAD EVERY TIME DASHBOARD GETS FOCUS
  // ============================================================

  useFocusEffect(
    useCallback(() => {
      loadListings();

      return () => {
        // Nothing to clean up
      };
    }, [loadListings])
  );

  // ============================================================
  // STATS
  // ============================================================

  const totalProperties =
    listings.length;

  const totalAvailableBeds =
    listings.reduce(
      (total, listing) =>
        total +
        Number(
          listing.available_beds || 0
        ),
      0
    );

  // ============================================================
  // UI
  // ============================================================

  return (
    <SafeAreaView className="flex-1 bg-[#F5F9FD]">
      <View className="flex-1">

        {/* HEADER */}
        <View className="px-5 pb-4 pt-5">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-[13px] font-medium text-[#64748B]">
                Welcome back 👋
              </Text>

              <Text className="mt-1 text-[28px] font-extrabold text-[#0F172A]">
                Owner
              </Text>
            </View>

            <Pressable
              className="h-[48px] w-[48px] items-center justify-center rounded-full bg-white"
              style={{
                shadowColor: "#64748B",
                shadowOffset: {
                  width: 0,
                  height: 3,
                },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 3,
              }}
            >
              <Text className="text-[22px]">
                ⚙️
              </Text>
            </Pressable>
          </View>

          <Text className="mt-1 text-[13px] text-[#64748B]">
            Manage your PGs and hostels easily
          </Text>
        </View>

        {/* CONTENT */}
        <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 110,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadListings(true)}
          />
        }
      >

          {/* QUICK STATS */}

          <View className="mt-3 flex-row gap-3">

            <StatCard
              icon="🏠"
              value={String(
                totalProperties
              )}
              label="Properties"
              bg="#EAF2FF"
              iconBg="#D7E6FF"
            />

            <StatCard
              icon="🛏️"
              value={String(
                totalAvailableBeds
              )}
              label="Available beds"
              bg="#E8F8F5"
              iconBg="#D2F2EB"
            />

            <StatCard
              icon="💬"
              value="0"
              label="Enquiries"
              bg="#FFF5E8"
              iconBg="#FFEAC8"
            />

          </View>

          {/* ADD PROPERTY */}

          <Pressable
            onPress={() =>
              router.push(
                "/(owner)/listings/create"
              )
            }
            className="mt-6 overflow-hidden rounded-[24px] bg-[#2563EB] p-5"
            style={({ pressed }) => ({
              transform: [
                {
                  scale: pressed
                    ? 0.985
                    : 1,
                },
              ],
            })}
          >
            <View className="flex-row items-center justify-between">

              <View className="flex-1">
                <Text className="text-[19px] font-extrabold text-white">
                  Add a new property
                </Text>

                <Text className="mt-1 pr-4 text-[12px] leading-5 text-[#DBEAFE]">
                  Create your PG or hostel listing and start receiving enquiries.
                </Text>
              </View>

              <View className="h-[52px] w-[52px] items-center justify-center rounded-full bg-white/20">
                <Text className="text-[28px] font-light text-white">
                  +
                </Text>
              </View>

            </View>
          </Pressable>

          {/* LISTINGS HEADER */}

          <View className="mt-7 flex-row items-center justify-between">

            <View>
              <Text className="text-[21px] font-extrabold text-[#0F172A]">
                My Listings
              </Text>

              <Text className="mt-1 text-[12px] text-[#64748B]">
                Manage your properties
              </Text>
            </View>

            <Pressable
              onPress={() =>
                router.push(
                  "/(owner)/listings"
                )
              }
            >
              <Text className="text-[13px] font-bold text-[#2563EB]">
                View all
              </Text>
            </Pressable>

          </View>

          {/* LISTINGS */}

          {loadingListings ? (

            <View className="mt-5 items-center rounded-[24px] bg-white px-6 py-10">

              <ActivityIndicator
                size="small"
                color="#2563EB"
              />

              <Text className="mt-3 text-[13px] text-[#64748B]">
                Loading your properties...
              </Text>

            </View>

          ) : listings.length === 0 ? (

            <View className="mt-5 items-center rounded-[24px] border border-dashed border-[#CBD5E1] bg-white px-6 py-9">

              <View className="h-[64px] w-[64px] items-center justify-center rounded-full bg-[#EAF2FF]">
                <Text className="text-[28px]">
                  🏠
                </Text>
              </View>

              <Text className="mt-4 text-center text-[17px] font-extrabold text-[#0F172A]">
                No properties yet
              </Text>

              <Text className="mt-2 text-center text-[13px] leading-5 text-[#64748B]">
                Add your first PG or hostel to start managing your property.
              </Text>

              <Pressable
                onPress={() =>
                  router.push(
                    "/(owner)/listings/create"
                  )
                }
                className="mt-5 rounded-full bg-[#14B8A6] px-6 py-3"
              >
                <Text className="text-[13px] font-bold text-white">
                  + Add Property
                </Text>
              </Pressable>

            </View>

          ) : (

            <View className="mt-5">

              {listings.map(
                (listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                  />
                )
              )}

            </View>

          )}

          {/* RECENT PROPERTIES */}

          {listings.length > 0 && (
            <View className="mt-4 mb-4">

              <Text className="text-[13px] text-[#64748B]">
                {listings.length}{" "}
                {listings.length === 1
                  ? "property"
                  : "properties"}{" "}
                loaded from server
              </Text>

            </View>
          )}

        </ScrollView>

        {/* BOTTOM NAVIGATION */}

        <View
          className="absolute bottom-0 left-0 right-0 bg-white"
          style={{
            borderTopWidth: 1,
            borderTopColor: "#E8EEF5",
            paddingBottom: 10,
          }}
        >

          <View className="h-[68px] flex-row items-center justify-around">

            <Pressable
              className="items-center"
              onPress={() =>
                router.replace(
                  "/(owner)"
                )
              }
            >
              <View className="h-9 w-9 items-center justify-center rounded-full bg-[#EAF2FF]">
                <Text className="text-[18px]">
                  ⌂
                </Text>
              </View>

              <Text className="mt-1 text-[10px] font-bold text-[#2563EB]">
                Home
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                router.push(
                  "/(owner)/listings"
                )
              }
              className="items-center"
            >
              <Text className="text-[21px]">
                🏠
              </Text>

              <Text className="mt-1 text-[10px] font-medium text-[#64748B]">
                Listings
              </Text>
            </Pressable>

            <Pressable
              className="items-center"
            >
              <Text className="text-[21px]">
                💬
              </Text>

              <Text className="mt-1 text-[10px] font-medium text-[#64748B]">
                Enquiries
              </Text>
            </Pressable>

            
          <Pressable
            className="items-center"
            onPress={() => router.push("/(owner)/profile")}
          >
            <Text className="text-[21px]">
              👤
            </Text>

            <Text className="mt-1 text-[10px] font-medium text-[#64748B]">
              Profile
            </Text>
          </Pressable>


          </View>

        </View>

      </View>
    </SafeAreaView>
  );
}