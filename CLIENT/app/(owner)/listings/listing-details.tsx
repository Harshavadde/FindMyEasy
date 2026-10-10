import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";

import { API_BASE_URL } from "../../../constants/api";

// ============================================================================
// TYPES
// ============================================================================

type ListingSharing = {
  id: string;
  sharing_type: string;
  monthly_price: number;
  total_beds: number;
  available_beds: number;
  filled_beds: number;
};


type Listing = {
  id: string;
  owner_phone: string | null;

  name: string;
  property_type: string;
  gender: string;
  description: string | null;

  monthly_price: number;
  security_deposit: number | null;

  total_beds: number;
  available_beds: number;
  filled_beds: number;

  // Could be ["1","2"] or a list of objects depending on the backend schema.
  sharing: ListingSharing[] | null;

  ac_type: string;
  facilities: string[] | null;

  food_available: string;
  breakfast_time: string | null;
  lunch_time: string | null;
  dinner_time: string | null;

  city: string;
  area: string;
  address: string;

  latitude: string | null;
  longitude: string | null;

  restrictions: string | null;

  status: string;
};

// ============================================================================
// HELPERS
// ============================================================================

const FACILITY_ICONS: Record<string, string> = {
  "Wi-Fi": "📶",
  Parking: "🅿️",
  Laundry: "🧺",
  "Attached Bathroom": "🚿",
  "Power Backup": "🔋",
  CCTV: "📹",
};

/** Indian digit grouping: 1234567 -> ₹12,34,567 */
function formatINR(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }

  const n = Math.round(Number(value));
  const digits = String(Math.abs(n));
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);

  const grouped = rest
    ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}`
    : last3;

  return `₹${n < 0 ? "-" : ""}${grouped}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}

/** Accepts strings or objects like { sharing: "2" } / { sharing_type: "2" }. */
function normalizeSharing(raw: unknown[] | null | undefined): string[] {
  if (!Array.isArray(raw)) return [];

  const keys = ["sharing", "sharing_type", "type", "value", "label", "name"];

  return raw
    .map((item) => {
      if (typeof item === "string" || typeof item === "number") {
        return String(item);
      }

      if (item && typeof item === "object") {
        for (const key of keys) {
          const value = (item as Record<string, unknown>)[key];
          if (typeof value === "string" || typeof value === "number") {
            return String(value);
          }
        }
      }

      return "";
    })
    .filter(Boolean);
}

function sharingLabel(value: string): string {
  return /^\d+$/.test(value) ? `${value} Sharing` : value;
}

function statusStyle(status: string) {
  switch ((status || "").toLowerCase()) {
    case "published":
    case "active":
      return { bg: "#DCFCE7", fg: "#15803D", label: "Published" };
    case "pending":
    case "under_review":
      return { bg: "#DBEAFE", fg: "#1D4ED8", label: "In Review" };
    case "rejected":
    case "archived":
      return { bg: "#FEE2E2", fg: "#B91C1C", label: status };
    default:
      return { bg: "#FEF3C7", fg: "#B45309", label: "Draft" };
  }
}

