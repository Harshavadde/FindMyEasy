import { forwardRef, useImperativeHandle, useRef } from "react";
import MapView, {
  Marker,
  type MapPressEvent,
  type Region,
} from "react-native-maps";
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
  const mapRef = useRef<MapView>(null);

  useImperativeHandle(forwardedRef, () => ({
    animateToRegion(region, duration = 500) {
      mapRef.current?.animateToRegion(region as Region, duration);
    },
  }));

  return (
    <MapView
      ref={mapRef}
      style={{ flex: 1 }}
      initialRegion={initialRegion as Region}
      onPress={(event: MapPressEvent) =>
        onLocationSelected(event.nativeEvent.coordinate)
      }
    >
      {selectedLocation && (
        <Marker
          coordinate={selectedLocation}
          title="Property Location"
          description="Selected hostel / PG location"
          draggable
          onDragEnd={(event) =>
            onLocationSelected(event.nativeEvent.coordinate)
          }
        />
      )}
    </MapView>
  );
});

export default ListingLocationMap;
