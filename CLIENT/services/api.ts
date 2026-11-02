import { API_BASE_URL, ApiError } from "../constants/api";
import type { Listing } from "../types/listing";

async function request<T>(
  path: string,
  timeoutMs = 15000
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new ApiError(
        "timeout",
        `The server at ${API_BASE_URL} did not respond in ${
          timeoutMs / 1000
        } seconds.`
      );
    }

    throw new ApiError(
      "network",
      `Cannot reach the server at ${API_BASE_URL}.`
    );
  } finally {
    clearTimeout(timer);
  }

  const raw = await response.text();

  let data: any = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const detail = data?.detail;

    throw new ApiError(
      "http",
      typeof detail === "string"
        ? detail
        : raw || `Request failed with status ${response.status}.`,
      response.status
    );
  }

  return data as T;
}

const PUBLIC_LISTINGS_CACHE_MS = 30_000;
const publicListingsCache = new Map<
  string,
  { listings: Listing[]; cachedAt: number }
>();
const publicListingsRequests = new Map<string, Promise<Listing[]>>();

export type PublicListingsResponse = {
  success: boolean;
  count: number;
  listings: Listing[];
};

export type ListingProximityBadge = {
  name: string;
  type: "metro" | "bus" | "railway" | "landmark" | "education";
  distance_m: number;
};

type NearbyPlace = {
  name: string;
  type: ListingProximityBadge["type"];
  latitude: number;
  longitude: number;
  city?: string;
};