function phoneDigits(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

// ============================================================================
// SMALL UI COMPONENTS
// ============================================================================

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <View
      className="mb-4 rounded-[22px] bg-white p-5"
      style={{
        shadowColor: "#64748B",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View className="mb-4 flex-row items-center">
        <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-[#EAF2FF]">
          <Text className="text-[16px]">{icon}</Text>
        </View>
        <Text className="text-[17px] font-extrabold text-[#0F172A]">
          {title}
        </Text>
      </View>

      {children}
    </View>
  );
}

function Pill({
  text,
  light = false,
}: {
  text: string;
  light?: boolean;
}) {
  return (
    <View
      className="mb-2 mr-2 rounded-full px-3 py-1.5"
      style={{
        backgroundColor: light ? "rgba(255,255,255,0.18)" : "#EEF4FF",
      }}
    >
      <Text
        className="text-[12px] font-bold"
        style={{ color: light ? "#FFFFFF" : "#2563EB" }}
      >
        {text}
      </Text>
    </View>
  );
}

function StatTile({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <View
  className="flex-1 items-center rounded-[18px] py-4"
  style={{ backgroundColor: bg }}
>
      <Text className="text-[24px] font-extrabold" style={{ color }}>
        {value}
      </Text>
      <Text className="mt-1 text-[11px] font-bold text-[#64748B]">
        {label}
      </Text>
    </View>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  const empty =
    value === null || value === undefined || String(value).trim() === "";

  return (
    <View className="flex-row items-center justify-between border-b border-[#F1F5F9] py-3">
      <Text className="flex-1 text-[13px] text-[#64748B]">{label}</Text>
      <Text
        className="flex-1 text-right text-[13px] font-bold"
        style={{ color: empty ? "#94A3B8" : "#0F172A" }}
      >
        {empty ? "Not provided" : String(value)}
      </Text>
    </View>
  );
}

function MealRow({
  icon,
  label,
  time,
}: {
  icon: string;
  label: string;
  time: string | null;
}) {
  return (
    <View className="mb-3 flex-row items-center rounded-[16px] bg-[#F8FAFC] p-3">
      <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-white">
        <Text className="text-[18px]">{icon}</Text>
      </View>

      <Text className="flex-1 text-[14px] font-bold text-[#0F172A]">
        {label}
      </Text>

      <Text
        className="text-[13px] font-bold"
        style={{ color: time ? "#2563EB" : "#94A3B8" }}
      >
        {time || "Not set"}
      </Text>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "soft" | "green";
}) {
  const styles = {
    primary: { bg: "#2563EB", fg: "#FFFFFF", border: "#2563EB" },
    soft: { bg: "#EFF6FF", fg: "#2563EB", border: "#BFDBFE" },
    green: { bg: "#DCFCE7", fg: "#15803D", border: "#BBF7D0" },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center justify-center rounded-[14px] py-3.5"
      style={({ pressed }) => ({
        backgroundColor: styles.bg,
        borderWidth: 1,
        borderColor: styles.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text className="text-[14px] font-extrabold" style={{ color: styles.fg }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ============================================================================
// SCREEN
// ============================================================================

export default function ListingDetailsScreen() {
  
    const params = useLocalSearchParams<{
      id?: string | string[];
      listingId?: string | string[];
    }>();

    const rawId = params.listingId ?? params.id;

    const listingId = Array.isArray(rawId)
      ? rawId[0]
      : rawId;


  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // LOAD
  // --------------------------------------------------------------------------

  const loadListing = useCallback(
    async (isRefresh = false) => {
      if (!listingId) {
        setError("Listing ID is missing.");
        setLoading(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setError(null);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);

      try {
        const url = `${API_BASE_URL}/api/v1/owner/listings/${listingId}`;

        const response = await fetch(url, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        const raw = await response.text();

        let data: any = null;
        try {
          data = raw ? JSON.parse(raw) : null;
        } catch {
          data = null;
        }

        if (!response.ok) {
          throw new Error(
            typeof data?.detail === "string"
              ? data.detail
              : `Failed to load listing (${response.status}).`
          );
        }
        console.log(
  "LISTING DETAILS API RESPONSE:",
  JSON.stringify(data, null, 2)
);
        setListing(data as Listing);
      } catch (err: unknown) {
        const aborted = err instanceof Error && err.name === "AbortError";
        const network = err instanceof TypeError;

        setError(
          aborted
            ? "The server took too long to respond."
            : network
            ? `Cannot reach the server at ${API_BASE_URL}. Check that FastAPI is running and your phone is on the same Wi-Fi.`
            : getErrorMessage(err, "Something went wrong while loading the listing.")
        );
      } finally {
        clearTimeout(timer);
        setLoading(false);
        setRefreshing(false);
      }
    },
    [listingId]
  );

  useEffect(() => {
    loadListing();
  }, [loadListing]);

  // --------------------------------------------------------------------------
  // DERIVED
  // --------------------------------------------------------------------------

  
const sharingDetails = useMemo(
  () => Array.isArray(listing?.sharing) ? listing.sharing : [],
  [listing?.sharing]
);

const sharing = useMemo(
  () => sharingDetails.map((item) => item.sharing_type),
  [sharingDetails]
);

const totalBeds = sharingDetails.reduce(
  (sum, item) => sum + Number(item.total_beds || 0),
  0
);

const availableBeds = sharingDetails.reduce(
  (sum, item) => sum + Number(item.available_beds || 0),
  0
);

const filledBeds = sharingDetails.reduce(
  (sum, item) => sum + Number(item.filled_beds || 0),
  0
);

const lowestMonthlyPrice = sharingDetails.length
  ? Math.min(
      ...sharingDetails.map((item) => Number(item.monthly_price || 0))
    )
  : 0;

const occupancy = totalBeds > 0
  ? Math.min(100, Math.round((filledBeds / totalBeds) * 100))
  : 0;


  const rules = useMemo(
    () =>
      (listing?.restrictions ?? "")
        .split(/[\n;]+/)
        .map((rule) => rule.trim())
        .filter(Boolean),
    [listing?.restrictions]
  );

  // --------------------------------------------------------------------------
  // ACTIONS
  // --------------------------------------------------------------------------

  const openUrl = async (url: string, failMessage: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Unable to open", failMessage);
    }
  };

  const openGoogleMaps = () => {
    if (!listing?.latitude || !listing?.longitude) {
      Alert.alert(
        "Location unavailable",
        "Latitude and longitude were not saved for this listing."
      );
      return;
    }

    openUrl(
      `https://www.google.com/maps/search/?api=1&query=${listing.latitude},${listing.longitude}`,
      "Unable to open Google Maps."
    );
  };

  const callOwner = () => {
    if (!listing?.owner_phone) return;
    openUrl(`tel:${listing.owner_phone}`, "Unable to start the call.");
  };

  const whatsappOwner = () => {
    if (!listing?.owner_phone) return;
    openUrl(
      `https://wa.me/${phoneDigits(listing.owner_phone)}`,
      "WhatsApp is not available on this device."
    );
  };

  const managePhotos = () => {
    if (!listing) return;
    router.push({
      pathname: "/(owner)/listings/photos",
      params: { listingId: String(listing.id) },
    });
  };

  // ==========================================================================
  // STATES
  // ==========================================================================

  const header = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: "Listing Details",
        headerShadowVisible: false,
        headerStyle: { backgroundColor: "#F5F9FD" },
      }}
    />
  );

  if (loading) {
    return (
      <>
        {header}
        <View className="flex-1 items-center justify-center bg-[#F5F9FD]">
          <ActivityIndicator size="large" color="#2563EB" />
          <Text className="mt-3 text-[14px] text-[#64748B]">
            Loading listing...
          </Text>
        </View>
      </>
    );
  }

  if (error || !listing) {
    return (
      <>
        {header}
        <View className="flex-1 items-center justify-center bg-[#F5F9FD] px-8">
          <Text className="text-[40px]">📡</Text>

          <Text className="mt-3 text-center text-[19px] font-extrabold text-[#0F172A]">
            Couldn't load this listing
          </Text>

          <Text className="mt-2 text-center text-[13px] leading-5 text-[#64748B]">
            {error ?? "This property could not be loaded from the server."}
          </Text>

          <Pressable
            onPress={() => loadListing()}
            className="mt-6 rounded-[14px] bg-[#2563EB] px-8 py-3.5"
          >
            <Text className="text-[14px] font-extrabold text-white">
              Try Again
            </Text>
          </Pressable>
        </View>
      </>
    );
  }

  const status = statusStyle(listing.status);
  const bedsFull = totalBeds > 0 && availableBeds <= 0;
  const foodOn = (listing.food_available ?? "").toLowerCase() === "yes";
  const facilities = Array.isArray(listing.facilities) ? listing.facilities : [];


  async function deleteListing() {
  if (!listing?.id) {
    return;
  }

  Alert.alert(
    "Delete Property",
    `Are you sure you want to delete "${listing.name}"? This action cannot be undone.`,
    [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const url =
              `${API_BASE_URL}/api/v1/owner/listings/${listing.id}`;

            console.log(
              "Deleting listing:",
              url
            );

            const response = await fetch(
              url,
              {
                method: "DELETE",
                headers: {
                  Accept: "application/json",
                },
              }
            );

            const responseText =
              await response.text();

            let data: any = null;

            try {
              data = responseText
                ? JSON.parse(responseText)
                : null;
            } catch {
              data = null;
            }

            if (!response.ok) {
              const message =
                typeof data?.detail === "string"
                  ? data.detail
                  : `Failed to delete listing (${response.status})`;

              throw new Error(message);
            }

            Alert.alert(
              "Property Deleted",
              "The property has been deleted successfully.",
              [
                {
                  text: "OK",
                  onPress: () => {
                    router.replace(
                      "/(owner)/listings"
                    );
                  },
                },
              ]
            );
          } catch (error: any) {
            console.error(
              "Delete listing error:",
              error
            );

            Alert.alert(
              "Unable to delete property",
              error?.message ||
                "Something went wrong while deleting the property."
            );
          }
        },
      },
    ]
  );
}

  // ==========================================================================
  // UI
  // ==========================================================================

  return (
    <>
      {header}

      <View className="flex-1 bg-[#F5F9FD]">
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadListing(true)}
              tintColor="#2563EB"
              colors={["#2563EB"]}
            />
          }
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 110,
          }}
        >
          {/* HERO */}
          <View
            className="mb-4 rounded-[26px] p-5"
            style={{
              backgroundColor: "#1D4ED8",
              shadowColor: "#1D4ED8",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.25,
              shadowRadius: 12,
              elevation: 6,
            }}
          >
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-[24px] font-extrabold leading-8 text-white">
                  {listing.name}
                </Text>

                <Text className="mt-2 text-[13px] text-[#DBEAFE]">
                  📍 {listing.area}, {listing.city}
                </Text>
              </View>

              <View
                className="rounded-full px-3 py-1.5"
                style={{ backgroundColor: status.bg }}
              >
                <Text
                  className="text-[11px] font-extrabold capitalize"
                  style={{ color: status.fg }}
                >
                  {status.label}
                </Text>
              </View>
            </View>

            <View className="mt-4 flex-row flex-wrap">
              <Pill light text={listing.property_type} />
              <Pill light text={listing.gender} />
              <Pill light text={listing.ac_type} />
            </View>

            <View className="mt-2 flex-row items-end justify-between">
              <View>
                <Text className="text-[11px] font-bold uppercase text-[#BFDBFE]">
                  Monthly rent
                </Text>
                <View className="flex-row items-end">
                  <Text className="text-[32px] font-extrabold text-white">
                    {formatINR(lowestMonthlyPrice)}
                  </Text>
                  <Text className="mb-1.5 ml-1 text-[13px] text-[#BFDBFE]">
                    / month
                  </Text>
                </View>
              </View>

              <View className="items-end">
                <Text className="text-[11px] font-bold uppercase text-[#BFDBFE]">
                  Deposit
                </Text>
                <Text className="text-[16px] font-extrabold text-white">
                  {listing.security_deposit
                    ? formatINR(listing.security_deposit)
                    : "None"}
                </Text>
              </View>
            </View>
          </View>

          {/* BEDS */}
          <Card title="Beds & Availability" icon="🛏️">
            <View
                className="flex-row"
                style={{ columnGap: 10 }}
                >
                
                <StatTile
                  label="Total"
                  value={totalBeds}
                  color="#0F172A"
                  bg="#F1F5F9"
                />

                <StatTile
                  label="Available"
                  value={availableBeds}
                  color={bedsFull ? "#B91C1C" : "#15803D"}
                  bg={bedsFull ? "#FEE2E2" : "#DCFCE7"}
                />

                <StatTile
                  label="Filled"
                  value={filledBeds}
                  color="#1D4ED8"
                  bg="#DBEAFE"
                />

                </View>

            <View className="mt-4">
              <View className="mb-2 flex-row justify-between">
                <Text className="text-[12px] font-bold text-[#475569]">
                  Occupancy
                </Text>
                <Text className="text-[12px] font-extrabold text-[#0F172A]">
                  {bedsFull ? "Fully occupied" : `${occupancy}% filled`}
                </Text>
              </View>

              <View className="h-2.5 overflow-hidden rounded-full bg-[#E2E8F0]">
                <View
                  className="h-2.5 rounded-full"
                  style={{
                    width: `${occupancy}%` as `${number}%`,
                    backgroundColor: bedsFull ? "#DC2626" : "#2563EB",
                  }}
                />
              </View>
            </View>

            
<Text className="mb-2 mt-5 text-[13px] font-bold text-[#334155]">
  Sharing options
</Text>

{sharingDetails.length > 0 ? (
  sharingDetails.map((item) => (
    <View
      key={item.id || item.sharing_type}
      className="mb-3 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4"
    >
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-[15px] font-extrabold text-[#1D4ED8]">
          {sharingLabel(item.sharing_type)}
        </Text>

        <Text className="text-[15px] font-extrabold text-[#0F172A]">
          {formatINR(item.monthly_price)}/month
        </Text>
      </View>

      <View className="flex-row justify-between">
        <View>
          <Text className="text-[11px] text-[#64748B]">Total beds</Text>
          <Text className="mt-1 text-[14px] font-bold text-[#0F172A]">
            {item.total_beds}
          </Text>
        </View>

        <View>
          <Text className="text-[11px] text-[#64748B]">Available</Text>
          <Text className="mt-1 text-[14px] font-bold text-[#15803D]">
            {item.available_beds}
          </Text>
        </View>

        <View>
          <Text className="text-[11px] text-[#64748B]">Filled</Text>
          <Text className="mt-1 text-[14px] font-bold text-[#1D4ED8]">
            {item.filled_beds}
          </Text>
        </View>
      </View>
    </View>
  ))
) : (
  <Text className="text-[13px] text-[#94A3B8]">
    No sharing options added.
  </Text>
)}

          </Card>

          {/* ABOUT */}
          <Card title="About this property" icon="🏠">
            <Text className="text-[14px] leading-6 text-[#334155]">
              {listing.description?.trim() || "No description added."}
            </Text>
          </Card>

          {/* FACILITIES */}
          <Card title="Facilities" icon="✨">
            {facilities.length > 0 ? (
              <View className="flex-row flex-wrap">
                {facilities.map((item, index) => (
                  <View
                    key={`${item}-${index}`}
                    className="mb-2 mr-2 flex-row items-center rounded-[14px] bg-[#F8FAFC] px-3 py-2.5"
                    style={{ borderWidth: 1, borderColor: "#E2E8F0" }}
                  >
                    <Text className="mr-2 text-[15px]">
                      {FACILITY_ICONS[item] ?? "✔️"}
                    </Text>
                    <Text className="text-[13px] font-bold text-[#334155]">
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text className="text-[13px] text-[#94A3B8]">
                No facilities added.
              </Text>
            )}
          </Card>

          {/* FOOD */}
          <Card title="Food & Meal Timings" icon="🍽️">
            {foodOn ? (
              <>
                <MealRow icon="🍳" label="Breakfast" time={listing.breakfast_time} />
                <MealRow icon="🍛" label="Lunch" time={listing.lunch_time} />
                <MealRow icon="🌙" label="Dinner" time={listing.dinner_time} />
              </>
            ) : (
              <Text className="text-[13px] text-[#94A3B8]">
                Food is not provided at this property.
              </Text>
            )}
          </Card>

          {/* LOCATION */}
          <Card title="Location" icon="📍">
            <Text className="text-[14px] font-bold leading-6 text-[#0F172A]">
              {listing.address}
            </Text>

            <View className="mt-2">
              <InfoRow label="Area" value={listing.area} />
              <InfoRow label="City" value={listing.city} />
              <InfoRow
                label="Coordinates"
                value={
                  listing.latitude && listing.longitude
                    ? `${Number(listing.latitude).toFixed(5)}, ${Number(
                        listing.longitude
                      ).toFixed(5)}`
                    : null
                }
              />
            </View>

            <View className="mt-4 flex-row">
              <ActionButton
                variant="soft"
                label="🗺️  Open in Google Maps"
                onPress={openGoogleMaps}
              />
            </View>
          </Card>

          {/* RULES */}
          <Card title="Rules & Restrictions" icon="📋">
            {rules.length > 0 ? (
              rules.map((rule, index) => (
                <View key={`${rule}-${index}`} className="mb-2 flex-row">
                  <Text className="mr-2 text-[14px] text-[#2563EB]">•</Text>
                  <Text className="flex-1 text-[14px] leading-6 text-[#334155]">
                    {rule}
                  </Text>
                </View>
              ))
            ) : (
              <Text className="text-[13px] text-[#94A3B8]">
                No restrictions added.
              </Text>
            )}
          </Card>

          {/* OWNER */}
          <Card title="Owner Contact" icon="👤">
            {listing.owner_phone ? (
              <>
                <Text className="mb-4 text-[16px] font-extrabold text-[#0F172A]">
                  {listing.owner_phone}
                </Text>

                <View className="flex-row" style={{ columnGap: 10 }}>
                  <ActionButton label="📞  Call" onPress={callOwner} />
                  <ActionButton
                    variant="green"
                    label="💬  WhatsApp"
                    onPress={whatsappOwner}
                  />
                </View>
              </>
            ) : (
              <Text className="text-[13px] text-[#94A3B8]">
                No phone number added for this listing.
              </Text>
            )}
          </Card>

          
        <Pressable
          onPress={() =>
  router.push({
    pathname: "/(owner)/listings/create",
    params: {
      listingId: String(listing.id),
      mode: "edit",
    },
  })
}
          className="mb-3 rounded-xl border border-[#2563EB] bg-[#EFF6FF] px-4 py-4"
        >
          <Text className="text-center text-[15px] font-bold text-[#2563EB]">
            ✏️ Edit Property
          </Text>
        </Pressable>


           {/* =====================================================
    DELETE PROPERTY
====================================================== */}

<View className="mt-4 rounded-[22px] bg-white p-5">

  <View className="flex-row items-start">

    <View className="h-10 w-10 items-center justify-center rounded-full bg-[#FEE2E2]">
      <Text className="text-[18px]">
        🗑️
      </Text>
    </View>

    <View className="ml-3 flex-1">

      <Text className="text-[16px] font-extrabold text-[#991B1B]">
        Delete Property
      </Text>

      <Text className="mt-1 text-[12px] leading-5 text-[#64748B]">
        Permanently remove this PG or hostel
        listing from your account.
      </Text>

    </View>

  </View>

  <Pressable
    onPress={deleteListing}
    className="mt-4 items-center rounded-[16px] border border-[#FCA5A5] bg-[#FFF5F5] py-3.5"
    style={({ pressed }) => ({
      opacity: pressed ? 0.75 : 1,
    })}
  >
    <Text className="text-[14px] font-extrabold text-[#DC2626]">
      Delete Property
    </Text>
  </Pressable>

</View>
        </ScrollView>

        

        {/* STICKY BOTTOM BAR */}
        <View
          className="absolute bottom-0 left-0 right-0 border-t border-[#E8EEF5] bg-white px-5 pb-6 pt-3"
        >
          <View className="flex-row">
            <ActionButton label="📷  Manage Photos" onPress={managePhotos} />
          </View>
        </View>
      </View>
    </>
  );
}