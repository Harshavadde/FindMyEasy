export type LocationCoordinate = {
  latitude: number;
  longitude: number;
};

export type LocationRegion = LocationCoordinate & {
  latitudeDelta: number;
  longitudeDelta: number;
};

export type ListingLocationMapHandle = {
  animateToRegion: (region: LocationRegion, duration?: number) => void;
};

export type ListingLocationMapProps = {
  initialRegion: LocationRegion;
  selectedLocation: LocationCoordinate | null;
  onLocationSelected: (coordinate: LocationCoordinate) => void;
};
