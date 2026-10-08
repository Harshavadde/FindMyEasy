import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";

export default function Category() {
  return (
    <SafeAreaView className="flex-1 bg-white">

      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-4">
        <Text className="text-3xl font-extrabold text-[#2563EB]">
          FindEasy
        </Text>

        <Pressable
          onPress={() => router.push("/(user)/profile")}
          className="h-11 w-11 items-center justify-center rounded-full bg-[#E8F1FF]"
        >
          <MaterialCommunityIcons
            name="account"
            size={25}
            color="#2563EB"
          />
        </Pressable>
      </View>

      {/* Main Content */}
      <View className="flex-1 px-5 pt-10">

        <Text className="text-2xl font-bold text-[#0F172A]">
          What are you looking for?
        </Text>

        <Text className="mt-2 text-base text-[#64748B]">
          Find a comfortable place to stay near you.
        </Text>

        {/* Categories */}
        <View className="mt-8 flex-row gap-4">

          {/* PG */}
          <Pressable
            onPress={() => router.push("/(user)/PG")}
            className="flex-1 rounded-3xl border border-[#DBEAFE] bg-[#EFF6FF] p-5"
          >
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-white">
              <MaterialCommunityIcons
                name="home-city"
                size={32}
                color="#2563EB"
              />
            </View>

            <Text className="mt-5 text-xl font-bold text-[#0F172A]">
              PG
            </Text>

            <Text className="mt-1 text-sm text-[#64748B]">
              Find paying guest accommodation
            </Text>
          </Pressable>

          {/* Hostel */}
          <Pressable
            onPress={() => router.push("/(user)/hostel")}
            className="flex-1 rounded-3xl border border-[#CCFBF1] bg-[#F0FDFA] p-5"
          >
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-white">
              <MaterialCommunityIcons
                name="office-building"
                size={32}
                color="#0D9488"
              />
            </View>

            <Text className="mt-5 text-xl font-bold text-[#0F172A]">
              Hostel
            </Text>

            <Text className="mt-1 text-sm text-[#64748B]">
              Find hostels near you
            </Text>
          </Pressable>

        </View>
      </View>

      {/* Bottom Navigation */}
      <View className="flex-row border-t border-[#E2E8F0] bg-white px-5 py-4">

        {/* Home */}
        <Pressable
          onPress={() => router.replace("/(user)/selectyourFinding/category")}
          className="flex-1 items-center"
        >
          <MaterialCommunityIcons
            name="home"
            size={25}
            color="#2563EB"
          />

          <Text className="mt-1 text-xs font-semibold text-[#2563EB]">
            Home
          </Text>
        </Pressable>

        {/* Search */}
        <Pressable
          onPress={() => router.push("/(user)/search")}
          className="flex-1 items-center"
        >
          <MaterialCommunityIcons
            name="magnify"
            size={25}
            color="#64748B"
          />

          <Text className="mt-1 text-xs text-[#64748B]">
            Search
          </Text>
        </Pressable>

        {/* Favorites */}
        <Pressable
          onPress={() => router.push("/(user)/favorites")}
          className="flex-1 items-center"
        >
          <MaterialCommunityIcons
            name="heart-outline"
            size={25}
            color="#64748B"
          />

          <Text className="mt-1 text-xs text-[#64748B]">
            Favorites
          </Text>
        </Pressable>

      </View>

    </SafeAreaView>
  );
}