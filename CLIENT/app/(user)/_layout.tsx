import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const ACTIVE_COLOR = "#2563EB";
const INACTIVE_COLOR = "#64748B";

export const unstable_settings = {
  initialRouteName: "home",
};

export default function UserLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarStyle: {
          height: 64,
          paddingTop: 7,
          paddingBottom: 7,
          backgroundColor: "#FFFFFF",
          borderTopColor: "#E2E8F0",
          borderTopWidth: 1,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ focused, size }) => (
            <MaterialCommunityIcons
              name="home-variant-outline"
              color={focused ? ACTIVE_COLOR : INACTIVE_COLOR}
              size={size}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ focused, size }) => (
            <MaterialCommunityIcons
              name="magnify"
              color={focused ? ACTIVE_COLOR : INACTIVE_COLOR}
              size={size}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="favorites"
        options={{
          title: "Favorites",
          tabBarIcon: ({ focused, size }) => (
            <MaterialCommunityIcons
              name="heart-outline"
              color={focused ? ACTIVE_COLOR : INACTIVE_COLOR}
              size={size}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused, size }) => (
            <MaterialCommunityIcons
              name="account-circle-outline"
              color={focused ? ACTIVE_COLOR : INACTIVE_COLOR}
              size={size}
            />
          ),
        }}
      />

      {/* Detail routes are not bottom tabs. */}
      <Tabs.Screen name="PG" options={{ href: null }} />
      <Tabs.Screen name="filters" options={{ href: null }} />
      <Tabs.Screen name="listing/[id]" options={{ href: null }} />
      <Tabs.Screen
        name="selectyourFinding/category"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="edit-profile"
        options={{ href: null }}
      />
    </Tabs>
  );
}