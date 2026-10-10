import { useState } from "react";

import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { router } from "expo-router";

import { getPublicListings } from "../../services/api";
import type { Listing } from "../../types/listing";

export default function UserFilters() {
  const [propertyType, setPropertyType] =
    useState("");

  const [gender, setGender] =
    useState("");

  const [minPrice, setMinPrice] =
    useState("");

  const [maxPrice, setMaxPrice] =
    useState("");

  const [city, setCity] =
    useState("Hyderabad");

  const applyFilters = async () => {
    try {
      const listings =
        await getPublicListings({
          city,
          property_type:
            propertyType || undefined,
          gender:
            gender || undefined,
          min_price: minPrice
            ? Number(minPrice)
            : undefined,
          max_price: maxPrice
            ? Number(maxPrice)
            : undefined,
        });

      router.push({
        pathname:
          "/(user)/search",
      });

      console.log(
        "Filtered listings:",
        listings.length
      );
    } catch (error: any) {
      Alert.alert(
        "Filter failed",
        error?.message ||
          "Unable to apply filters."
      );
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-[#F5F9FD]"
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: 55,
        paddingBottom: 50,
      }}
    >
      <Text className="text-[25px] font-extrabold text-[#0F172A]">
        Filters
      </Text>

      <Text className="mt-1 text-[12px] text-[#64748B]">
        Narrow down properties based on your needs
      </Text>

      <Text className="mb-2 mt-7 text-[13px] font-bold text-[#334155]">
        City
      </Text>

      <TextInput
        value={city}
        onChangeText={setCity}
        placeholder="Hyderabad"
        placeholderTextColor="#94A3B8"
        className="h-[50px] rounded-[15px] bg-white px-4 text-[14px]"
        style={{
          borderWidth: 1,
          borderColor: "#E2E8F0",
        }}
      />

      <FilterSection title="Property Type">
        {["PG", "Hostel"].map(
          (item) => (
            <Choice
              key={item}
              label={item}
              selected={
                propertyType === item
              }
              onPress={() =>
                setPropertyType(
                  propertyType === item
                    ? ""
                    : item
                )
              }
            />
          )
        )}
      </FilterSection>

      <FilterSection title="For">
        {[
          "Boy's",
          "Girl's",
          "Co-living",
        ].map((item) => (
          <Choice
            key={item}
            label={item}
            selected={gender === item}
            onPress={() =>
              setGender(
                gender === item
                  ? ""
                  : item
              )
            }
          />
        ))}
      </FilterSection>

      <FilterSection title="Price Range">
        <View className="flex-row">
          <TextInput
            value={minPrice}
            onChangeText={(value) =>
              setMinPrice(
                value.replace(
                  /[^0-9]/g,
                  ""
                )
              )
            }
            keyboardType="number-pad"
            placeholder="Min ₹"
            placeholderTextColor="#94A3B8"
            className="mr-2 h-[50px] flex-1 rounded-[15px] bg-white px-4 text-[14px]"
            style={{
              borderWidth: 1,
              borderColor: "#E2E8F0",
            }}
          />

          <TextInput
            value={maxPrice}
            onChangeText={(value) =>
              setMaxPrice(
                value.replace(
                  /[^0-9]/g,
                  ""
                )
              )
            }
            keyboardType="number-pad"
            placeholder="Max ₹"
            placeholderTextColor="#94A3B8"
            className="ml-2 h-[50px] flex-1 rounded-[15px] bg-white px-4 text-[14px]"
            style={{
              borderWidth: 1,
              borderColor: "#E2E8F0",
            }}
          />
        </View>
      </FilterSection>

      <Pressable
        onPress={applyFilters}
        className="mt-8 h-[56px] items-center justify-center rounded-[17px] bg-[#2563EB]"
      >
        <Text className="text-[15px] font-extrabold text-white">
          Apply Filters
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mt-7">
      <Text className="mb-3 text-[14px] font-extrabold text-[#0F172A]">
        {title}
      </Text>

      <View className="flex-row flex-wrap">
        {children}
      </View>
    </View>
  );
}

function Choice({
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
      className={`mb-2 mr-2 rounded-full px-4 py-3 ${
        selected
          ? "bg-[#2563EB]"
          : "bg-white"
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