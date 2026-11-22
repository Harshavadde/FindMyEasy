import type { ComponentProps } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { API_BASE_URL } from "../constants/api";
import {
  getListingAudienceBadge,
  isVerifiedListing,
} from "../utils/listingPresentation";
import type { Listing } from "../types/listing";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

type Props = {
  visible: boolean;
  listing: Listing | null;
  onClose: () => void;
  onScheduleVisit?: () => void;
};

function getImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;

  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/uploads/")) {
      return `${API_BASE_URL}${parsed.pathname}${parsed.search}`;
    }
    return url;
  } catch {
    return url.startsWith("/uploads/") ? `${API_BASE_URL}${url}` : undefined;
  }
}

function formatPrice(value: number): string {
  return Number.isFinite(Number(value))
    ? Number(value).toLocaleString("en-IN")
    : "—";
}

function formatSharingLabel(value: string): string {
  const label = value.trim();
  const numericLabel = label.match(/^(\d+)(?:[\s-]*sharing)?$/i);
  if (numericLabel) return `${numericLabel[1]} Sharing`;
  if (/\bsharing$/i.test(label)) return label;
  return label ? `${label} Sharing` : "Sharing option";
}

function getListingCoordinates(
  listing: Listing
): { latitude: number; longitude: number } | null {
  if (!listing.latitude?.trim() || !listing.longitude?.trim()) return null;

  const latitude = Number(listing.latitude);
  const longitude = Number(listing.longitude);
  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
    ? { latitude, longitude }
    : null;
}

const NEARBY_ESSENTIALS: {
  label: string;
  subtitle: string;
  icon: IconName;
  color: string;
  background: string;
  query: string;
}[] = [
  {
    label: "Metro",
    subtitle: "Stations",
    icon: "train",
    color: "#2563EB",
    background: "#EFF6FF",
    query: "metro stations",
  },
  {
    label: "IT Parks",
    subtitle: "Workplaces",
    icon: "office-building",
    color: "#7C3AED",
    background: "#F5F3FF",
    query: "IT parks",
  },
  {
    label: "Coaching",
    subtitle: "Education hubs",
    icon: "school-outline",
    color: "#D97706",
    background: "#FFFBEB",
    query: "coaching centers",
  },
  {
    label: "Bus Stops",
    subtitle: "Nearby transit",
    icon: "bus",
    color: "#059669",
    background: "#ECFDF5",
    query: "bus stops",
  },
];

