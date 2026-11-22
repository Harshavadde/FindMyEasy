import { useEffect, useRef } from "react";
import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "expo-router/build/layouts/Tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import {
  BottomNavigationScrollProvider,
  useBottomNavigationScroll,
} from "../../../contexts/BottomNavigationScrollContext";

const ACTIVE_COLOR = "#2563EB";
const INACTIVE_COLOR = "#64748B";

export const unstable_settings = {
  anchor: "home",
};

export default function UserTabsLayout() {
  return (
    <BottomNavigationScrollProvider>
      <UserTabsNavigator />
    </BottomNavigationScrollProvider>
  );
}

function UserTabsNavigator() {
  return (
    <Tabs
      tabBar={(props) => <FloatingNavigationBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: false,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarAccessibilityLabel: "Home",
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: "Favorites",
          tabBarAccessibilityLabel: "Favorites",
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarAccessibilityLabel: "Search",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarAccessibilityLabel: "Profile",
        }}
      />
    </Tabs>
  );
}

const VISIBLE_TABS = [
  { name: "home", label: "Home", icon: "home-outline" },
  { name: "favorites", label: "Favorites", icon: "heart-outline" },
  { name: "search", label: "Search", icon: "magnify" },
] as const;

function FloatingNavigationBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { activeBlurTarget, compact } = useBottomNavigationScroll();
  const { width: screenWidth } = useWindowDimensions();
  const iconScale = useRef(new Animated.Value(1)).current;
  const pillScale = useRef(new Animated.Value(1)).current;
  const pillWidth = Math.min(220, screenWidth - 24);
  const bottomClearance = Math.max(
    insets.bottom - (Platform.OS === "ios" ? 16 : 8),
    8
  );

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(iconScale, {
        toValue: compact ? 0.9 : 1,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.spring(pillScale, {
        toValue: compact ? 0.94 : 1,
        speed: 20,
        bounciness: 3,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [compact, iconScale, pillScale]);

  return (
    <View
      pointerEvents="box-none"
      style={[
        StyleSheet.absoluteFill,
        styles.navigationOverlay,
        { paddingBottom: bottomClearance },
      ]}
    >
      <Animated.View
        style={[
          styles.pill,
          { width: pillWidth, transform: [{ scale: pillScale }] },
        ]}
      >
        <BlurView
          pointerEvents="none"
          tint="light"
          intensity={100}
          blurTarget={activeBlurTarget ?? undefined}
          blurMethod={
            Platform.OS === "android" && activeBlurTarget
              ? "dimezisBlurViewSdk31Plus"
              : undefined
          }
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: "rgba(255,255,255,0.7)",
              borderRadius: 9999,
              overflow: "hidden",
            },
          ]}
        />
        <View style={styles.navigationItems}>
          {VISIBLE_TABS.map(({ name, label, icon }) => {
            const route = state.routes.find((item) => item.name === name);
            if (!route) return null;

            const focused = state.routes[state.index]?.key === route.key;
            const { options } = descriptors[route.key];

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityLabel={
                  options.tabBarAccessibilityLabel ?? options.title ?? label
                }
                accessibilityState={{ selected: focused }}
                testID={options.tabBarButtonTestID}
                onPress={() => {
                  const event = emitter.emit({
                    type: "tabPress",
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !event.defaultPrevented) {
                    navigateToTab(route.key);
                  }
                }}
                onLongPress={() => {
                  emitter.emit({
                    type: "tabLongPress",
                    target: route.key,
                  });
                }}
                onPressIn={() => {
                  Animated.spring(pillScale, {
                    toValue: compact ? 0.88 : 0.94,
                    speed: 20,
                    bounciness: 3,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(pillScale, {
                    toValue: compact ? 0.94 : 1,
                    speed: 20,
                    bounciness: 3,
                    useNativeDriver: true,
                  }).start();
                }}
                style={styles.tabButton}
              >
                <Animated.View
                  style={[
                    styles.tabIconHighlight,
                    {
                      width: focused ? 56 : 40,
                      backgroundColor: focused ? "#EAF2FF" : "transparent",
                      transform: [{ scale: iconScale }],
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={icon}
                    color={focused ? ACTIVE_COLOR : INACTIVE_COLOR}
                    size={24}
                  />
                </Animated.View>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  navigationOverlay: {
    alignItems: "center",
    justifyContent: "flex-end",
    zIndex: 9999,
    elevation: 20,
  },
  pill: {
    maxWidth: 240,
    height: 44,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    borderRadius: 9999,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  navigationItems: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  tabButton: {
    width: 56,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconHighlight: {
    height: 32,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9999,
  },
});