type OverpassElement = {
  id: number;
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const PROXIMITY_DATA_VERSION = 4;
const PROXIMITY_CELL_SIZE = 0.02;
const PROXIMITY_CELL_BUFFER = 0.025;
const PROXIMITY_SEARCH_RADIUS_METERS = 5000;
const METRO_PREFERENCE_RADIUS_METERS = 1000;
const PROXIMITY_CACHE_MS = 60 * 60 * 1000;
// Coordinates are local fallbacks for the Hyderabad areas currently in the marketplace.
const CURATED_NEARBY_PLACES: NearbyPlace[] = [
  {
    name: "HITEC City Metro",
    type: "metro",
    latitude: 17.4484,
    longitude: 78.3907,
    city: "Hyderabad",
  },
  {
    name: "Madhapur Metro",
    type: "metro",
    latitude: 17.4401,
    longitude: 78.3915,
    city: "Hyderabad",
  },
  {
    name: "Raidurg Metro",
    type: "metro",
    latitude: 17.4433,
    longitude: 78.3772,
    city: "Hyderabad",
  },
  {
    name: "Durgam Cheruvu Metro",
    type: "metro",
    latitude: 17.4329,
    longitude: 78.3984,
    city: "Hyderabad",
  },
  {
    name: "Yousufguda Metro",
    type: "metro",
    latitude: 17.4327,
    longitude: 78.423,
    city: "Hyderabad",
  },
  {
    name: "Madhura Nagar Metro",
    type: "metro",
    latitude: 17.4376,
    longitude: 78.4337,
    city: "Hyderabad",
  },
  {
    name: "Ameerpet Metro",
    type: "metro",
    latitude: 17.4375,
    longitude: 78.4483,
    city: "Hyderabad",
  },
  {
    name: "Begumpet Metro",
    type: "metro",
    latitude: 17.4441,
    longitude: 78.4574,
    city: "Hyderabad",
  },
  {
    name: "Habsiguda Metro",
    type: "metro",
    latitude: 17.4056,
    longitude: 78.5434,
    city: "Hyderabad",
  },
  {
    name: "Tarnaka Metro",
    type: "metro",
    latitude: 17.428,
    longitude: 78.5287,
    city: "Hyderabad",
  },
  {
    name: "NGRI Metro",
    type: "metro",
    latitude: 17.4129,
    longitude: 78.5437,
    city: "Hyderabad",
  },
  {
    name: "Jubilee Hills Check Post Metro",
    type: "metro",
    latitude: 17.4316,
    longitude: 78.4071,
    city: "Hyderabad",
  },
  {
    name: "KPHB Colony Metro",
    type: "metro",
    latitude: 17.4934,
    longitude: 78.3998,
    city: "Hyderabad",
  },
  {
    name: "JNTU College Metro",
    type: "metro",
    latitude: 17.4933,
    longitude: 78.3928,
    city: "Hyderabad",
  },
  {
    name: "Kukatpally Metro",
    type: "metro",
    latitude: 17.4847,
    longitude: 78.4137,
    city: "Hyderabad",
  },
  {
    name: "Uppal Metro",
    type: "metro",
    latitude: 17.4018,
    longitude: 78.5594,
    city: "Hyderabad",
  },
  {
    name: "Nagole Metro",
    type: "metro",
    latitude: 17.3906,
    longitude: 78.5567,
    city: "Hyderabad",
  },
  {
    name: "Cyber Towers",
    type: "landmark",
    latitude: 17.4504,
    longitude: 78.3815,
    city: "Hyderabad",
  },
  {
    name: "Mindspace IT Park",
    type: "landmark",
    latitude: 17.435,
    longitude: 78.3808,
    city: "Hyderabad",
  },
  {
    name: "Cyber Pearl",
    type: "landmark",
    latitude: 17.4477,
    longitude: 78.3768,
    city: "Hyderabad",
  },
  {
    name: "Cyber Gateway",
    type: "landmark",
    latitude: 17.4507,
    longitude: 78.382,
    city: "Hyderabad",
  },
  {
    name: "DLF Cyber City",
    type: "landmark",
    latitude: 17.4327,
    longitude: 78.3627,
    city: "Hyderabad",
  },
  {
    name: "Laxmi Cyber City",
    type: "landmark",
    latitude: 17.4419,
    longitude: 78.3663,
    city: "Hyderabad",
  },
  {
    name: "DivyaSree NSL Infrastructure",
    type: "landmark",
    latitude: 17.4242,
    longitude: 78.3647,
    city: "Hyderabad",
  },
  {
    name: "Phoenix Avance",
    type: "landmark",
    latitude: 17.4217,
    longitude: 78.3758,
    city: "Hyderabad",
  },
  {
    name: "GAR Infobahn",
    type: "landmark",
    latitude: 17.425,
    longitude: 78.375,
    city: "Hyderabad",
  },
  {
    name: "WaveRock",
    type: "landmark",
    latitude: 17.4189,
    longitude: 78.342,
    city: "Hyderabad",
  },
  {
    name: "TCS Synergy Park",
    type: "landmark",
    latitude: 17.4215,
    longitude: 78.343,
    city: "Hyderabad",
  },
  {
    name: "Raheja Mindspace",
    type: "landmark",
    latitude: 17.437,
    longitude: 78.381,
    city: "Hyderabad",
  },
  {
    name: "Osmania University",
    type: "education",
    latitude: 17.4136,
    longitude: 78.5283,
    city: "Hyderabad",
  },
  {
    name: "Jawaharlal Nehru Technological University Hyderabad",
    type: "education",
    latitude: 17.4933,
    longitude: 78.3914,
    city: "Hyderabad",
  },
  {
    name: "University of Hyderabad",
    type: "education",
    latitude: 17.4608,
    longitude: 78.3344,
    city: "Hyderabad",
  },
  {
    name: "IIIT Hyderabad",
    type: "education",
    latitude: 17.4453,
    longitude: 78.3489,
    city: "Hyderabad",
  },
  {
    name: "Ameerpet Coaching Hub",
    type: "education",
    latitude: 17.437,
    longitude: 78.448,
    city: "Hyderabad",
  },
  {
    name: "Secunderabad Railway Station",
    type: "railway",
    latitude: 17.4344,
    longitude: 78.5013,
    city: "Hyderabad",
  },
  {
    name: "Kacheguda Railway Station",
    type: "railway",
    latitude: 17.3845,
    longitude: 78.4867,
    city: "Hyderabad",
  },
  {
    name: "Hyderabad Deccan Railway Station",
    type: "railway",
    latitude: 17.385,
    longitude: 78.473,
    city: "Hyderabad",
  },
  {
    name: "Mahatma Gandhi Bus Station",
    type: "bus",
    latitude: 17.378,
    longitude: 78.4804,
    city: "Hyderabad",
  },
  {
    name: "Jubilee Bus Station",
    type: "bus",
    latitude: 17.4431,
    longitude: 78.4983,
    city: "Hyderabad",
  },
  {
    name: "Dilsukhnagar Bus Station",
    type: "bus",
    latitude: 17.3688,
    longitude: 78.5247,
    city: "Hyderabad",
  },
  {
    name: "Kukatpally Bus Depot",
    type: "bus",
    latitude: 17.493,
    longitude: 78.4011,
    city: "Hyderabad",
  },
  {
    name: "Miyapur Bus Depot",
    type: "bus",
    latitude: 17.4968,
    longitude: 78.373,
    city: "Hyderabad",
  },
  {
    name: "Gachibowli Bus Stop",
    type: "bus",
    latitude: 17.4401,
    longitude: 78.3489,
    city: "Hyderabad",
  },
  {
    name: "Ashok Nagar Study Circle",
    type: "education",
    latitude: 17.412,
    longitude: 78.4915,
    city: "Hyderabad",
  },
  {
    name: "Ameerpet Coaching Centre Hub",
    type: "education",
    latitude: 17.437,
    longitude: 78.448,
    city: "Hyderabad",
  },
];
const proximityCache = new Map<
  string,
  { places: NearbyPlace[]; cachedAt: number }
>();
const proximityRequests = new Map<string, Promise<NearbyPlace[]>>();
let lastProximityRequestAt = 0;

function getProximityCell(latitude: number, longitude: number) {
  const lat = Math.floor(latitude / PROXIMITY_CELL_SIZE);
  const lon = Math.floor(longitude / PROXIMITY_CELL_SIZE);
  return {
    key: `${PROXIMITY_DATA_VERSION}:${lat}:${lon}`,
    south: lat * PROXIMITY_CELL_SIZE - PROXIMITY_CELL_BUFFER,
    west: lon * PROXIMITY_CELL_SIZE - PROXIMITY_CELL_BUFFER,
    north: (lat + 1) * PROXIMITY_CELL_SIZE + PROXIMITY_CELL_BUFFER,
    east: (lon + 1) * PROXIMITY_CELL_SIZE + PROXIMITY_CELL_BUFFER,
  };
}

function getOsmPlaces(elements: OverpassElement[]): NearbyPlace[] {
  const places: NearbyPlace[] = [];
  const seen = new Set<string>();

  elements.forEach((element) => {
    const tags = element.tags ?? {};
    const name = (
      tags.name ??
      tags["name:en"] ??
      tags.official_name ??
      tags.alt_name ??
      tags.ref
    )?.trim();
    if (!name) return;

    const transitDescription = `${name} ${tags.network ?? ""} ${
      tags["network:short"] ?? ""
    } ${tags.operator ?? ""} ${tags["operator:short"] ?? ""} ${
      tags.railway ?? ""
    } ${tags.line ?? ""} ${tags.route ?? ""} ${
      tags.public_transport ?? ""
    } ${tags.service ?? ""}`;
    const isMetro =
      tags.station === "subway" ||
      (tags.station === "light_rail" && /metro/i.test(transitDescription)) ||
      tags.station === "metro" ||
      tags.subway === "yes" ||
      tags.railway === "subway_entrance" ||
      tags.service === "metro" ||
      (tags.public_transport === "stop_position" &&
        /metro/i.test(transitDescription)) ||
      /metro/i.test(transitDescription);
    const isBusStop =
      tags.highway === "bus_stop" ||
      tags.amenity === "bus_station" ||
      (tags.public_transport === "platform" && tags.bus === "yes") ||
      (tags.public_transport === "station" && tags.bus === "yes");
    const isRailwayStation =
      !isMetro &&
      (tags.railway === "station" ||
        tags.railway === "halt" ||
        tags.station === "train");
    const isLandmark =
      /mindspace|cyber towers|cyber pearl|cyber gateway|cyber city|it park|tech park|business park|hitec city|high.?tech city|software technology|divyasree|phoenix avance|gar infobahn|waverock|synergy park/i.test(
        name
      ) ||
      ["it", "company", "business"].includes(tags.office ?? "") ||
      tags.amenity === "business_centre";
    const isEducation =
      tags.amenity === "college" ||
      tags.amenity === "university" ||
      tags.amenity === "school" ||
      tags.amenity === "training" ||
      tags.amenity === "education" ||
      tags.office === "educational_institution" ||
      tags.education === "centre" ||
      /academy|coaching|tutorial|institute|college|university|\bIIT\b|\bIIIT\b|Narayana|Sri Chaitanya|Aakash|Allen/i.test(
        name
      );
    if (
      !isMetro &&
      !isBusStop &&
      !isRailwayStation &&
      !isLandmark &&
      !isEducation
    ) {
      return;
    }

    const coordinates = element.center ?? element;
    if (
      typeof coordinates.lat !== "number" ||
      typeof coordinates.lon !== "number"
    ) {
      return;
    }

    const id = `${element.type}:${element.id}`;
    if (seen.has(id)) return;
    seen.add(id);
    places.push({
      name,
      type: isMetro
        ? "metro"
        : isBusStop
          ? "bus"
          : isRailwayStation
            ? "railway"
            : isEducation
              ? "education"
              : "landmark",
      latitude: coordinates.lat,
      longitude: coordinates.lon,
    });
  });

  return places;
}

function getPlaceKey(place: Pick<NearbyPlace, "name" | "type">) {
  return `${place.type}:${place.name
    .replace(/\b(metro|station|railway|bus stop)\b/gi, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase()}`;
}

async function fetchNearbyPlaces(cell: ReturnType<typeof getProximityCell>) {
  const cached = proximityCache.get(cell.key);
  if (cached && Date.now() - cached.cachedAt < PROXIMITY_CACHE_MS) {
    return cached.places;
  }

  const existingRequest = proximityRequests.get(cell.key);
  if (existingRequest) return existingRequest;

  const request = (async () => {
    const delay = 1000 - (Date.now() - lastProximityRequestAt);
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const bbox = `${cell.south},${cell.west},${cell.north},${cell.east}`;
    const query = `
      [out:json][timeout:20];
      (
        nwr["station"~"subway|light_rail|metro",i](${bbox});
        nwr["subway"="yes"](${bbox});
        nwr["service"="metro"](${bbox});
        nwr["railway"~"station|halt|stop|tram_stop|subway_entrance"]["network"~"metro|hyderabad",i](${bbox});
        nwr["railway"~"station|halt|stop|tram_stop|subway_entrance"]["operator"~"metro|hyderabad",i](${bbox});
        nwr["public_transport"~"station|platform|stop_position"]["network"~"metro|hyderabad",i](${bbox});
        nwr["public_transport"~"station|platform|stop_position"]["operator"~"metro|hyderabad",i](${bbox});
        nwr["railway"~"station|halt|stop|tram_stop|subway_entrance"]["name"](${bbox});
        nwr["railway"~"station|halt|stop|tram_stop|subway_entrance"]["name:en"](${bbox});
        nwr["public_transport"~"station|platform|stop_position"]["name"](${bbox});
        nwr["public_transport"~"station|platform|stop_position"]["name:en"](${bbox});
        nwr["highway"="bus_stop"]["name"](${bbox});
        nwr["amenity"="bus_station"]["name"](${bbox});
        nwr["public_transport"="platform"]["bus"="yes"]["name"](${bbox});
        nwr["public_transport"="station"]["bus"="yes"]["name"](${bbox});
        nwr["amenity"~"college|university|school|training|education"]["name"](${bbox});
        nwr["office"="educational_institution"]["name"](${bbox});
        nwr["name"~"academy|coaching|tutorial|institute|college|university|Narayana|Sri Chaitanya|Aakash|Allen",i](${bbox});
        nwr["office"~"it|company|business"]["name"](${bbox});
        nwr["amenity"="business_centre"]["name"](${bbox});
        nwr["name"~"Mindspace|Cyber Towers|Cyber Pearl|Cyber Gateway|Cyber City|IT Park|Tech Park|HITEC City|High.?Tech City|Business Park|Software Technology|DivyaSree|Phoenix Avance|GAR Infobahn|WaveRock|Synergy Park",i](${bbox});
      );
      out center tags;
    `;

    let lastError: unknown;
    for (const endpoint of OVERPASS_URLS) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            "User-Agent": "FindEasyApp/1.0",
          },
          body: new URLSearchParams({ data: query }).toString(),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `OpenStreetMap lookup failed at ${endpoint} (${response.status}).`
          );
        }

        const data = (await response.json()) as {
          elements?: OverpassElement[];
        };
        const places = getOsmPlaces(data.elements ?? []);
        proximityCache.set(cell.key, { places, cachedAt: Date.now() });
        return places;
      } catch (error: unknown) {
        lastError = error;
      } finally {
        clearTimeout(timeout);
        lastProximityRequestAt = Date.now();
      }
    }

    throw new Error(
      `All OpenStreetMap lookup endpoints failed. Last error: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`
    );
  })().finally(() => {
    proximityRequests.delete(cell.key);
  });

  proximityRequests.set(cell.key, request);
  return request;
}

