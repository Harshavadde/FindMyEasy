import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";

/*
 * ============================================================
 * MOCK CITY / AREA DATA
 * ============================================================
 *
 * Temporary UI data.
 *
 * Later, these can come from the backend.
 */

const cityAreas: Record<string, string[]> = {
  Hyderabad: [
    "Madhapur",
    "Gachibowli",
    "Kondapur",
    "Hitech City",
    "Kukatpally",
    "Ameerpet",
    "Begumpet",
    "Banjara Hills",
    "Jubilee Hills",
    "Secunderabad",
  ],

  Bengaluru: [
    "Whitefield",
    "Marathahalli",
    "Electronic City",
    "Koramangala",
    "HSR Layout",
    "BTM Layout",
    "Bellandur",
    "Indiranagar",
    "Yelahanka",
    "Hebbal",
  ],

  Chennai: [
    "T Nagar",
    "Anna Nagar",
    "Velachery",
    "Guindy",
    "Adyar",
    "OMR",
  ],

  Pune: [
    "Hinjewadi",
    "Wakad",
    "Baner",
    "Kharadi",
    "Viman Nagar",
    "Kothrud",
  ],

  Mumbai: [
    "Andheri",
    "Powai",
    "Bandra",
    "Goregaon",
    "Thane",
    "Navi Mumbai",
  ],
};

const cities = Object.keys(cityAreas);

/*
 * ============================================================
 * PG TYPE OPTIONS
 * ============================================================
 *
 * MULTIPLE SELECTION
 */


const pgTypes = [
  "Boy's",
  "Girl's",
  "Co-living",
];

/*
 * ============================================================
 * ROOM SHARING OPTIONS
 * ============================================================
 *
 * MULTIPLE SELECTION
 */

const roomSharingOptions = [
  "Single Sharing",
  "2 Sharing",
  "3 Sharing",
  "4 Sharing",
  "5 Sharing",
  "6 Sharing",
  "7+ Sharing",
];

/*
 * ============================================================
 * AC / NON-AC OPTIONS
 * ============================================================
 *
 * SINGLE SELECTION
 */

const acOptions = [
  "AC",
  "Non-AC",
];

/*
 * ============================================================
 * CHECKBOX COMPONENT
 * ============================================================
 */

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <View
      className={`h-6 w-6 items-center justify-center rounded-md border-2 ${
        checked
          ? "border-[#2563EB] bg-[#2563EB]"
          : "border-[#CBD5E1] bg-white"
      }`}
    >
      {checked && (
        <MaterialCommunityIcons
          name="check"
          size={16}
          color="#FFFFFF"
        />
      )}
    </View>
  );
}

/*
 * ============================================================
 * RADIO BUTTON COMPONENT
 * ============================================================
 */

