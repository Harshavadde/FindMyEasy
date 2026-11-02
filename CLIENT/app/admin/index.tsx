import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";

import { API_BASE_URL } from "../../constants/api";
import { useAuth } from "../../contexts/AuthContext";
import {
  getAdminListings,
  updateAdminListingStatus,
  type AdminListing,
} from "../../services/adminApi";

type ListingFilter = "all" | "review" | "published" | "rejected";

const palette = {
  ink: "#17243A",
  muted: "#748198",
  border: "#E5EAF1",
  canvas: "#F5F7FB",
  navy: "#17243A",
  blue: "#3266D5",
  green: "#168566",
  red: "#C34D53",
};

function imageUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

function statusColors(status: string) {
  switch (status.toLowerCase()) {
    case "published":
      return { background: "#E5F5EF", foreground: "#168566" };
    case "rejected":
      return { background: "#FCEBEC", foreground: "#B64048" };
    default:
      return { background: "#FFF3DE", foreground: "#A66B13" };
  }
}

function StatusBadge({ status }: { status: string }) {
  const colors = statusColors(status);
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 99,
        paddingHorizontal: 11,
        paddingVertical: 6,
        backgroundColor: colors.background,
      }}
    >
      <Text
        style={{
          color: colors.foreground,
          fontSize: 11,
          fontWeight: "800",
          textTransform: "capitalize",
        }}
      >
        {status.replace(/_/g, " ")}
      </Text>
    </View>
  );
}

function Metric({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: number;
  detail: string;
  accent: string;
}) {
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: 185,
        minHeight: 116,
        padding: 18,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: "#FFFFFF",
      }}
    >
      <Text style={{ color: palette.muted, fontSize: 12, fontWeight: "700" }}>
        {label}
      </Text>
      <Text
        style={{
          marginTop: 10,
          color: palette.ink,
          fontSize: 29,
          fontWeight: "800",
        }}
      >
        {value}
      </Text>
      <Text style={{ marginTop: 3, color: accent, fontSize: 11 }}>
        {detail}
      </Text>
    </View>
  );
}

function ListingCard({
  listing,
  busy,
  onChangeStatus,
}: {
  listing: AdminListing;
  busy: boolean;
  onChangeStatus: (
    listing: AdminListing,
    status: "published" | "rejected"
  ) => void;
}) {
  const cover =
    listing.images?.find(
      (image) => image.image_type.toUpperCase() === "COVER"
    ) ?? listing.images?.[0];
  const isPublished = listing.status === "published";
  const isRejected = listing.status === "rejected";

  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: 410,
        overflow: "hidden",
        marginBottom: 16,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: "#FFFFFF",
      }}
    >
      {cover ? (
        <Image
          source={{ uri: imageUrl(cover.image_url) }}
          resizeMode="cover"
          style={{ width: "100%", height: 170, backgroundColor: "#E9EEF5" }}
        />
      ) : (
        <View
          style={{
            height: 112,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#EAF0F8",
          }}
        >
          <Text style={{ color: "#8290A4", fontSize: 13, fontWeight: "700" }}>
            PROPERTY PHOTOS NOT ADDED
          </Text>
        </View>
      )}

      <View style={{ padding: 18 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={2}
              style={{ color: palette.ink, fontSize: 18, fontWeight: "800" }}
            >
              {listing.name}
            </Text>
            <Text style={{ marginTop: 5, color: palette.muted, fontSize: 12 }}>
              {listing.property_type} · {listing.gender}
            </Text>
          </View>
          <StatusBadge status={listing.status} />
        </View>

        <Text
          style={{
            marginTop: 14,
            color: "#47566D",
            fontSize: 13,
            lineHeight: 20,
          }}
        >
          {listing.area}, {listing.city} · {listing.address}
        </Text>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 14,
          }}
        >
          <DetailPill
            text={`₹${Number(listing.monthly_price).toLocaleString("en-IN")} / month`}
          />
          <DetailPill
            text={`${listing.available_beds} of ${listing.total_beds} beds available`}
          />
          <DetailPill text={`Owner ${listing.owner_phone || "not provided"}`} />
        </View>

        {!!listing.description && (
          <Text
            numberOfLines={3}
            style={{
              marginTop: 13,
              color: palette.muted,
              fontSize: 12,
              lineHeight: 19,
            }}
          >
            {listing.description}
          </Text>
        )}

        <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
          {!isPublished && (
            <StatusAction
              title={isRejected ? "Approve listing" : "Approve & publish"}
              color={palette.green}
              disabled={busy}
              onPress={() => onChangeStatus(listing, "published")}
            />
          )}
          {!isRejected && (
            <StatusAction
              title="Reject"
              color={palette.red}
              disabled={busy}
              onPress={() => onChangeStatus(listing, "rejected")}
            />
          )}
        </View>
        {busy && (
          <ActivityIndicator
            style={{ position: "absolute", right: 18, bottom: 20 }}
            color={palette.blue}
          />
        )}
      </View>
    </View>
  );
}