function distanceMeters(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number
) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(latitude2 - latitude1);
  const longitudeDelta = radians(longitude2 - longitude1);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(latitude1)) *
      Math.cos(radians(latitude2)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return (
    6_371_000 *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

function getNearestPlaceBadge(
  latitude: number,
  longitude: number,
  places: NearbyPlace[],
  placeType?: ListingProximityBadge["type"],
  placeName?: string
): ListingProximityBadge | null {
  let nearestMetro: ListingProximityBadge | null = null;
  let nearestMetroDistance = Number.POSITIVE_INFINITY;
  let nearestFallback: ListingProximityBadge | null = null;
  let nearestFallbackDistance = Number.POSITIVE_INFINITY;

  places.forEach((place) => {
    if (placeType && place.type !== placeType) return;
    if (
      placeName &&
      getPlaceKey(place) !== getPlaceKey({ name: placeName, type: place.type })
    ) {
      return;
    }
    if (
      placeType === "landmark" &&
      !/mindspace|cyber|it[\s-]*park|tech[\s-]*park|business[\s-]*park|hitec|high[\s-]*tech|technology|software|divyasree|phoenix avance|gar infobahn|waverock|synergy park|raheja|knowledge city|financial district|infocity/i.test(
        place.name
      )
    ) {
      return;
    }

    const distance = distanceMeters(
      latitude,
      longitude,
      place.latitude,
      place.longitude
    );
    if (distance > PROXIMITY_SEARCH_RADIUS_METERS) return;

    const badge: ListingProximityBadge = {
      name: place.name,
      type: place.type,
      distance_m: Math.round(distance),
    };
    if (place.type === "metro") {
      const metroDistanceLimit =
        placeType === "metro" || placeName
          ? PROXIMITY_SEARCH_RADIUS_METERS
          : METRO_PREFERENCE_RADIUS_METERS;
      if (
        distance <= metroDistanceLimit &&
        distance < nearestMetroDistance
      ) {
        nearestMetroDistance = distance;
        nearestMetro = badge;
      }
    } else if (distance < nearestFallbackDistance) {
      nearestFallbackDistance = distance;
      nearestFallback = badge;
    }
  });

  return nearestMetro ?? nearestFallback;
}

export function getCuratedListingProximity(
  listings: Listing[],
  placeType?: ListingProximityBadge["type"],
  placeName?: string
): Record<string, ListingProximityBadge | null> {
  const result: Record<string, ListingProximityBadge | null> = {};
  listings.forEach((listing) => {
    const latitude = Number(listing.latitude);
    const longitude = Number(listing.longitude);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < 6 ||
      latitude > 38 ||
      longitude < 68 ||
      longitude > 98
    ) {
      result[String(listing.id)] = null;
      return;
    }

    const city = String(listing.city ?? "").trim().toLowerCase();
    const places = CURATED_NEARBY_PLACES.filter(
      (place) => !place.city || place.city.toLowerCase() === city
    );
    result[String(listing.id)] = getNearestPlaceBadge(
      latitude,
      longitude,
      places,
      placeType,
      placeName
    );
  });
  return result;
}

export async function getPublicListingProximity(
  listings: Listing[],
  placeType?: ListingProximityBadge["type"],
  placeName?: string
): Promise<Record<string, ListingProximityBadge | null>> {
  const result: Record<string, ListingProximityBadge | null> = {};
  const validListings = listings.flatMap((listing) => {
    const latitude = Number(listing.latitude);
    const longitude = Number(listing.longitude);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < 6 ||
      latitude > 38 ||
      longitude < 68 ||
      longitude > 98
    ) {
      return [];
    }
    return [{ listingId: String(listing.id), latitude, longitude }];
  });

  const cells = new Map<
    string,
    ReturnType<typeof getProximityCell>
  >();
  validListings.forEach(({ latitude, longitude }) => {
    const cell = getProximityCell(latitude, longitude);
    cells.set(cell.key, cell);
  });

  const placesByCell = new Map<string, NearbyPlace[]>();
  for (const cell of cells.values()) {
    const matchingListings = validListings.filter(
      ({ latitude, longitude }) =>
        getProximityCell(latitude, longitude).key === cell.key
    );
    const city = listings.find(
      (listing) =>
        String(listing.id) === matchingListings[0]?.listingId
    )?.city;
    const listingCity = String(city ?? "").trim().toLowerCase();
    const curatedPlaces = CURATED_NEARBY_PLACES.filter(
      (place) => !place.city || place.city.toLowerCase() === listingCity
    );

    try {
      const osmPlaces = await fetchNearbyPlaces(cell);
      const osmPlaceKeys = new Set(osmPlaces.map(getPlaceKey));
      placesByCell.set(cell.key, [
        ...osmPlaces,
        ...curatedPlaces.filter(
          (place) => !osmPlaceKeys.has(getPlaceKey(place))
        ),
      ]);
    } catch (error: unknown) {
      console.warn(
        `OpenStreetMap lookup failed for city ${city ?? "unknown"}; using curated nearby places.`,
        error
      );
      placesByCell.set(cell.key, curatedPlaces);
    }
  }

  validListings.forEach(({ listingId, latitude, longitude }) => {
    const cell = getProximityCell(latitude, longitude);
    const places = placesByCell.get(cell.key) ?? [];
    result[listingId] = getNearestPlaceBadge(
      latitude,
      longitude,
      places,
      placeType,
      placeName
    );
  });

  return result;
}

