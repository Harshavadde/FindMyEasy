import { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  router,
  useLocalSearchParams,
} from "expo-router";

import {
  getPublicListing,
} from "../../../services/api";

import type { Listing } from "../../../types/listing";

export default function UserListingDetails() {
  const params =
    useLocalSearchParams<{
      id?: string | string[];
    }>();

  const listingId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [listing, setListing] =
    useState<Listing | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    if (!listingId) {
      setLoading(false);
      return;
    }

    loadListing();
  }, [listingId]);

  const loadListing = async () => {
    try {
      const data =
        await getPublicListing(listingId!);

      setListing(data);
    } catch (error: any) {
      console.error(
        "Listing details error:",
        error
      );

      Alert.alert(
        "Unable to load property",
        error?.message ||
          "This property could not be loaded.",
        [
          {
            text: "Go Back",
            onPress: () => router.back(),
          },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const openMaps = async () => {
    if (
      !listing?.latitude ||
      !listing?.longitude
    ) {
      Alert.alert(
        "Location unavailable",
        "This property does not have map coordinates."
      );
      return;
    }

    const url =
      `https://www.google.com/maps/search/?api=1` +
      `&query=${listing.latitude},${listing.longitude}`;

    await Linking.openURL(url);
  };

  const callOwner = async () => {
    if (!listing?.owner_phone) {
      Alert.alert(
        "Phone unavailable",
        "Owner phone number is not available."
      );
      return;
    }

    await Linking.openURL(
      `tel:${listing.owner_phone}`
    );
  };

  const whatsappOwner = async () => {
    if (!listing?.owner_phone) {
      Alert.alert(
        "Phone unavailable",
        "Owner phone number is not available."
      );
      return;
    }

    const phone =
      listing.owner_phone.replace(
        /[^0-9]/g,
        ""
      );

    const url =
      `https://wa.me/${phone}`;

    await Linking.openURL(url);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F9FD]">
        <ActivityIndicator
          size="large"
          color="#2563EB"
        />

        <Text className="mt-3 text-[12px] text-[#64748B]">
          Loading property...
        </Text>
      </View>
    );
  }

  if (!listing) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F9FD] px-6">
        <Text className="text-[18px] font-extrabold text-[#0F172A]">
          Property not found
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F5F9FD]">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 120,
        }}
      >
        <View className="bg-white">
          {listing.images?.length > 0 &&
          listing.images[0]?.url ? (
            <Image
              source={{
                uri: listing.images[0].url,
              }}
              className="h-[270px] w-full"
              resizeMode="cover"
            />
          ) : (
            <View className="h-[270px] w-full items-center justify-center bg-[#EAF2FF]">
              <Text className="text-[55px]">
                🏠
              </Text>
            </View>
          )}

          <Pressable
            onPress={() => router.back()}
            className="absolute left-5 top-12 h-11 w-11 items-center justify-center rounded-full bg-white"
          >
            <Text className="text-[25px] text-[#0F172A]">
              ‹
            </Text>
          </Pressable>
        </View>

        <View className="p-5">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-[25px] font-extrabold text-[#0F172A]">
                {listing.name}
              </Text>

              <Text className="mt-2 text-[13px] text-[#64748B]">
                {listing.area}, {listing.city}
              </Text>
            </View>

            <View className="rounded-full bg-[#EFF6FF] px-3 py-2">
              <Text className="text-[11px] font-extrabold text-[#2563EB]">
                {listing.property_type}
              </Text>
            </View>
          </View>

          <View className="mt-5 rounded-[18px] bg-white p-4">
            <Text className="text-[12px] text-[#64748B]">
              Monthly Rent
            </Text>

            <Text className="mt-1 text-[25px] font-extrabold text-[#0F172A]">
              ₹{listing.monthly_price.toLocaleString("en-IN")}
            </Text>

            <Text className="mt-1 text-[11px] text-[#64748B]">
              Security deposit: ₹
              {(
                listing.security_deposit || 0
              ).toLocaleString("en-IN")}
            </Text>
          </View>

          <View className="mt-4 rounded-[18px] bg-white p-4">
            <Text className="text-[16px] font-extrabold text-[#0F172A]">
              Availability
            </Text>

            <View className="mt-4 flex-row">
              <InfoItem
                label="Available"
                value={`${listing.available_beds}`}
              />

              <InfoItem
                label="Total beds"
                value={`${listing.total_beds}`}
              />

              <InfoItem
                label="Sharing"
                value={
                  listing.sharing.join(", ") ||
                  "-"
                }
              />
            </View>
          </View>

          {listing.description ? (
            <Section
              title="About this property"
            >
              <Text className="text-[13px] leading-6 text-[#475569]">
                {listing.description}
              </Text>
            </Section>
          ) : null}

          <Section title="Property Details">
            <DetailRow
              label="For"
              value={listing.gender}
            />

            <DetailRow
              label="AC"
              value={listing.ac_type}
            />

            <DetailRow
              label="Food"
              value={
                listing.food_available
              }
            />

            <DetailRow
              label="Address"
              value={listing.address}
            />
          </Section>

          {listing.facilities.length > 0 && (
            <Section title="Facilities">
              <View className="flex-row flex-wrap">
                {listing.facilities.map(
                  (facility) => (
                    <View
                      key={facility}
                      className="mb-2 mr-2 rounded-full bg-[#EFF6FF] px-3 py-2"
                    >
                      <Text className="text-[11px] font-bold text-[#2563EB]">
                        ✓ {facility}
                      </Text>
                    </View>
                  )
                )}
              </View>
            </Section>
          )}

          {listing.food_available === "Yes" && (
            <Section title="Food Timings">
              <DetailRow
                label="Breakfast"
                value={
                  listing.breakfast_time ||
                  "-"
                }
              />

              <DetailRow
                label="Lunch"
                value={
                  listing.lunch_time || "-"
                }
              />

              <DetailRow
                label="Dinner"
                value={
                  listing.dinner_time ||
                  "-"
                }
              />
            </Section>
          )}

          {listing.restrictions ? (
            <Section title="Rules & Restrictions">
              <Text className="text-[13px] leading-6 text-[#475569]">
                {listing.restrictions}
              </Text>
            </Section>
          ) : null}

          <Section title="Location">
            <Text className="text-[13px] leading-6 text-[#475569]">
              {listing.address}
            </Text>

            {listing.latitude &&
            listing.longitude ? (
              <Text className="mt-2 text-[11px] text-[#64748B]">
                {listing.latitude},{" "}
                {listing.longitude}
              </Text>
            ) : null}

            <Pressable
              onPress={openMaps}
              className="mt-4 h-[50px] items-center justify-center rounded-[14px] bg-[#EFF6FF]"
            >
              <Text className="text-[13px] font-extrabold text-[#2563EB]">
                🗺️ Get Directions
              </Text>
            </Pressable>
          </Section>
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 flex-row border-t border-[#E2E8F0] bg-white px-5 pb-7 pt-4">
        <Pressable
          onPress={callOwner}
          className="mr-2 flex-1 items-center justify-center rounded-[15px] bg-[#16A34A] py-4"
        >
          <Text className="text-[13px] font-extrabold text-white">
            📞 Call
          </Text>
        </Pressable>

        <Pressable
          onPress={whatsappOwner}
          className="ml-2 flex-1 items-center justify-center rounded-[15px] bg-[#25D366] py-4"
        >
          <Text className="text-[13px] font-extrabold text-white">
            WhatsApp
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mt-4 rounded-[18px] bg-white p-4">
      <Text className="mb-4 text-[16px] font-extrabold text-[#0F172A]">
        {title}
      </Text>

      {children}
    </View>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View className="mr-5">
      <Text className="text-[11px] text-[#64748B]">
        {label}
      </Text>

      <Text className="mt-1 text-[14px] font-extrabold text-[#0F172A]">
        {value}
      </Text>
    </View>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View className="mb-3 flex-row">
      <Text className="w-[110px] text-[12px] font-bold text-[#64748B]">
        {label}
      </Text>

      <Text className="flex-1 text-[12px] font-semibold text-[#334155]">
        {value}
      </Text>
    </View>
  );
}