function RadioButton({ selected }: { selected: boolean }) {
  return (
    <View
      className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
        selected
          ? "border-[#2563EB]"
          : "border-[#CBD5E1]"
      }`}
    >
      {selected && (
        <View className="h-3 w-3 rounded-full bg-[#2563EB]" />
      )}
    </View>
  );
}

/*
 * ============================================================
 * PG PAGE
 * ============================================================
 */

export default function PGPage() {

  const [selectedPropertyType, setSelectedPropertyType] =
  useState<"PG" | "Hostel">("PG");
  /*
   * ==========================================================
   * CITY
   * SINGLE SELECTION
   * ==========================================================
   */

  const [selectedCity, setSelectedCity] =
    useState<string | null>(null);

  /*
   * ==========================================================
   * AREA
   * MULTIPLE SELECTION
   * ==========================================================
   */

  const [selectedAreas, setSelectedAreas] =
    useState<string[]>([]);

  /*
   * ==========================================================
   * PG TYPE
   * MULTIPLE SELECTION
   * ==========================================================
   */

  const [selectedPGTypes, setSelectedPGTypes] =
    useState<string[]>([]);

    const hostelTypes = ["Boy's ", "Girl's"];

const [selectedHostelTypes, setSelectedHostelTypes] =
  useState<string[]>([]);


  /*
   * ==========================================================
   * ROOM SHARING
   * MULTIPLE SELECTION
   * ==========================================================
   */

  const [selectedRoomSharing, setSelectedRoomSharing] =
    useState<string[]>([]);

  /*
   * ==========================================================
   * AC / NON-AC
   * SINGLE SELECTION
   * ==========================================================
   */

  const [selectedAcTypes, setSelectedAcTypes] = useState<string[]>([]);

  /*
   * ==========================================================
   * MODAL STATES
   * ==========================================================
   */

  const [cityModalVisible, setCityModalVisible] =
    useState(false);

  const [areaModalVisible, setAreaModalVisible] =
    useState(false);

  const [roomSharingModalVisible, setRoomSharingModalVisible] =
    useState(false);

  /*
   * ==========================================================
   * SELECT CITY
   * SINGLE SELECTION
   *
   * When city changes:
   * - selected city is updated
   * - previously selected areas are cleared
   * ==========================================================
   */

  const selectCity = (city: string) => {
    setSelectedCity(city);

    // Areas belong to the selected city.
    // Therefore clear old city areas.
    setSelectedAreas([]);

    setCityModalVisible(false);
  };

  /*
   * ==========================================================
   * TOGGLE AREA
   * MULTIPLE SELECTION
   * ==========================================================
   */

  const toggleArea = (area: string) => {
    setSelectedAreas((currentAreas) => {
      if (currentAreas.includes(area)) {
        return currentAreas.filter(
          (item) => item !== area
        );
      }

      return [...currentAreas, area];
    });
  };

  /*
   * ==========================================================
   * TOGGLE PG TYPE
   * MULTIPLE SELECTION
   * ==========================================================
   */

  const togglePGType = (type: string) => {
    setSelectedPGTypes((currentTypes) => {
      if (currentTypes.includes(type)) {
        return currentTypes.filter(
          (item) => item !== type
        );
      }

      return [...currentTypes, type];
    });
  };

  /*
   * ==========================================================
   * TOGGLE ROOM SHARING
   * MULTIPLE SELECTION
   * ==========================================================
   */

  const toggleRoomSharing = (sharing: string) => {
    setSelectedRoomSharing((currentSharing) => {
      if (currentSharing.includes(sharing)) {
        return currentSharing.filter(
          (item) => item !== sharing
        );
      }

      return [...currentSharing, sharing];
    });
  };

  
 

  /*
   * ==========================================================
   * AREA SUMMARY
   * ==========================================================
   */

  const getAreaSummary = () => {
    if (selectedAreas.length === 0) {
      return "Select area";
    }

    if (selectedAreas.length <= 2) {
      return selectedAreas.join(", ");
    }

    return `${selectedAreas[0]} + ${
      selectedAreas.length - 1
    } more`;
  };

  /*
   * ==========================================================
   * ROOM SHARING SUMMARY
   * ==========================================================
   */

  const getRoomSharingSummary = () => {
    if (selectedRoomSharing.length === 0) {
      return "Select sharing";
    }

    if (selectedRoomSharing.length <= 2) {
      return selectedRoomSharing.join(", ");
    }

    return `${selectedRoomSharing.length} options selected`;
  };

  /*
   * ==========================================================
   * FIND PGs
   *
   * Send the selected filters to home.tsx.
   *
   * We use JSON strings because Expo Router params
   * are URL parameters.
   * ==========================================================
   */

  const handleFindPGs = () => {
  if (!selectedCity) {
    return;
  }

  router.push({
    pathname: "/home",
    params: {
      pgSearch: "true",
      propertyType: selectedPropertyType,
      pgCity: selectedCity,
      pgAreas: JSON.stringify(selectedAreas),
      pgTypes: JSON.stringify(
        selectedPropertyType === "PG"
          ? selectedPGTypes
          : selectedHostelTypes
      ),
      pgSharing: JSON.stringify(selectedRoomSharing),
      pgAcTypes: JSON.stringify(selectedAcTypes),
    },
  });
};
  /*
   * ==========================================================
   * CURRENT CITY AREAS
   * ==========================================================
   */

  const availableAreas = selectedCity
    ? cityAreas[selectedCity] ?? []
    : [];

  /*
   * ==========================================================
   * PAGE UI
   * ==========================================================
   */

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC]">

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 40,
        }}
      >

        {/* ==================================================
            HEADER
        ================================================== */}

        <View className="flex-row items-center px-5 pt-4">

          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full bg-white"
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color="#0F172A"
            />
          </Pressable>

          <Text className="ml-4 text-2xl font-bold text-[#0F172A]">
            PG
          </Text>

        </View>

        {/* ==================================================
            PAGE TITLE
        ================================================== */}

        <View className="px-5 pt-7">

          <Text className="text-2xl font-extrabold text-[#0F172A]">
            Find a PG
          </Text>

          <Text className="mt-2 text-base text-[#64748B]">
            Choose your preferences to find the right PG.
          </Text>

        </View>

        {/* ==================================================
            FILTER SECTION
        ================================================== */}

        <View className="mt-7 px-5">

          <Text className="text-lg font-bold text-[#0F172A]">
            Filters
          </Text>

          {/* =================================================
              1. CITY
              SINGLE SELECTION
              RADIO BUTTON
          ================================================= */}

          <Pressable
            onPress={() => setCityModalVisible(true)}
            className="mt-4 rounded-2xl border border-[#E2E8F0] bg-white p-4"
          >

            <Text className="text-sm text-[#64748B]">
              City
            </Text>

            <View className="mt-2 flex-row items-center justify-between">

              <Text
                className={`flex-1 text-base font-semibold ${
                  selectedCity
                    ? "text-[#0F172A]"
                    : "text-[#94A3B8]"
                }`}
              >
                {selectedCity || "Select city"}
              </Text>

              <MaterialCommunityIcons
                name="chevron-down"
                size={24}
                color="#64748B"
              />

            </View>

          </Pressable>

          {/* =================================================
              2. AREA
              MULTIPLE SELECTION
              CHECKBOX
          ================================================= */}

          <Pressable
            disabled={!selectedCity}
            onPress={() => setAreaModalVisible(true)}
            className={`mt-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 ${
              !selectedCity ? "opacity-50" : ""
            }`}
          >

            <Text className="text-sm text-[#64748B]">
              Area
            </Text>

            <View className="mt-2 flex-row items-center justify-between">

              <Text
                className={`flex-1 text-base font-semibold ${
                  selectedAreas.length > 0
                    ? "text-[#0F172A]"
                    : "text-[#94A3B8]"
                }`}
              >
                {!selectedCity
                  ? "Select city first"
                  : getAreaSummary()}
              </Text>

              <MaterialCommunityIcons
                name="chevron-down"
                size={24}
                color="#64748B"
              />

            </View>

          </Pressable>
          
{/* PROPERTY TYPE — SINGLE SELECTION */}
<View className="mt-4 rounded-2xl border border-[#E2E8F0] bg-white p-4">
  <Text className="text-sm text-[#64748B]">
    Property Type
  </Text>

  <View className="mt-3 flex-row gap-3">
    {(["PG", "Hostel"] as const).map((type) => {
      const selected = selectedPropertyType === type;

      return (
        <Pressable
          key={type}
         onPress={() => {
  setSelectedPropertyType(type);
  setSelectedPGTypes([]);
  setSelectedHostelTypes([]);
}}
          className={`flex-1 items-center rounded-xl border py-3 ${
            selected
              ? "border-[#2563EB] bg-[#EFF6FF]"
              : "border-[#E2E8F0] bg-white"
          }`}
        >
          <Text
            className={`font-bold ${
              selected ? "text-[#2563EB]" : "text-[#475569]"
            }`}
          >
            {type}
          </Text>
        </Pressable>
      );
    })}
  </View>
</View>


          {/* =================================================
              3. PG TYPE
              MULTIPLE SELECTION
              CHECKBOX
              DIRECTLY DISPLAYED
          ================================================= */}

          
{/* PG TYPE / HOSTEL TYPE */}
<View className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
  <Text className="text-sm text-[#64748B]">
    {selectedPropertyType === "PG" ? "PG Type" : "Hostel Type"}
  </Text>

  {(selectedPropertyType === "PG"
    ? ["Boy's", "Girl's", "Co-living"]
    : hostelTypes
  ).map((type) => {
    const selected =
      selectedPropertyType === "PG"
        ? selectedPGTypes.includes(type)
        : selectedHostelTypes.includes(type);

    return (
      <Pressable
        key={type}
        onPress={() => {
          if (selectedPropertyType === "PG") {
            setSelectedPGTypes((current) =>
              current.includes(type)
                ? current.filter((item) => item !== type)
                : [...current, type]
            );
          } else {
            setSelectedHostelTypes((current) =>
              current.includes(type)
                ? current.filter((item) => item !== type)
                : [...current, type]
            );
          }
        }}
        className="mt-4 flex-row items-center"
      >
        <View
          className={`h-6 w-6 items-center justify-center rounded-md border ${
            selected
              ? "border-[#2563EB] bg-[#2563EB]"
              : "border-[#CBD5E1] bg-white"
          }`}
        >
          {selected && (
            <MaterialCommunityIcons
              name="check"
              size={17}
              color="#FFFFFF"
            />
          )}
        </View>

        <Text className="ml-3 text-base font-semibold text-[#0F172A]">
          {type}
        </Text>
      </Pressable>
    );
  })}
</View>

          {/* =================================================
              4. ROOM SHARING
              MULTIPLE SELECTION
              CHECKBOX
              DROPDOWN MODAL
          ================================================= */}

          <Pressable
            onPress={() =>
              setRoomSharingModalVisible(true)
            }
            className="mt-3 rounded-2xl border border-[#E2E8F0] bg-white p-4"
          >

            <Text className="text-sm text-[#64748B]">
              Room Sharing
            </Text>

            <View className="mt-2 flex-row items-center justify-between">

              <Text
                className={`flex-1 text-base font-semibold ${
                  selectedRoomSharing.length > 0
                    ? "text-[#0F172A]"
                    : "text-[#94A3B8]"
                }`}
              >
                {getRoomSharingSummary()}
              </Text>

              <MaterialCommunityIcons
                name="chevron-down"
                size={24}
                color="#64748B"
              />

            </View>

          </Pressable>

          {/* =================================================
              5. FOOD TYPE
              DISABLED / REMOVED FOR NOW
          ================================================= */}

          {/*
          Food Type will be implemented later.
          */}

          {/* =================================================
              6. FOOD HABIT
              DISABLED / REMOVED FOR NOW
          ================================================= */}

          {/*
          Food Habit will not be used for PG matching.
          */}

          
{/* =================================================
    7. AC / NON-AC
    MULTIPLE SELECTION
================================================= */}

<View className="mt-3 rounded-2xl border border-[#E2E8F0] bg-white p-4">
  <Text className="text-sm text-[#64748B]">
    AC / Non-AC
  </Text>

  {acOptions.map((option) => {
    const selected = selectedAcTypes.includes(option);

    return (
      <Pressable
        key={option}
        onPress={() => {
          setSelectedAcTypes((current) =>
            current.includes(option)
              ? current.filter((item) => item !== option)
              : [...current, option]
          );
        }}
        className="mt-4 flex-row items-center"
      >
        <Checkbox checked={selected} />

        <Text className="ml-3 text-base font-semibold text-[#0F172A]">
          {option}
        </Text>
      </Pressable>
    );
  })}
</View>


          {/* =================================================
              8. FIND PGs BUTTON
          ================================================= */}

          <Pressable
            onPress={handleFindPGs}
            disabled={!selectedCity}
            className={`mt-6 items-center rounded-2xl py-4 ${
              selectedCity
                ? "bg-[#2563EB]"
                : "bg-[#CBD5E1]"
            }`}
          >

            <Text className="text-base font-bold text-white">
             {selectedPropertyType === "PG" ? "Find PGs" : "Find Hostels"}
            </Text>

          </Pressable>

        </View>

      </ScrollView>

      {/* =====================================================
          CITY SELECTION MODAL
          SINGLE SELECT
          RADIO BUTTON
      ===================================================== */}

      <Modal
        visible={cityModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setCityModalVisible(false)
        }
      >

        <View className="flex-1 justify-end bg-black/40">

          <View className="max-h-[80%] rounded-t-3xl bg-white px-5 pb-8 pt-5">

            <View className="flex-row items-center justify-between">

              <Text className="text-xl font-bold text-[#0F172A]">
                Select City
              </Text>

              <Pressable
                onPress={() =>
                  setCityModalVisible(false)
                }
              >
                <MaterialCommunityIcons
                  name="close"
                  size={26}
                  color="#64748B"
                />
              </Pressable>

            </View>

            <ScrollView
              className="mt-4"
              showsVerticalScrollIndicator={false}
            >

              {cities.map((city) => {

                const selected =
                  selectedCity === city;

                return (
                  <Pressable
                    key={city}
                    onPress={() =>
                      selectCity(city)
                    }
                    className="flex-row items-center border-b border-[#F1F5F9] py-4"
                  >

                    <RadioButton
                      selected={selected}
                    />

                    <Text className="ml-4 text-base font-semibold text-[#0F172A]">
                      {city}
                    </Text>

                  </Pressable>
                );
              })}

            </ScrollView>

            <Pressable
              onPress={() =>
                setCityModalVisible(false)
              }
              className="mt-5 items-center rounded-2xl bg-[#2563EB] py-4"
            >

              <Text className="font-bold text-white">
                Done
              </Text>

            </Pressable>

          </View>

        </View>

      </Modal>

      {/* =====================================================
          AREA SELECTION MODAL
          MULTIPLE SELECT
          CHECKBOX
      ===================================================== */}

      <Modal
        visible={areaModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setAreaModalVisible(false)
        }
      >

        <View className="flex-1 justify-end bg-black/40">

          <View className="max-h-[85%] rounded-t-3xl bg-white px-5 pb-8 pt-5">

            <View className="flex-row items-center justify-between">

              <View>

                <Text className="text-xl font-bold text-[#0F172A]">
                  Select Areas
                </Text>

                <Text className="mt-1 text-sm text-[#64748B]">
                  {selectedCity}
                </Text>

              </View>

              <Pressable
                onPress={() =>
                  setAreaModalVisible(false)
                }
              >
                <MaterialCommunityIcons
                  name="close"
                  size={26}
                  color="#64748B"
                />
              </Pressable>

            </View>

            <ScrollView
              className="mt-4"
              showsVerticalScrollIndicator={false}
            >

              {availableAreas.map((area) => {

                const selected =
                  selectedAreas.includes(area);

                return (
                  <Pressable
                    key={area}
                    onPress={() =>
                      toggleArea(area)
                    }
                    className="flex-row items-center border-b border-[#F1F5F9] py-4"
                  >

                    <Checkbox
                      checked={selected}
                    />

                    <Text className="ml-4 text-base font-semibold text-[#0F172A]">
                      {area}
                    </Text>

                  </Pressable>
                );
              })}

            </ScrollView>

            <Pressable
              onPress={() =>
                setAreaModalVisible(false)
              }
              className="mt-5 items-center rounded-2xl bg-[#2563EB] py-4"
            >

              <Text className="font-bold text-white">
                Done
              </Text>

            </Pressable>

          </View>

        </View>

      </Modal>

      {/* =====================================================
          ROOM SHARING MODAL
          MULTIPLE SELECT
          CHECKBOX
      ===================================================== */}

      <Modal
        visible={roomSharingModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setRoomSharingModalVisible(false)
        }
      >

        <View className="flex-1 justify-end bg-black/40">

          <View className="max-h-[85%] rounded-t-3xl bg-white px-5 pb-8 pt-5">

            <View className="flex-row items-center justify-between">

              <Text className="text-xl font-bold text-[#0F172A]">
                Select Room Sharing
              </Text>

              <Pressable
                onPress={() =>
                  setRoomSharingModalVisible(false)
                }
              >
                <MaterialCommunityIcons
                  name="close"
                  size={26}
                  color="#64748B"
                />
              </Pressable>

            </View>

            <ScrollView
              className="mt-4"
              showsVerticalScrollIndicator={false}
            >

              {roomSharingOptions.map((sharing) => {

                const selected =
                  selectedRoomSharing.includes(
                    sharing
                  );

                return (
                  <Pressable
                    key={sharing}
                    onPress={() =>
                      toggleRoomSharing(sharing)
                    }
                    className="flex-row items-center border-b border-[#F1F5F9] py-4"
                  >

                    <Checkbox
                      checked={selected}
                    />

                    <Text className="ml-4 text-base font-semibold text-[#0F172A]">
                      {sharing}
                    </Text>

                  </Pressable>
                );
              })}

            </ScrollView>

            <Pressable
              onPress={() =>
                setRoomSharingModalVisible(false)
              }
              className="mt-5 items-center rounded-2xl bg-[#2563EB] py-4"
            >

              <Text className="font-bold text-white">
                Done
              </Text>

            </Pressable>

          </View>

        </View>

      </Modal>

    </SafeAreaView>
  );
}