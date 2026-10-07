import { useState } from "react";

import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  View,
} from "react-native";

import { router } from "expo-router";

import ListingCard from "../../components/ListingCard";
import { getPublicListings } from "../../services/api";
import type { Listing } from "../../types/listing";

export default function UserSearch() {
  const [query, setQuery] =
    useState("");

  const [results, setResults] =
    useState<Listing[]>([]);

  const [loading, setLoading] =
    useState(false);

  const search = async () => {
    const value = query.trim();

    if (!value) {
      setResults([]);
      return;
    }

    setLoading(true);

    try {
      const data =
        await getPublicListings({
          city: value,
          area: value,
        });

      setResults(data);
    } catch (error) {
      console.error(
        "Search error:",
        error
      );

      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-[#F5F9FD]">
      <View className="px-5 pb-4 pt-14">
        <Text className="text-[25px] font-extrabold text-[#0F172A]">
          Search
        </Text>

        <Text className="mt-1 text-[12px] text-[#64748B]">
          Find PGs and hostels by city or area
        </Text>

        <View className="mt-5 flex-row">
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={search}
            placeholder="Hyderabad, Madhapur..."
            placeholderTextColor="#94A3B8"
            returnKeyType="search"
            className="h-[52px] flex-1 rounded-[15px] bg-white px-4 text-[14px] text-[#0F172A]"
            style={{
              borderWidth: 1,
              borderColor: "#E2E8F0",
            }}
          />

          <View className="ml-2">
            <Text
              onPress={search}
              className="rounded-[15px] bg-[#2563EB] px-5 py-4 text-[13px] font-extrabold text-white"
            >
              Search
            </Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View className="items-center pt-16">
          <ActivityIndicator
            size="large"
            color="#2563EB"
          />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) =>
            item.id
          }
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 40,
          }}
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              onPress={() =>
                router.push({
                  pathname:
                    "/(user)/listing/[id]",
                  params: {
                    id: item.id,
                  },
                })
              }
            />
          )}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-[40px]">
                🔍
              </Text>

              <Text className="mt-4 text-[16px] font-extrabold text-[#0F172A]">
                Search for a property
              </Text>

              <Text className="mt-2 text-center text-[12px] text-[#64748B]">
                Search using a city or area name.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}