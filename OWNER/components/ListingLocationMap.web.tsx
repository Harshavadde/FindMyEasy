import { forwardRef, useImperativeHandle, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type GestureResponderEvent,
} from "react-native";
import type {
  ListingLocationMapHandle,
  ListingLocationMapProps,
} from "./ListingLocationMap.types";

const ListingLocationMap = forwardRef<
  ListingLocationMapHandle,
  ListingLocationMapProps
>(function ListingLocationMap(
  { initialRegion, selectedLocation, onLocationSelected },
  forwardedRef
) {
  const [region, setRegion] = useState(initialRegion);
  const [size, setSize] = useState({ width: 1, height: 1 });

  useImperativeHandle(forwardedRef, () => ({
    animateToRegion(nextRegion) {
      setRegion(nextRegion);
    },
  }));

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width: Math.max(width, 1), height: Math.max(height, 1) });
  }

  function handlePress(event: GestureResponderEvent) {
    const { locationX, locationY } = event.nativeEvent;
    onLocationSelected({
      latitude:
        region.latitude +
        (0.5 - locationY / size.height) * region.latitudeDelta,
      longitude:
        region.longitude +
        (locationX / size.width - 0.5) * region.longitudeDelta,
    });
  }

  const markerLeft = selectedLocation
    ? `${Math.max(
        0,
        Math.min(
          100,
          50 +
            ((selectedLocation.longitude - region.longitude) /
              region.longitudeDelta) *
              100
        )
      )}%`
    : "50%";
  const markerTop = selectedLocation
    ? `${Math.max(
        0,
        Math.min(
          100,
          50 -
            ((selectedLocation.latitude - region.latitude) /
              region.latitudeDelta) *
              100
        )
      )}%`
    : "50%";

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose the property location on the map"
        onPress={handlePress}
        style={styles.map}
      >
        <View pointerEvents="none" style={styles.gridVertical} />
        <View pointerEvents="none" style={styles.gridHorizontal} />
        <View pointerEvents="none" style={styles.roadOne} />
        <View pointerEvents="none" style={styles.roadTwo} />
        <View
          pointerEvents="none"
          style={[styles.marker, { left: markerLeft, top: markerTop }]}
        >
          <Text style={styles.pin}>●</Text>
        </View>
        <View pointerEvents="none" style={styles.attribution}>
          <Text style={styles.attributionText}>Map preview</Text>
        </View>
      </Pressable>
    </View>
  );
});

export default ListingLocationMap;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },
  map: {
    flex: 1,
    backgroundColor: "#E8F0E6",
    overflow: "hidden",
  },
  gridVertical: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "20%",
    right: "20%",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#D1DEC9",
  },
  gridHorizontal: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "20%",
    bottom: "20%",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#D1DEC9",
  },
  roadOne: {
    position: "absolute",
    width: "160%",
    height: 16,
    left: "-30%",
    top: "46%",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#D7DFD5",
    transform: [{ rotate: "-18deg" }],
  },
  roadTwo: {
    position: "absolute",
    width: "140%",
    height: 12,
    left: "-20%",
    top: "62%",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#D7DFD5",
    transform: [{ rotate: "28deg" }],
  },
  marker: {
    position: "absolute",
    width: 28,
    height: 28,
    marginLeft: -14,
    marginTop: -14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    backgroundColor: "#2563EB",
  },
  pin: {
    color: "#FFFFFF",
    fontSize: 10,
  },
  attribution: {
    position: "absolute",
    right: 8,
    bottom: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.85)",
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  attributionText: {
    color: "#475569",
    fontSize: 10,
  },
});