export async function getPublicListings(
  params: {
    city?: string;
    area?: string;
    property_type?: string;
    gender?: string;
    min_price?: number;
    max_price?: number;
    forceRefresh?: boolean;
  } = {}
): Promise<Listing[]> {
  const searchParams = new URLSearchParams();

  if (params.city?.trim()) {
    searchParams.set(
      "city",
      params.city.trim()
    );
  }

  if (params.area?.trim()) {
    searchParams.set(
      "area",
      params.area.trim()
    );
  }

  if (params.property_type?.trim()) {
    searchParams.set(
      "property_type",
      params.property_type.trim()
    );
  }

  if (params.gender?.trim()) {
    searchParams.set(
      "gender",
      params.gender.trim()
    );
  }

  if (params.min_price !== undefined) {
    searchParams.set(
      "min_price",
      String(params.min_price)
    );
  }

  if (params.max_price !== undefined) {
    searchParams.set(
      "max_price",
      String(params.max_price)
    );
  }

  const query = searchParams.toString();
  const cacheKey = `/api/v1/listings${query ? `?${query}` : ""}`;
  const forceRefresh = params.forceRefresh ?? false;
  const cachedResult = publicListingsCache.get(cacheKey);

  if (
    !forceRefresh &&
    cachedResult &&
    Date.now() - cachedResult.cachedAt < PUBLIC_LISTINGS_CACHE_MS
  ) {
    return Promise.resolve(cachedResult.listings);
  }

  if (!forceRefresh) {
    const pendingRequest = publicListingsRequests.get(cacheKey);
    if (pendingRequest) return pendingRequest;
  }

  const listingsRequest = request<PublicListingsResponse>(cacheKey)
    .then((result) => {
      publicListingsCache.set(cacheKey, {
        listings: result.listings,
        cachedAt: Date.now(),
      });
      return result.listings;
    })
    .finally(() => {
      if (publicListingsRequests.get(cacheKey) === listingsRequest) {
        publicListingsRequests.delete(cacheKey);
      }
    });

  publicListingsRequests.set(cacheKey, listingsRequest);
  return listingsRequest;
}

export async function getPublicListing(
  listingId: string
): Promise<Listing> {
  return request<Listing>(
    `/api/v1/listings/${encodeURIComponent(listingId)}`
  );
}