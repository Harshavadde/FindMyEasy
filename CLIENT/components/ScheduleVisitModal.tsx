import { useEffect, useState, type ComponentProps } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { API_BASE_URL } from "../constants/api";
import type { NewScheduledVisit } from "../types/visit";
import type { Listing } from "../types/listing";

const VISIT_TIMES = [
  "9:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "2:00 PM",
  "3:00 PM",
  "4:00 PM",
  "5:00 PM",
  "6:00 PM",
];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

type Props = {
  visible: boolean;
  listing: Listing | null;
  onClose: () => void;
  onSubmit: (visit: NewScheduledVisit) => Promise<void> | void;
};

function getListingImageUrl(listing: Listing): string | undefined {
  const image =
    listing.images?.find(
      (item) => item.image_type?.toUpperCase() === "COVER"
    ) ?? listing.images?.[0];
  const url = image?.url;
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

function getStartingPrice(listing: Listing): number {
  const prices = (listing.sharing ?? [])
    .map((item) => Number(item.monthly_price))
    .filter((price) => Number.isFinite(price) && price > 0);

  if (prices.length > 0) return Math.min(...prices);

  const fallback = Number(listing.monthly_price);
  return Number.isFinite(fallback) ? fallback : 0;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateForStorage(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateSuggestions(): { label: string; date: Date }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return [0, 1, 2].map((offset) => {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    return {
      label:
        offset === 0
          ? "Today"
          : offset === 1
            ? "Tomorrow"
            : date.toLocaleDateString("en-IN", { weekday: "short" }),
      date,
    };
  });
}

function getCalendarDays(month: Date): (Date | null)[] {
  const firstWeekday = new Date(
    month.getFullYear(),
    month.getMonth(),
    1
  ).getDay();
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0
  ).getDate();

  return Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day > 0 && day <= daysInMonth
      ? new Date(month.getFullYear(), month.getMonth(), day)
      : null;
  });
}

