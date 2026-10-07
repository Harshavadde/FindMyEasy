import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  router,
  useFocusEffect,
} from "expo-router";

import { API_BASE_URL } from "../../../constants/api";

type Listing = {
  id: string;

  owner_phone: string | null;

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

export default function MyListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState("");

  const handleAddListing = () => {
    router.push("/(owner)/listings/create");
  };

  const loadListings = async (
    showRefreshing = false
  ) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const url =
        `${API_BASE_URL}/api/v1/owner/listings`;

      console.log("Loading listings:", url);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      const responseText = await response.text();

      let data: any = null;

      try {
        data = responseText
          ? JSON.parse(responseText)
          : null;
      } catch {
        data = null;
      }

      if (!response.ok) {
        const message =
          typeof data?.detail === "string"
            ? data.detail
            : `Failed to load listings (${response.status})`;

        throw new Error(message);
      }

      if (Array.isArray(data)) {
        setListings(data);
      } else {
        setListings([]);
      }
    } catch (error: any) {
      console.error(
        "Failed to load listings:",
        error
      );

      Alert.alert(
        "Unable to load listings",
        error?.message ||
          "Something went wrong while loading your properties."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadListings();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadListings();
    }, [])
  );

  const filteredListings = useMemo(() => {
    const query = searchText
      .trim()
      .toLowerCase();

    if (!query) {
      return listings;
    }

    return listings.filter((listing) => {
      return (
        listing.name
          ?.toLowerCase()
          .includes(query) ||
        listing.city
          ?.toLowerCase()
          .includes(query) ||
        listing.area
          ?.toLowerCase()
          .includes(query) ||
        listing.property_type
          ?.toLowerCase()
          .includes(query)
      );
    });
  }, [listings, searchText]);

  const openListingDetails = (
    listingId: string
  ) => {
    router.push({
      pathname:
        "/(owner)/listings/listing-details",
      params: {
        id: String(listingId),
      },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F5F9FD]">
      <View className="flex-1">

        {/* Header */}

        <View className="border-b border-[#E8EEF5] bg-[#F5F9FD] px-5 pb-4 pt-4">
          <View className="flex-row items-center justify-between">

            <View className="flex-row items-center">

              <Pressable
                onPress={() => router.back()}
                className="mr-3 h-11 w-11 items-center justify-center rounded-full bg-white"
                style={({ pressed }) => ({
                  transform: [
                    {
                      scale: pressed ? 0.94 : 1,
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

              <View>
                <Text className="text-[25px] font-extrabold text-[#0F172A]">
                  My Listings
                </Text>

                <Text className="mt-1 text-[12px] text-[#64748B]">
                  Manage your PGs and hostels
                </Text>
              </View>

            </View>

            <Pressable
              onPress={handleAddListing}
              className="h-11 w-11 items-center justify-center rounded-full bg-[#2563EB]"
              style={({ pressed }) => ({
                transform: [
                  {
                    scale: pressed ? 0.94 : 1,
                  },
                ],
                shadowColor: "#2563EB",
                shadowOffset: {
                  width: 0,
                  height: 3,
                },
                shadowOpacity: 0.2,
                shadowRadius: 7,
                elevation: 3,
              })}
            >
              <Text className="text-[27px] font-light text-white">
                +
              </Text>
            </Pressable>

          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() =>
                loadListings(true)
              }
            />
          }
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: 40,
          }}
        >

          {/* Search */}

          <View
            className="flex-row items-center rounded-[18px] bg-white px-4"
            style={{
              height: 54,
              borderWidth: 1,
              borderColor: "#E5EAF0",
            }}
          >
            <Text className="mr-3 text-[20px] text-[#94A3B8]">
              ⌕
            </Text>

            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search your properties..."
              placeholderTextColor="#94A3B8"
              className="flex-1 text-[14px] text-[#0F172A]"
            />
          </View>

          {/* Count */}

          <View className="mt-5 flex-row items-center justify-between">

            <View>
              <Text className="text-[18px] font-extrabold text-[#0F172A]">
                Properties
              </Text>

              <Text className="mt-1 text-[12px] text-[#64748B]">
                {listings.length}{" "}
                {listings.length === 1
                  ? "property"
                  : "properties"}
              </Text>
            </View>

            <View className="rounded-full bg-white px-4 py-2.5">
              <Text className="text-[12px] font-bold text-[#475569]">
                All
              </Text>
            </View>

          </View>

          {/* Loading */}

          {loading ? (
            <View className="items-center py-16">

              <ActivityIndicator
                size="large"
                color="#2563EB"
              />

              <Text className="mt-3 text-[13px] text-[#64748B]">
                Loading your properties...
              </Text>

            </View>
          ) : listings.length === 0 ? (

            /* Empty State */

            <View
              className="mt-5 items-center rounded-[26px] bg-white px-6 py-10"
              style={{
                borderWidth: 1,
                borderColor: "#E4EAF1",
                borderStyle: "dashed",
              }}
            >

              <View className="h-[88px] w-[88px] items-center justify-center rounded-full bg-[#EAF2FF]">

                <View className="h-[42px] w-[52px] items-center justify-end rounded-[8px] bg-[#2563EB]">

                  <View className="mb-2 flex-row gap-2">
                    <View className="h-[12px] w-[9px] rounded-[2px] bg-white" />
                    <View className="h-[12px] w-[9px] rounded-[2px] bg-white" />
                    <View className="h-[12px] w-[9px] rounded-[2px] bg-white" />
                  </View>

                </View>

                <View className="absolute bottom-[22px] h-[17px] w-[10px] rounded-t-[3px] bg-white" />

              </View>

              <Text className="mt-6 text-center text-[20px] font-extrabold text-[#0F172A]">
                No properties yet
              </Text>

              <Text className="mt-2 max-w-[280px] text-center text-[13px] leading-5 text-[#64748B]">
                Add your first PG or hostel to
                start managing your property and
                receiving enquiries.
              </Text>

              <Pressable
                onPress={handleAddListing}
                className="mt-6 flex-row items-center rounded-full bg-[#14B8A6] px-6 py-3.5"
                style={({ pressed }) => ({
                  transform: [
                    {
                      scale: pressed ? 0.97 : 1,
                    },
                  ],
                  shadowColor: "#14B8A6",
                  shadowOffset: {
                    width: 0,
                    height: 3,
                  },
                  shadowOpacity: 0.18,
                  shadowRadius: 7,
                  elevation: 3,
                })}
              >
                <Text className="mr-2 text-[20px] font-medium text-white">
                  +
                </Text>

                <Text className="text-[14px] font-extrabold text-white">
                  Add Property
                </Text>
              </Pressable>

            </View>

          ) : filteredListings.length === 0 ? (

            /* Search Empty */

            <View className="mt-5 items-center rounded-[26px] bg-white px-6 py-10">

              <Text className="text-[18px] font-extrabold text-[#0F172A]">
                No matching properties
              </Text>

              <Text className="mt-2 text-center text-[13px] leading-5 text-[#64748B]">
                Try searching with a different
                property name, area or city.
              </Text>

            </View>

          ) : (

            /* Listings */

            <View className="mt-5">

              {filteredListings.map(
                (listing) => (
                  <Pressable
                    key={listing.id}
                    onPress={() =>
                      openListingDetails(
                        listing.id
                      )
                    }
                    className="mb-4 rounded-[26px] bg-white p-4"
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.92 : 1,
                      transform: [
                        {
                          scale: pressed
                            ? 0.985
                            : 1,
                        },
                      ],
                      shadowColor: "#64748B",
                      shadowOffset: {
                        width: 0,
                        height: 2,
                      },
                      shadowOpacity: 0.06,
                      shadowRadius: 8,
                      elevation: 2,
                    })}
                  >

                    {/* Property Summary */}

                    <View className="flex-row">

                      <View className="h-[104px] w-[104px] items-center justify-center rounded-[20px] bg-[#EAF7F5]">
                        <Text className="text-[48px]">
                          🏠
                        </Text>
                      </View>

                      <View className="ml-4 flex-1">

                        <View className="flex-row items-start justify-between">

                          <Text
                            numberOfLines={2}
                            className="flex-1 pr-2 text-[17px] font-extrabold text-[#111827]"
                          >
                            {listing.name}
                          </Text>

                          <View className="rounded-full bg-[#E8F8F0] px-2.5 py-1">
                            <Text className="text-[10px] font-bold capitalize text-[#159A68]">
                              {listing.status}
                            </Text>
                          </View>

                        </View>

                        <Text
                          numberOfLines={1}
                          className="mt-2 text-[12px] text-[#64748B]"
                        >
                          📍 {listing.area},{" "}
                          {listing.city}
                        </Text>

                        <Text className="mt-2 text-[13px] font-semibold text-[#475569]">
                          {listing.property_type}
                          {" • "}
                          {listing.gender}
                        </Text>

                        <View className="mt-2 flex-row items-center justify-between">

                          <View className="flex-row items-baseline">

                            <Text className="text-[18px] font-extrabold text-[#2563EB]">
                              ₹{listing.monthly_price}
                            </Text>

                            <Text className="ml-1 text-[11px] text-[#64748B]">
                              / month
                            </Text>

                          </View>

                          <Text className="text-[12px] font-semibold text-[#475569]">
                            {listing.available_beds}{" "}
                            beds available
                          </Text>

                        </View>

                      </View>

                    </View>

                    {/* Divider */}

                    <View className="my-4 h-[1px] bg-[#E8EEF5]" />

                    {/* Manage */}

                    <View className="flex-row items-center justify-between">

                      <Text className="text-[13px] font-medium text-[#64748B]">
                        View property details
                      </Text>

                      <Text className="text-[20px] font-medium text-[#2563EB]">
                        →
                      </Text>

                    </View>

                  </Pressable>
                )
              )}

            </View>
          )}

          {/* Information */}

          <View className="mt-2 rounded-[20px] bg-[#EAF2FF] p-4">

            <View className="flex-row items-start">

              <View className="h-9 w-9 items-center justify-center rounded-full bg-[#D7E6FF]">
                <Text className="text-[16px] font-bold text-[#2563EB]">
                  i
                </Text>
              </View>

              <View className="ml-3 flex-1">

                <Text className="text-[14px] font-bold text-[#1E3A8A]">
                  Manage your properties
                </Text>

                <Text className="mt-1 text-[12px] leading-5 text-[#475569]">
                  Tap any property to view all the
                  information saved for that PG or
                  hostel.
                </Text>

              </View>

            </View>

          </View>

        </ScrollView>
      </View>
    </SafeAreaView>
  );
}