export default function ListingDetailSheet({
  visible,
  listing,
  onClose,
  onScheduleVisit,
}: Props) {
  const sharingOptions = useMemo(
    () => listing?.sharing ?? [],
    [listing?.sharing]
  );
  const [selectedSharingId, setSelectedSharingId] = useState<string | null>(
    sharingOptions[0]?.id ?? null
  );

  useEffect(() => {
    setSelectedSharingId(sharingOptions[0]?.id ?? null);
  }, [listing?.id, sharingOptions]);

  if (!listing) return null;

  const cover =
    listing.images?.find(
      (image) => image.image_type?.trim().toUpperCase() === "COVER"
    ) ?? listing.images?.[0];
  const coverUrl = getImageUrl(cover?.url);
  const audience = getListingAudienceBadge(listing.gender);
  const verified = isVerifiedListing(listing.status);
  const selectedSharing = sharingOptions.find(
    (option) => option.id === selectedSharingId
  );
  const displayPrice = selectedSharing?.monthly_price ?? listing.monthly_price;

  const openMap = async (searchTerm?: string) => {
    const coordinates = getListingCoordinates(listing);
    const address = listing.address.trim();
    if (!coordinates && !address) {
      Alert.alert(
        "Location unavailable",
        "This property does not have valid coordinates or an address for Maps."
      );
      return;
    }

    const locationQuery = coordinates
      ? `${coordinates.latitude},${coordinates.longitude}`
      : `${listing.name}, ${address}`;
    const query = searchTerm
      ? encodeURIComponent(`${searchTerm} near ${locationQuery}`)
      : encodeURIComponent(locationQuery);

    try {
      await Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${query}`
      );
    } catch (error: unknown) {
      Alert.alert(
        "Unable to open map",
        error instanceof Error
          ? error.message
          : "Please try opening the map again."
      );
    }
  };

  const openWhatsApp = async () => {
    const rawPhone = listing.owner_phone?.trim() ?? "";
    if (!rawPhone) {
      Alert.alert(
        "WhatsApp unavailable",
        "An owner phone number is not available for this property."
      );
      return;
    }

    const cleanPhone = rawPhone.replace(/[^0-9]/g, "");
    const formattedPhone =
      cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    if (!/^\d{11,15}$/.test(formattedPhone)) {
      Alert.alert(
        "WhatsApp unavailable",
        "A valid owner phone number is not available for this property."
      );
      return;
    }

    const message = encodeURIComponent(
      `Hi, I found ${listing.name} on FindEasy and would like to know about bed availability and rent details.`
    );
    const nativeUrl = `whatsapp://send?phone=${formattedPhone}&text=${message}`;
    const webUrl = `https://wa.me/${formattedPhone}?text=${message}`;
    let nativeOpenError: unknown;

    try {
      if (await Linking.canOpenURL(nativeUrl)) {
        await Linking.openURL(nativeUrl);
        return;
      }
    } catch (error: unknown) {
      nativeOpenError = error;
    }

    try {
      await Linking.openURL(webUrl);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : nativeOpenError instanceof Error
            ? nativeOpenError.message
            : "Please try contacting the owner again.";
      Alert.alert(
        "Unable to open WhatsApp",
        `WhatsApp could not be opened. ${errorMessage}`
      );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close property details"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView
            style={styles.detailScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.hero}>
              {coverUrl ? (
                <Image source={{ uri: coverUrl }} style={styles.heroImage} />
              ) : (
                <View style={[styles.heroImage, styles.imagePlaceholder]}>
                  <MaterialCommunityIcons
                    name="home-city-outline"
                    size={48}
                    color="#94A3B8"
                  />
                </View>
              )}
              <LinearGradient
                pointerEvents="none"
                colors={[
                  "rgba(15,23,42,0.02)",
                  "rgba(15,23,42,0.12)",
                  "rgba(15,23,42,0.88)",
                ]}
                style={StyleSheet.absoluteFill}
              />
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close property details"
                style={styles.closeButton}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={21}
                  color="#FFFFFF"
                />
              </Pressable>
              <View style={styles.heroText}>
                <View style={styles.heroBadges}>
                  <View
                    style={[
                      styles.audienceBadge,
                      {
                        backgroundColor: audience.backgroundColor,
                        borderColor: audience.borderColor,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.audienceText, { color: audience.textColor }]}
                    >
                      {audience.label}
                    </Text>
                  </View>
                  {verified ? (
                    <View style={styles.verifiedBadge}>
                      <MaterialCommunityIcons
                        name="check-decagram"
                        size={12}
                        color="#FFFFFF"
                      />
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                  ) : null}
                </View>
                <Text numberOfLines={2} style={styles.name}>
                  {listing.name}
                </Text>
                <View style={styles.locationRow}>
                  <MaterialCommunityIcons
                    name="map-marker"
                    size={14}
                    color="#E2E8F0"
                  />
                  <Text numberOfLines={1} style={styles.location}>
                    {listing.area}, {listing.city}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.priceCard}>
              <View>
                <Text style={styles.eyebrow}>Starting from</Text>
                <Text style={styles.price}>
                  ₹{formatPrice(displayPrice)}
                  <Text style={styles.priceUnit}> / month</Text>
                </Text>
              </View>
              <View style={styles.availability}>
                <View style={styles.availabilityDot} />
                <Text style={styles.beds}>{listing.available_beds} beds left</Text>
              </View>
            </View>

            {sharingOptions.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Select room sharing</Text>
                {sharingOptions.map((option) => {
                  const selected = option.id === selectedSharingId;
                  return (
                    <Pressable
                      key={option.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => setSelectedSharingId(option.id)}
                      style={[
                        styles.sharingOption,
                        selected && styles.selectedSharingOption,
                      ]}
                    >
                      <View style={styles.sharingLeft}>
                        <MaterialCommunityIcons
                          name={
                            selected
                              ? "radiobox-marked"
                              : "radiobox-blank"
                          }
                          size={20}
                          color={selected ? "#4F46E5" : "#94A3B8"}
                        />
                        <View style={styles.sharingText}>
                          <Text style={styles.sharingName}>
                            {formatSharingLabel(option.sharing_type)}
                          </Text>
                          <Text style={styles.sharingBeds}>
                            {option.available_beds} of {option.total_beds} beds available
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.sharingPrice}>
                        ₹{formatPrice(option.monthly_price)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {listing.food_available.trim().toLowerCase() === "yes" ? (
              <View style={styles.foodCard}>
                <View style={styles.foodIcon}>
                  <MaterialCommunityIcons
                    name="silverware-fork-knife"
                    size={18}
                    color="#B45309"
                  />
                </View>
                <View style={styles.foodContent}>
                  <Text style={styles.foodTitle}>Food included</Text>
                  <Text style={styles.foodText}>
                    {listing.food_type?.trim() || "Daily meals are available"}
                  </Text>
                </View>
              </View>
            ) : null}

            {listing.description?.trim() ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>About this stay</Text>
                <Text style={styles.description}>{listing.description.trim()}</Text>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Property details</Text>
              <View style={styles.detailsGrid}>
                <DetailChip label={listing.property_type} icon="home-outline" />
                <DetailChip label={listing.ac_type} icon="snowflake" />
                {listing.food_available.trim().toLowerCase() !== "yes" ? (
                  <DetailChip label="No food included" icon="food-off-outline" />
                ) : null}
                {(listing.facilities ?? []).map((facility) => (
                  <DetailChip
                    key={facility}
                    label={facility}
                    icon="check-circle-outline"
                  />
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Find essentials nearby</Text>
              <Text style={styles.essentialsSubtitle}>
                Explore useful places around this property
              </Text>
              <View style={styles.essentialsGrid}>
                {NEARBY_ESSENTIALS.map((item) => (
                  <Pressable
                    key={item.query}
                    accessibilityRole="button"
                    accessibilityLabel={`Find nearby ${item.label} on map`}
                    onPress={() => void openMap(item.query)}
                    style={styles.essentialCard}
                  >
                    <View
                      style={[
                        styles.essentialIcon,
                        { backgroundColor: item.background },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={item.icon}
                        size={21}
                        color={item.color}
                      />
                    </View>
                    <Text style={styles.essentialTitle}>{item.label}</Text>
                    <View style={styles.essentialSubtitleRow}>
                      <Text style={styles.essentialSubtitleText}>
                        {item.subtitle}
                      </Text>
                      <MaterialCommunityIcons
                        name="arrow-top-right"
                        size={14}
                        color="#94A3B8"
                      />
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Show ${listing.name} on map`}
              onPress={() => void openMap()}
              style={styles.addressCard}
            >
              <MaterialCommunityIcons
                name="map-marker-outline"
                size={18}
                color="#4F46E5"
              />
              <View style={styles.addressContent}>
                <Text numberOfLines={1} style={styles.mapListingName}>
                  {listing.name}
                </Text>
                <Text style={styles.addressText}>{listing.address}</Text>
              </View>
              <MaterialCommunityIcons
                name="arrow-top-right"
                size={17}
                color="#4F46E5"
              />
            </Pressable>
          </ScrollView>

          {onScheduleVisit ? (
            <View style={styles.footer}>
              <Pressable
                onPress={() => {
                  onClose();
                  onScheduleVisit();
                }}
                accessibilityRole="button"
                style={[styles.visitButton, styles.scheduleButton]}
              >
                <MaterialCommunityIcons
                  name="calendar-check-outline"
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.visitButtonText}>Schedule Free Visit</Text>
              </Pressable>
              <Pressable
                onPress={() => void openWhatsApp()}
                accessibilityRole="button"
                accessibilityLabel={`Message the owner of ${listing.name} on WhatsApp`}
                style={styles.whatsAppButton}
              >
                <MaterialCommunityIcons
                  name="whatsapp"
                  size={18}
                  color="#2563EB"
                />
                <Text style={styles.whatsAppButtonText}>WhatsApp</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function DetailChip({ label, icon }: { label: string; icon: IconName }) {
  return (
    <View style={styles.detailChip}>
      <MaterialCommunityIcons name={icon} size={14} color="#475569" />
      <Text numberOfLines={1} style={styles.detailChipText}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.5)",
  },
  sheet: {
    maxHeight: "92%",
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  handle: {
    position: "absolute",
    zIndex: 2,
    top: 8,
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 3,
    backgroundColor: "#FFFFFFB8",
  },
  detailScroll: { flexShrink: 1 },
  scrollContent: { paddingBottom: 10 },
  hero: { height: 230, overflow: "hidden" },
  heroImage: { width: "100%", height: "100%" },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E2E8F0",
  },
  closeButton: {
    position: "absolute",
    top: 18,
    right: 16,
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: "rgba(15,23,42,0.6)",
  },
  heroText: { position: "absolute", bottom: 16, left: 18, right: 18 },
  heroBadges: { flexDirection: "row", alignItems: "center", gap: 7 },
  audienceBadge: {
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  audienceText: { fontSize: 10, fontWeight: "800" },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 7,
    backgroundColor: "#16A34A",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  verifiedText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  name: {
    marginTop: 7,
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "800",
  },
  locationRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  location: { marginLeft: 3, color: "#E2E8F0", fontSize: 12, flex: 1 },
  priceCard: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  eyebrow: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  price: { marginTop: 3, color: "#0F172A", fontSize: 21, fontWeight: "800" },
  priceUnit: { color: "#64748B", fontSize: 11, fontWeight: "500" },
  availability: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 13,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  availabilityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  beds: { color: "#047857", fontSize: 10, fontWeight: "800" },
  section: { marginTop: 18, paddingHorizontal: 16 },
  sectionTitle: {
    marginBottom: 9,
    color: "#64748B",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  sharingOption: {
    minHeight: 62,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  selectedSharingOption: {
    borderColor: "#6366F1",
    backgroundColor: "#EEF2FF",
  },
  sharingLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  sharingText: { marginLeft: 9, flex: 1 },
  sharingName: { color: "#0F172A", fontSize: 12, fontWeight: "800" },
  sharingBeds: { marginTop: 3, color: "#64748B", fontSize: 10 },
  sharingPrice: { marginLeft: 8, color: "#0F172A", fontSize: 13, fontWeight: "800" },
  foodCard: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 15,
    backgroundColor: "#FFFBEB",
  },
  foodIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: "#FEF3C7",
  },
  foodContent: { marginLeft: 10, flex: 1 },
  foodTitle: { color: "#92400E", fontSize: 12, fontWeight: "800" },
  foodText: { marginTop: 3, color: "#A16207", fontSize: 11 },
  description: { color: "#475569", fontSize: 12, lineHeight: 19 },
  detailsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  detailChip: {
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  detailChipText: { maxWidth: 230, color: "#475569", fontSize: 10, fontWeight: "700" },
  addressCard: {
    marginHorizontal: 16,
    marginTop: 17,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    backgroundColor: "#EEF2FF",
  },
  addressContent: { marginLeft: 7, marginRight: 6, flex: 1 },
  mapListingName: { color: "#4338CA", fontSize: 12, fontWeight: "800" },
  addressText: { marginTop: 3, color: "#64748B", fontSize: 10, lineHeight: 15 },
  essentialsSubtitle: {
    marginBottom: 12,
    color: "#64748B",
    fontSize: 11,
    lineHeight: 17,
  },
  essentialsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  essentialCard: {
    width: "48%",
    marginBottom: 9,
    padding: 11,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
  },
  essentialIcon: {
    width: 38,
    height: 38,
    marginBottom: 9,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  essentialTitle: { color: "#0F172A", fontSize: 12, fontWeight: "800" },
  essentialSubtitleRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  essentialSubtitleText: { color: "#64748B", fontSize: 9 },
  footer: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    backgroundColor: "#FFFFFF",
  },
  visitButton: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 15,
  },
  scheduleButton: { flex: 1, backgroundColor: "#2563EB" },
  visitButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  whatsAppButton: {
    width: 116,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 15,
    backgroundColor: "#EFF6FF",
  },
  whatsAppButtonText: { color: "#1D4ED8", fontSize: 11, fontWeight: "800" },
});
