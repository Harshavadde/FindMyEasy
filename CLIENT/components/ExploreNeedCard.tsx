import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Animated,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { usePressScale } from "../hooks/usePressScale";

type Props = {
  label: string;
  subtitle: string;
  imageUrl: string;
  accessibilityLabel: string;
  onPress: () => void;
};

export default function ExploreNeedCard({
  label,
  subtitle,
  imageUrl,
  accessibilityLabel,
  onPress,
}: Props) {
  const { scale, onPressIn, onPressOut } = usePressScale();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth * 0.42;

  return (
    <Animated.View
      style={[
        styles.shadow,
        { width: cardWidth, transform: [{ scale }] },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.card}
      >
        <ImageBackground
          source={{ uri: imageUrl }}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
        >
          <LinearGradient
            pointerEvents="none"
            colors={[
              "rgba(15, 23, 42, 0.02)",
              "rgba(15, 23, 42, 0.16)",
              "rgba(15, 23, 42, 0.9)",
            ]}
            locations={[0, 0.48, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.content}>
            <View style={styles.topRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>EXPLORE</Text>
              </View>
              <View style={styles.arrow}>
                <MaterialCommunityIcons
                  name="arrow-top-right"
                  size={16}
                  color="#0F172A"
                />
              </View>
            </View>
            <View>
              <Text numberOfLines={1} style={styles.title}>
                {label}
              </Text>
              <Text numberOfLines={1} style={styles.subtitle}>
                {subtitle}
              </Text>
            </View>
          </View>
        </ImageBackground>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    height: 214,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 4,
  },
  card: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 20,
    backgroundColor: "#CBD5E1",
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    padding: 14,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badge: {
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.58)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  arrow: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 4,
    color: "#F8FAFC",
    fontSize: 11,
    fontWeight: "600",
  },
});
