import { useEffect, useRef } from "react";
import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "expo-router/build/layouts/Tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BottomNavigationScrollProvider,
  useBottomNavigationScroll,
} from "../../../contexts/BottomNavigationScrollContext";
import { useFavoritesStore } from "../../../store/favoritesStore";

const ACTIVE_COLOR = "#4F46E5";
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
          title: "Explore",
          tabBarAccessibilityLabel: "Explore",
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: "Saved",
          tabBarAccessibilityLabel: "Saved properties",
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
  { name: "home", label: "Explore", icon: "compass-outline" },
  { name: "search", label: "Search", icon: "magnify" },
  { name: "favorites", label: "Saved", icon: "heart-outline" },
] as const;

function FloatingNavigationBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { compact } = useBottomNavigationScroll();
  const { width: screenWidth } = useWindowDimensions();
  const savedCount = useFavoritesStore((store) => store.favoriteIds.size);
  const loadFavoriteIds = useFavoritesStore((store) => store.loadFavoriteIds);
  const iconScale = useRef(new Animated.Value(1)).current;
  const pillScale = useRef(new Animated.Value(1)).current;
  const pillWidth = Math.min(360, screenWidth - 32);
  const bottomOffset =
    Platform.OS === "ios" ? Math.max(insets.bottom - 18, 12) : 14;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(iconScale, {
        toValue: compact ? 0.9 : 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(pillScale, {
        toValue: compact ? 0.92 : 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [compact, iconScale, pillScale]);

  useEffect(() => {
    void loadFavoriteIds().catch((error: unknown) => {
      console.error("Unable to load saved count for navigation:", error);
    });
  }, [loadFavoriteIds]);

  return (
    <View
      pointerEvents="box-none"
      style={[
        StyleSheet.absoluteFill,
        styles.navigationOverlay,
      ]}
    >
      <Animated.View
        style={[
          styles.pillShadow,
          {
            width: pillWidth,
            marginBottom: bottomOffset,
            transform: [{ scale: pillScale }],
          },
        ]}
      >
        <View style={styles.pill}>
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
                      toValue: compact ? 0.92 : 1,
                      speed: 20,
                      bounciness: 3,
                      useNativeDriver: true,
                    }).start();
                  }}
                  style={styles.tabButton}
                >
                  <View
                    style={[
                      styles.tabContent,
                      focused ? styles.tabContentActive : undefined,
                    ]}
                  >
                    <Animated.View
                      style={[
                        styles.tabIconHighlight,
                        { transform: [{ scale: iconScale }] },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={icon}
                        color={focused ? ACTIVE_COLOR : INACTIVE_COLOR}
                        size={19}
                      />
                    </Animated.View>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.tabLabel,
                        { color: focused ? ACTIVE_COLOR : INACTIVE_COLOR },
                        focused ? styles.tabLabelActive : undefined,
                      ]}
                    >
                      {label}
                    </Text>
                    {name === "favorites" && savedCount > 0 ? (
                      <View style={styles.savedBadge}>
                        <Text style={styles.savedBadgeText}>
                          {savedCount > 99 ? "99+" : savedCount}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
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
  pillShadow: {
    maxWidth: 360,
    borderRadius: 9999,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  pill: {
    width: "100%",
    height: 52,
    paddingHorizontal: 6,
    paddingVertical: 5,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    backgroundColor: "#FFFFFF",
    borderRadius: 9999,
    overflow: "hidden",
  },
  navigationItems: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    gap: 4,
  },
  tabButton: {
    flex: 1,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  tabContent: {
    width: "100%",
    height: 38,
    paddingHorizontal: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 13,
  },
  tabContentActive: { backgroundColor: "#EEF2FF" },
  tabIconHighlight: {
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: { fontSize: 11, fontWeight: "600" },
  tabLabelActive: { fontWeight: "800" },
  savedBadge: {
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: "#F43F5E",
  },
  savedBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800" },
});