function DetailPill({ text }: { text: string }) {
  return (
    <View
      style={{
        borderRadius: 8,
        paddingHorizontal: 9,
        paddingVertical: 7,
        backgroundColor: "#F3F6FA",
      }}
    >
      <Text style={{ color: "#536178", fontSize: 11, fontWeight: "600" }}>
        {text}
      </Text>
    </View>
  );
}

function StatusAction({
  title,
  color,
  disabled,
  onPress,
}: {
  title: string;
  color: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 42,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 10,
        backgroundColor: disabled ? "#E9EDF3" : color,
        opacity: pressed ? 0.84 : 1,
      })}
    >
      <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "800" }}>
        {title}
      </Text>
    </Pressable>
  );
}

export default function AdminDashboard() {
  const { logout, user } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 980;
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [filter, setFilter] = useState<ListingFilter>("review");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyListingId, setBusyListingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadListings = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      setListings(await getAdminListings());
      setError(null);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Unable to load listings from the server.";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadListings();
    }, [loadListings])
  );

  const reviewCount = listings.filter(
    (listing) => listing.status === "draft" || listing.status === "pending"
  ).length;
  const publishedCount = listings.filter(
    (listing) => listing.status === "published"
  ).length;
  const rejectedCount = listings.filter(
    (listing) => listing.status === "rejected"
  ).length;

  const visibleListings = useMemo(() => {
    const query = search.trim().toLowerCase();
    return listings.filter((listing) => {
      const statusMatches =
        filter === "all" ||
        (filter === "review" &&
          (listing.status === "draft" || listing.status === "pending")) ||
        listing.status === filter;
      const queryMatches =
        !query ||
        [
          listing.name,
          listing.area,
          listing.city,
          listing.address,
          listing.owner_phone,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      return statusMatches && queryMatches;
    });
  }, [filter, listings, search]);

  const changeStatus = useCallback(
    async (listing: AdminListing, status: "published" | "rejected") => {
      setBusyListingId(listing.id);
      try {
        const updated = await updateAdminListingStatus(listing.id, status);
        setListings((current) =>
          current.map((item) => (item.id === updated.id ? updated : item))
        );
      } catch (updateError) {
        Alert.alert(
          "Unable to update listing",
          updateError instanceof Error
            ? updateError.message
            : "Please try again."
        );
      } finally {
        setBusyListingId(null);
      }
    },
    []
  );

  const filterOptions: { key: ListingFilter; label: string }[] = [
    { key: "review", label: `Needs review · ${reviewCount}` },
    { key: "all", label: `All listings · ${listings.length}` },
    { key: "published", label: `Published · ${publishedCount}` },
    { key: "rejected", label: `Rejected · ${rejectedCount}` },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.canvas }}>
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 1440,
          alignSelf: "center",
          flexDirection: isWide ? "row" : "column",
        }}
      >
        <View
          style={{
            width: isWide ? 232 : "100%",
            paddingHorizontal: 22,
            paddingVertical: isWide ? 28 : 16,
            backgroundColor: palette.navy,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
            <View
              style={{
                width: 38,
                height: 38,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 12,
                backgroundColor: "#3266D5",
              }}
            >
              <Text style={{ color: "white", fontSize: 18, fontWeight: "900" }}>
                F
              </Text>
            </View>
            <View>
              <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "800" }}>
                FindEasy
              </Text>
              <Text style={{ color: "#AAB7CA", fontSize: 10 }}>
                ADMIN CONSOLE
              </Text>
            </View>
          </View>

          {isWide && (
            <>
              <Text
                style={{
                  marginTop: 42,
                  marginBottom: 12,
                  color: "#8797AF",
                  fontSize: 10,
                  fontWeight: "800",
                  letterSpacing: 1,
                }}
              >
                WORKSPACE
              </Text>
              <View
                style={{
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  backgroundColor: "#263650",
                }}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700" }}>
                  ▦   Listing review
                </Text>
              </View>
              <Text
                style={{
                  marginTop: "auto",
                  paddingTop: 36,
                  color: "#AAB7CA",
                  fontSize: 11,
                  lineHeight: 18,
                }}
              >
                Signed in as{"\n"}
                <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>
                  {user?.full_name || "Administrator"}
                </Text>
              </Text>
            </>
          )}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View
            style={{
              minHeight: 68,
              paddingHorizontal: isWide ? 32 : 20,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottomWidth: 1,
              borderBottomColor: palette.border,
              backgroundColor: "#FFFFFF",
            }}
          >
            <Text style={{ color: palette.muted, fontSize: 12 }}>
              FindEasy  /  Admin  /  Listing review
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void logout()}
              style={{ paddingHorizontal: 12, paddingVertical: 9 }}
            >
              <Text style={{ color: palette.ink, fontSize: 12, fontWeight: "700" }}>
                Sign out
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: isWide ? 32 : 18,
              paddingTop: 28,
              paddingBottom: 50,
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void loadListings(true)}
              />
            }
          >
            <View
              style={{
                flexDirection: isWide ? "row" : "column",
                alignItems: isWide ? "center" : "flex-start",
                justifyContent: "space-between",
                gap: 16,
                marginBottom: 22,
              }}
            >
              <View>
                <Text style={{ color: palette.ink, fontSize: 26, fontWeight: "800" }}>
                  Listing review
                </Text>
                <Text style={{ marginTop: 6, color: palette.muted, fontSize: 13 }}>
                  Review partner properties and manage marketplace visibility.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => void loadListings(true)}
                style={{
                  borderRadius: 10,
                  paddingHorizontal: 15,
                  paddingVertical: 11,
                  backgroundColor: "#FFFFFF",
                  borderWidth: 1,
                  borderColor: palette.border,
                }}
              >
                <Text style={{ color: palette.ink, fontSize: 12, fontWeight: "700" }}>
                  Refresh data
                </Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <Metric
                label="NEEDS REVIEW"
                value={reviewCount}
                detail="Draft and pending applications"
                accent="#A66B13"
              />
              <Metric
                label="PUBLISHED"
                value={publishedCount}
                detail="Visible in marketplace"
                accent={palette.green}
              />
              <Metric
                label="REJECTED"
                value={rejectedCount}
                detail="Not visible to seekers"
                accent={palette.red}
              />
              <Metric
                label="TOTAL PROPERTIES"
                value={listings.length}
                detail="Loaded from the database"
                accent={palette.blue}
              />
            </View>

            <View
              style={{
                marginTop: 26,
                padding: 18,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: palette.border,
                backgroundColor: "#FFFFFF",
              }}
            >
              <Text style={{ color: palette.ink, fontSize: 15, fontWeight: "800" }}>
                Partner applications
              </Text>
              <Text style={{ marginTop: 4, color: palette.muted, fontSize: 12 }}>
                Review property details before approving a listing for seekers.
              </Text>

              <TextInput
                accessibilityLabel="Search listings"
                value={search}
                onChangeText={setSearch}
                placeholder="Search property, location or owner phone"
                placeholderTextColor="#97A2B3"
                style={{
                  height: 44,
                  marginTop: 16,
                  paddingHorizontal: 13,
                  borderRadius: 9,
                  borderWidth: 1,
                  borderColor: palette.border,
                  color: palette.ink,
                  backgroundColor: "#FFFFFF",
                  fontSize: 13,
                }}
              />

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  flexDirection: "row",
                  gap: 8,
                  paddingTop: 13,
                  paddingBottom: 3,
                }}
              >
                {filterOptions.map((option) => {
                  const selected = filter === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      accessibilityRole="button"
                      onPress={() => setFilter(option.key)}
                      style={{
                        borderRadius: 99,
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                        backgroundColor: selected ? palette.navy : "#F2F5F9",
                      }}
                    >
                      <Text
                        style={{
                          color: selected ? "#FFFFFF" : "#59677D",
                          fontSize: 11,
                          fontWeight: "700",
                        }}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {loading ? (
              <View style={{ alignItems: "center", paddingVertical: 54 }}>
                <ActivityIndicator color={palette.blue} />
                <Text style={{ marginTop: 12, color: palette.muted, fontSize: 13 }}>
                  Loading applications from FindEasy...
                </Text>
              </View>
            ) : error ? (
              <View
                style={{
                  marginTop: 18,
                  padding: 20,
                  borderRadius: 14,
                  backgroundColor: "#FFFFFF",
                }}
              >
                <Text style={{ color: palette.red, fontSize: 14, fontWeight: "700" }}>
                  Could not load admin data
                </Text>
                <Text style={{ marginTop: 7, color: palette.muted, fontSize: 12 }}>
                  {error}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void loadListings()}
                  style={{ marginTop: 14 }}
                >
                  <Text style={{ color: palette.blue, fontWeight: "700" }}>
                    Try again
                  </Text>
                </Pressable>
              </View>
            ) : visibleListings.length === 0 ? (
              <View
                style={{
                  alignItems: "center",
                  marginTop: 18,
                  paddingHorizontal: 20,
                  paddingVertical: 42,
                  borderRadius: 14,
                  backgroundColor: "#FFFFFF",
                }}
              >
                <Text style={{ color: palette.ink, fontSize: 15, fontWeight: "800" }}>
                  No listings in this view
                </Text>
                <Text style={{ marginTop: 6, color: palette.muted, fontSize: 12 }}>
                  Try another status filter or search term.
                </Text>
              </View>
            ) : (
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  marginTop: 18,
                }}
              >
                {visibleListings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    busy={busyListingId === listing.id}
                    onChangeStatus={changeStatus}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}
