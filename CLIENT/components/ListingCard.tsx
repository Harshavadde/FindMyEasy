import {
  Image,
  Pressable,
  Text,
  View,
} from "react-native";

import type { Listing } from "../types/listing";

type Props = {
  listing: Listing;
  onPress?: () => void;
};

export default function ListingCard({
  listing,
  onPress,
}: Props) {
  const coverImage =
    listing.images?.find(
      (image) =>
        image.image_type?.toUpperCase() ===
        "COVER"
    ) ??
    listing.images?.[0];

  return (
    <Pressable
      onPress={onPress}
      className="mb-4 overflow-hidden rounded-[20px] bg-white"
      style={{
        borderWidth: 1,
        borderColor: "#E8EEF5",
      }}
    >
      {coverImage?.url ? (
        <Image
          source={{
            uri: coverImage.url,
          }}
          className="h-[190px] w-full"
          resizeMode="cover"
        />
      ) : (
        <View className="h-[190px] w-full items-center justify-center bg-[#EAF2FF]">
          <Text className="text-[40px]">
            🏠
          </Text>

          <Text className="mt-2 text-[12px] font-bold text-[#64748B]">
            No property photo
          </Text>
        </View>
      )}

      <View className="p-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text
              className="text-[17px] font-extrabold text-[#0F172A]"
              numberOfLines={1}
            >
              {listing.name}
            </Text>

            <Text
              className="mt-1 text-[12px] text-[#64748B]"
              numberOfLines={1}
            >
              {listing.area}, {listing.city}
            </Text>
          </View>

          <View className="rounded-full bg-[#EFF6FF] px-3 py-1">
            <Text className="text-[10px] font-extrabold text-[#2563EB]">
              {listing.property_type}
            </Text>
          </View>
        </View>

        <View className="mt-4 flex-row items-end justify-between">
          <View>
            <Text className="text-[19px] font-extrabold text-[#0F172A]">
              ₹{listing.monthly_price.toLocaleString("en-IN")}
            </Text>

            <Text className="text-[10px] text-[#64748B]">
              per month
            </Text>
          </View>

          <Text className="text-[12px] font-bold text-[#16A34A]">
            {listing.available_beds} beds available
          </Text>
        </View>

        <View className="mt-3 flex-row flex-wrap">
          <View className="mr-2 rounded-full bg-[#F8FAFC] px-3 py-1.5">
            <Text className="text-[10px] font-bold text-[#475569]">
              {listing.gender}
            </Text>
          </View>

          <View className="mr-2 rounded-full bg-[#F8FAFC] px-3 py-1.5">
            <Text className="text-[10px] font-bold text-[#475569]">
              {listing.ac_type}
            </Text>
          </View>

          {listing.facilities
            .slice(0, 2)
            .map((facility) => (
              <View
                key={facility}
                className="mr-2 rounded-full bg-[#F8FAFC] px-3 py-1.5"
              >
                <Text className="text-[10px] font-bold text-[#475569]">
                  {facility}
                </Text>
              </View>
            ))}
        </View>
      </View>
    </Pressable>
  );
}