export default function ScheduleVisitModal({
  visible,
  listing,
  onClose,
  onSubmit,
}: Props) {
  const insets = useSafeAreaInsets();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [preferredDate, setPreferredDate] = useState<Date | null>(null);
  const [preferredTime, setPreferredTime] = useState("");
  const [showSimilarProperties, setShowSimilarProperties] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showYearSelector, setShowYearSelector] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!visible) return;

    setPhoneNumber("");
    setPreferredDate(null);
    setPreferredTime("");
    setShowSimilarProperties(false);
    setShowDatePicker(false);
    setShowYearSelector(false);
    setFormError("");
  }, [visible, listing?.id]);

  const closeDatePicker = () => {
    setShowDatePicker(false);
    setShowYearSelector(false);
  };

  const openDatePicker = () => {
    const date = preferredDate ?? new Date();
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setShowYearSelector(false);
    setShowDatePicker(true);
  };

  const submitVisit = async () => {
    if (!listing) return;
    if (phoneNumber.length !== 10) {
      setFormError("Enter a valid 10-digit mobile number.");
      return;
    }
    if (!preferredDate) {
      setFormError("Choose a preferred date for your visit.");
      return;
    }
    if (!preferredTime) {
      setFormError("Choose a preferred time for your visit.");
      return;
    }

    setSubmitting(true);
    setFormError("");
    try {
      await onSubmit({
        listingId: String(listing.id),
        listingName: listing.name,
        area: listing.area,
        city: listing.city,
        phoneNumber,
        preferredDate: formatDateForStorage(preferredDate),
        preferredTime,
        showSimilarProperties,
      });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to submit your visit request."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!listing) return null;

  const imageUrl = getListingImageUrl(listing);
  const startingPrice = getStartingPrice(listing);
  const dateSuggestions = getDateSuggestions();
  const minimumVisitDate = new Date();
  minimumVisitDate.setHours(0, 0, 0, 0);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => {
        if (showDatePicker) {
          closeDatePicker();
          return;
        }
        onClose();
      }}
      statusBarTranslucent={false}
    >
      <SafeAreaView className="flex-1 bg-white" edges={["bottom"]}>
        <StatusBar barStyle="dark-content" />
        <View
          className="bg-white"
          style={{ height: Platform.OS === "ios" ? insets.top : 0 }}
        />
        <LinearGradient
          colors={["#2563EB", "#4F46E5"]}
          style={{
            paddingTop: 14,
            paddingBottom: 14,
            paddingHorizontal: 20,
          }}
        >
          <View className="flex-row items-center justify-between">
            <View
              className="min-w-0 flex-1 flex-row items-center"
              style={{ gap: 8 }}
            >
              <MaterialCommunityIcons
                name="calendar-check-outline"
                size={22}
                color="#FFFFFF"
              />
              <Text
                numberOfLines={1}
                style={{
                  color: "#FFFFFF",
                  fontSize: 18,
                  fontWeight: "700",
                  flexShrink: 1,
                }}
              >
                Schedule Visit
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close visit form"
              hitSlop={10}
              className="ml-3 h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full bg-white/20"
            >
              <MaterialCommunityIcons name="close" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </LinearGradient>

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 18,
              paddingBottom: 20,
            }}
          >
            <View className="mb-5 flex-row items-center rounded-[20px] border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
              {imageUrl ? (
                <Image
                  source={{ uri: imageUrl }}
                  className="h-[76px] w-[76px] rounded-[15px] bg-[#E2E8F0]"
                  resizeMode="cover"
                />
              ) : (
                <View className="h-[76px] w-[76px] items-center justify-center rounded-[15px] bg-[#E2E8F0]">
                  <MaterialCommunityIcons
                    name="home-city-outline"
                    size={28}
                    color="#64748B"
                  />
                </View>
              )}
              <View className="ml-3.5 flex-1">
                <Text
                  numberOfLines={2}
                  className="text-[15px] font-extrabold text-[#0F172A]"
                >
                  {listing.name}
                </Text>
                <Text className="mt-1 flex-row text-[12px] text-[#64748B]">
                  {listing.area}, {listing.city}
                </Text>
                <Text className="mt-1 text-[13px] font-bold text-[#2563EB]">
                  From ₹{startingPrice.toLocaleString("en-IN")}/mo
                </Text>
              </View>
            </View>

            <FormLabel icon="phone-outline" label="Mobile Number" />
            <View className="h-[54px] flex-row items-center rounded-[18px] border border-[#E2E8F0] px-4">
              <Text className="mr-2 text-[15px] font-semibold text-[#64748B]">
                +91
              </Text>
              <TextInput
                value={phoneNumber}
                onChangeText={(value) =>
                  setPhoneNumber(value.replace(/\D/g, "").slice(0, 10))
                }
                keyboardType="phone-pad"
                placeholder="Enter mobile number"
                placeholderTextColor="#94A3B8"
                maxLength={10}
                className="h-full flex-1 text-[15px] text-[#0F172A]"
                accessibilityLabel="Mobile number"
              />
            </View>
            <Text className="mt-2 text-[11px] text-[#64748B]">
              Visit requests are saved for this session.
            </Text>

            <View className="mt-6">
              <FormLabel icon="calendar-month-outline" label="Preferred Date" />
              <View className="mb-3 flex-row justify-between">
                {dateSuggestions.map(({ label, date }) => {
                  const selected =
                    preferredDate !== null &&
                    formatDateForStorage(preferredDate) ===
                      formatDateForStorage(date);
                  return (
                    <Pressable
                      key={formatDateForStorage(date)}
                      onPress={() => setPreferredDate(date)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      className={`w-[31.5%] items-center justify-center rounded-[16px] border px-2 py-3 ${
                        selected
                          ? "border-[#2563EB] bg-[#EFF6FF]"
                          : "border-[#E2E8F0] bg-white"
                      }`}
                    >
                      <Text
                        className={`text-[12px] font-bold ${
                          selected ? "text-[#1D4ED8]" : "text-[#475569]"
                        }`}
                      >
                        {label}
                      </Text>
                      <Text
                        className={`mt-1 text-[11px] ${
                          selected ? "text-[#2563EB]" : "text-[#64748B]"
                        }`}
                      >
                        {date.toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                onPress={openDatePicker}
                accessibilityRole="button"
                className="h-[50px] flex-row items-center rounded-[16px] border border-[#E2E8F0] px-4"
              >
                <MaterialCommunityIcons
                  name="calendar-month-outline"
                  size={20}
                  color="#2563EB"
                />
                <Text
                  className={`ml-3 text-[15px] ${
                    preferredDate
                      ? "font-semibold text-[#0F172A]"
                      : "text-[#94A3B8]"
                  }`}
                >
                  {preferredDate
                    ? formatDate(preferredDate)
                    : "Choose another date"}
                </Text>
                <MaterialCommunityIcons
                  name="chevron-down"
                  size={18}
                  color="#64748B"
                  style={{ marginLeft: "auto" }}
                />
              </Pressable>
            </View>

            <View className="mt-6">
              <FormLabel icon="clock-outline" label="Preferred Time" />
              <View className="flex-row flex-wrap justify-between">
                {VISIT_TIMES.map((time) => {
                  const selected = preferredTime === time;
                  return (
                    <Pressable
                      key={time}
                      onPress={() => setPreferredTime(time)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      className={`mb-2.5 w-[31.5%] items-center justify-center rounded-[16px] border py-3 ${
                        selected
                          ? "border-[#2563EB] bg-[#EFF6FF]"
                          : "border-[#E2E8F0] bg-white"
                      }`}
                    >
                      <Text
                        className={`text-[13px] font-semibold ${
                          selected ? "text-[#1D4ED8]" : "text-[#0F172A]"
                        }`}
                      >
                        {time}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Pressable
              onPress={() =>
                setShowSimilarProperties((current) => !current)
              }
              accessibilityRole="checkbox"
              accessibilityState={{ checked: showSimilarProperties }}
              className="mt-3 flex-row items-center rounded-[20px] border border-[#BFDBFE] bg-[#EFF6FF] p-4"
            >
              <View
                className={`h-6 w-6 items-center justify-center rounded-md border ${
                  showSimilarProperties
                    ? "border-[#2563EB] bg-[#2563EB]"
                    : "border-[#CBD5E1] bg-white"
                }`}
              >
                {showSimilarProperties ? (
                  <MaterialCommunityIcons
                    name="check"
                    size={17}
                    color="#FFFFFF"
                  />
                ) : null}
              </View>
              <View className="ml-3 flex-1">
                <View className="flex-row items-center">
                  <MaterialCommunityIcons
                    name="creation-outline"
                    size={16}
                    color="#2563EB"
                  />
                  <Text className="ml-1.5 text-[14px] font-bold text-[#0F172A]">
                    Show me similar properties
                  </Text>
                </View>
                <Text className="mt-1 text-[11px] text-[#64748B]">
                  Our team can share more options with you.
                </Text>
              </View>
            </Pressable>

            {formError ? (
              <Text
                accessibilityRole="alert"
                className="mt-3 text-[12px] font-semibold text-[#DC2626]"
              >
                {formError}
              </Text>
            ) : null}
          </ScrollView>

          <View className="border-t border-[#E2E8F0] px-5 pb-4 pt-3">
            <Pressable
              onPress={() => void submitVisit()}
              disabled={submitting}
              accessibilityRole="button"
              className="h-[58px] items-center justify-center rounded-[18px] bg-[#2563EB]"
              style={{ opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-[16px] font-extrabold text-white">
                  Schedule Visit
                </Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
        {showDatePicker ? (
          <View
            style={StyleSheet.absoluteFill}
            className="z-50 justify-end bg-black/40"
          >
            <Pressable
              onPress={closeDatePicker}
              accessibilityRole="button"
              accessibilityLabel="Close date picker"
              className="flex-1"
            />
            <View className="rounded-t-[28px] bg-white px-5 pb-6 pt-5">
              <View className="mb-3 flex-row items-center justify-between">
                <View>
                  <Text className="text-[18px] font-extrabold text-[#0F172A]">
                    Choose preferred date
                  </Text>
                  <Text className="mt-1 text-[11px] text-[#64748B]">
                    Select a day for your property visit.
                  </Text>
                </View>
                <Pressable
                  onPress={closeDatePicker}
                  accessibilityRole="button"
                  accessibilityLabel="Close date picker"
                  className="h-9 w-9 items-center justify-center rounded-full bg-[#F1F5F9]"
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={19}
                    color="#475569"
                  />
                </Pressable>
              </View>
              <View className="mb-3 flex-row items-center justify-between">
                {!showYearSelector ? (
                  <Pressable
                    onPress={() =>
                      setVisibleMonth(
                        (month) =>
                          new Date(
                            month.getFullYear(),
                            month.getMonth() - 1,
                            1
                          )
                      )
                    }
                    disabled={
                      visibleMonth.getFullYear() ===
                        minimumVisitDate.getFullYear() &&
                      visibleMonth.getMonth() === minimumVisitDate.getMonth()
                    }
                    accessibilityRole="button"
                    accessibilityLabel="Previous month"
                    className="h-10 w-10 items-center justify-center rounded-full bg-[#F1F5F9]"
                  >
                    <MaterialCommunityIcons
                      name="chevron-left"
                      size={22}
                      color="#334155"
                    />
                  </Pressable>
                ) : (
                  <View className="h-10 w-10" />
                )}
                <Pressable
                  onPress={() => setShowYearSelector((current) => !current)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showYearSelector ? "Show calendar" : "Choose year"
                  }
                  className="flex-row items-center rounded-full px-3 py-2"
                >
                  <Text className="text-[15px] font-extrabold text-[#0F172A]">
                    {showYearSelector
                      ? "Choose year"
                      : visibleMonth.toLocaleDateString("en-IN", {
                          month: "long",
                          year: "numeric",
                        })}
                  </Text>
                  <MaterialCommunityIcons
                    name={showYearSelector ? "chevron-up" : "chevron-down"}
                    size={18}
                    color="#475569"
                  />
                </Pressable>
                {!showYearSelector ? (
                  <Pressable
                    onPress={() =>
                      setVisibleMonth(
                        (month) =>
                          new Date(
                            month.getFullYear(),
                            month.getMonth() + 1,
                            1
                          )
                      )
                    }
                    accessibilityRole="button"
                    accessibilityLabel="Next month"
                    className="h-10 w-10 items-center justify-center rounded-full bg-[#F1F5F9]"
                  >
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={22}
                      color="#334155"
                    />
                  </Pressable>
                ) : (
                  <View className="h-10 w-10" />
                )}
              </View>
              {showYearSelector ? (
                <ScrollView
                  className="max-h-[280px]"
                  contentContainerStyle={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                  }}
                  showsVerticalScrollIndicator={false}
                >
                  {Array.from(
                    { length: 51 },
                    (_, index) => minimumVisitDate.getFullYear() + index
                  ).map((year) => {
                    const selected = year === visibleMonth.getFullYear();
                    return (
                      <Pressable
                        key={year}
                        onPress={() => {
                          setVisibleMonth(
                            (month) =>
                              new Date(year, month.getMonth(), 1)
                          );
                          setShowYearSelector(false);
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        style={{ width: "25%", height: 48 }}
                        className="items-center justify-center"
                      >
                        <View
                          className={`h-10 w-10 items-center justify-center rounded-full ${
                            selected ? "bg-[#2563EB]" : "bg-transparent"
                          }`}
                        >
                          <Text
                            className={`text-[14px] font-semibold ${
                              selected ? "text-white" : "text-[#334155]"
                            }`}
                          >
                            {year}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : (
                <>
                  <View className="mb-1 flex-row">
                    {WEEKDAYS.map((day) => (
                      <View
                        key={day}
                        style={{ width: "14.2857%", height: 32 }}
                        className="items-center justify-center"
                      >
                        <Text className="text-[11px] font-semibold text-[#64748B]">
                          {day}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <View className="flex-row flex-wrap">
                    {getCalendarDays(visibleMonth).map((date, index) => {
                      if (!date) {
                        return (
                          <View
                            key={`blank-${index}`}
                            style={{ width: "14.2857%", height: 42 }}
                          />
                        );
                      }

                      const dateKey = formatDateForStorage(date);
                      const disabled =
                        dateKey <
                        formatDateForStorage(minimumVisitDate);
                      const selected =
                        preferredDate !== null &&
                        dateKey === formatDateForStorage(preferredDate);

                      return (
                        <Pressable
                          key={dateKey}
                          onPress={() => {
                            setPreferredDate(date);
                            closeDatePicker();
                          }}
                          disabled={disabled}
                          accessibilityRole="button"
                          accessibilityLabel={formatDate(date)}
                          accessibilityState={{ selected, disabled }}
                          style={{ width: "14.2857%", height: 42 }}
                          className="items-center justify-center"
                        >
                          <View
                            className={`h-9 w-9 items-center justify-center rounded-full ${
                              selected ? "bg-[#2563EB]" : "bg-transparent"
                            }`}
                          >
                            <Text
                              className={`text-[13px] ${
                                selected
                                  ? "font-extrabold text-white"
                                  : disabled
                                    ? "text-[#CBD5E1]"
                                    : "font-semibold text-[#0F172A]"
                              }`}
                            >
                              {date.getDate()}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

function FormLabel({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View className="mb-2.5 flex-row items-center">
      <MaterialCommunityIcons
        name={icon}
        size={18}
        color="#2563EB"
      />
      <Text className="ml-2 text-[14px] font-bold text-[#0F172A]">{label}</Text>
    </View>
  );
}
