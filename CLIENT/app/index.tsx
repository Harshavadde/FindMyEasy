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
        minHeight: 190,
        backgroundColor: "#FFFFFF",
        borderRadius: 28,
        padding: 20,
        justifyContent: "space-between",
        borderWidth: 1,
        borderColor: active ? accent : "#DBEAFE",
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
          className="h-[58px] w-[58px] items-center justify-center rounded-[19px]"
          style={{ backgroundColor: accentSoft }}
        >
          <MaterialCommunityIcons name={icon} size={32} color={accent} />
        </View>

        <View
          className="h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: active ? accent : accentSoft }}
        >
          <MaterialCommunityIcons
            name="arrow-right"
            size={21}
            color={active ? "#FFFFFF" : accent}
          />
        </View>
      </View>

      {/* Bottom: text */}
      <View>
        <Text className="text-[21px] font-extrabold text-[#0F172A]">{title}</Text>
        <Text className="mt-1 text-[13px] leading-5 text-[#64748B]">{subtitle}</Text>

        <View
          className="mt-3 flex-row items-center self-start rounded-full px-3 py-1.5"
          style={{ backgroundColor: accentSoft }}
        >
          <Text className="text-[12px] font-bold" style={{ color: accent }}>
            {cta}
          </Text>
          <MaterialCommunityIcons
            name="arrow-right"
            size={14}
            color={accent}
            style={{ marginLeft: 5 }}
          />
        </View>
      </View>
    </Pressable>
  );
}

export default function Index() {
  return (
    <SafeAreaView className="flex-1 bg-[#EFF6FF]">
      <View className="flex-1 overflow-hidden">
        {/* Background decorations */}
        <View className="absolute -right-24 -top-20 h-64 w-64 rounded-full bg-[#DBEAFE]" />
        <View className="absolute -left-28 top-1/3 h-72 w-72 rounded-full bg-[#CCFBF1]" />
        <View className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-[#E0E7FF]" />

        <View className="flex-1 px-5">
          {/* Title */}
          <View className="items-center pt-7">
            <View className="mb-3 flex-row items-center rounded-full border border-[#DBEAFE] bg-white px-3 py-1.5">
              <View className="mr-2 h-2 w-2 rounded-full bg-[#2563EB]" />
              <Text className="text-[11px] font-bold text-[#1D4ED8]">
                PGs, hostels & co-living
              </Text>
            </View>
            <Text className="text-[36px] font-extrabold tracking-tight text-[#0F172A]">
              Find<Text className="text-[#2563EB]">Easy</Text>
            </Text>
            <Text className="mt-1 text-[14px] font-medium text-[#64748B]">
              Find what you need, near you.
            </Text>
            <Text className="mt-5 text-center text-[16px] font-bold text-[#1E293B]">
              How would you like to use FindEasy?
            </Text>
          </View>

          {/* Role selection */}
          <View className="flex-1 justify-center py-6" style={{ gap: 16 }}>
            <RoleCard
              title="I'm a Tenant"
              subtitle="Browse PGs, hostels and co-living spaces."
              cta="Explore stays"
              accent="#2563EB"
              accentSoft="#E8F1FF"
              icon="home-search"
              onPress={() => router.push({ pathname: "/login", params: { role: "user" } })}
            />

            <RoleCard
              title="I'm an Owner"
              subtitle="List and manage your PG or hostel."
              cta="List your property"
              accent="#0D9488"
              accentSoft="#DDF7F2"
              icon="office-building"
              onPress={() =>
                router.push({
                  pathname: "/(auth)/login",
                  params: { role: "owner" },
                })
              }
            />
          </View>

          {/* Caption */}
          <View className="items-center pb-4">
            <Text className="text-[12px] font-medium text-[#64748B]">
              Your stay. Your choice. Made easy.
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}