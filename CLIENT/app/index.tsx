import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";

type RoleCardProps = {
  title: string;
  subtitle: string;
  cta: string;
  accent: string;
  accentSoft: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
};

function RoleCard({ title, subtitle, cta, accent, accentSoft, icon, onPress }: RoleCardProps) {
  const [active, setActive] = useState(false); // hover (web) or press (mobile)

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setActive(true)}
      onPressOut={() => setActive(false)}
      onHoverIn={() => setActive(true)}
      onHoverOut={() => setActive(false)}
      style={{
        flex: 1,
        maxHeight: 250,
        backgroundColor: "#FFFFFF",
        borderRadius: 30,
        padding: 22,
        justifyContent: "space-between",
        borderWidth: 2,
        borderColor: active ? accent : "#FFFFFF",
        transform: [{ scale: active ? 0.98 : 1 }],
        shadowColor: accent,
        shadowOffset: { width: 0, height: active ? 12 : 6 },
        shadowOpacity: active ? 0.28 : 0.14,
        shadowRadius: active ? 20 : 14,
        elevation: active ? 10 : 5,
      }}
    >
      {/* Top row: icon + arrow */}
      <View className="flex-row items-start justify-between">
        <View
          className="h-[76px] w-[76px] items-center justify-center rounded-[24px]"
          style={{ backgroundColor: accentSoft }}
        >
          <MaterialCommunityIcons name={icon} size={42} color={accent} />
        </View>

        <View
          className="h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: active ? accent : accentSoft }}
        >
          <MaterialCommunityIcons
            name="arrow-right"
            size={24}
            color={active ? "#FFFFFF" : accent}
          />
        </View>
      </View>

      {/* Bottom: text */}
      <View>
        <Text className="text-[26px] font-extrabold text-[#0F172A]">{title}</Text>
        <Text className="mt-1 text-[15px] leading-5 text-[#64748B]">{subtitle}</Text>

        <View
          className="mt-3 self-start rounded-full px-3 py-1.5"
          style={{ backgroundColor: accentSoft }}
        >
          <Text className="text-[12px] font-bold" style={{ color: accent }}>
            {cta}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function Index() {
  return (
    <SafeAreaView className="flex-1 bg-[#DCEBFF]">
      <View className="flex-1 overflow-hidden">
        {/* Background decorations */}
        <View className="absolute -right-24 -top-20 h-64 w-64 rounded-full bg-[#BFDBFE]" />
        <View className="absolute -left-28 top-1/3 h-72 w-72 rounded-full bg-[#C7F0E8]" />
        <View className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-[#E0E7FF]" />

        <View className="flex-1 px-5">
          {/* Title */}
          <View className="items-center pt-8">
            <Text className="text-[42px] font-extrabold tracking-tight text-[#2563EB]">
              FindEasy
            </Text>
            <Text className="mt-1 text-[15px] font-medium text-[#475569]">
              Find what you need, near you.
            </Text>
            <Text className="mt-5 text-[17px] font-semibold text-[#1E293B]">
              Choose how you want to use FindEasy
            </Text>
          </View>

          {/* Two big cards fill the remaining space */}
          <View className="flex-1 justify-center py-6" style={{ gap: 20 }}>
            <RoleCard
              title="I'M USER"
              subtitle="Find PGs and hostels near you"
              cta="Start searching"
              accent="#2563EB"
              accentSoft="#E8F1FF"
              icon="account-search"
              onPress={() => router.push({ pathname: "/login", params: { role: "user" } })}
            />

            <RoleCard
              title="I'M OWNER"
              subtitle="Add and manage your PG or hostel"
              cta="List your property"
              accent="#0D9488"
              accentSoft="#DDF7F2"
              icon="home-city"
              onPress={() => router.push("/(owner)")}
            />
          </View>

          {/* Caption */}
          <View className="items-center pb-5">
            <Text className="text-[12px] font-medium text-[#64748B]">
              Your stay. Your choice. Made easy.
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}