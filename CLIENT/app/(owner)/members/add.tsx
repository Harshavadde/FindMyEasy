import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";

import { API_BASE_URL } from "../../../constants/api";
import { addMember } from "../../../services/memberApi";

import type {
  ListingSharing,
  FoodPreference,
} from "../../../types/member";


export default function AddMemberScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    listingId: string;
    ownerPhone?: string;
  }>();

  const listingId = params.listingId;
  const ownerPhone = params.ownerPhone ?? "";

  const [sharingOptions, setSharingOptions] = useState<
    ListingSharing[]
  >([]);

  const [loadingSharing, setLoadingSharing] =
    useState(true);

  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [sharingId, setSharingId] = useState("");

  const [roomNumber, setRoomNumber] =
    useState("");

  const [amountToPay, setAmountToPay] =
    useState("");

  const [amountPaid, setAmountPaid] =
    useState("");

  const [foodPreference, setFoodPreference] =
    useState<FoodPreference>("veg");

  const [joiningDate, setJoiningDate] =
    useState("");

  const [leavingDate, setLeavingDate] =
    useState("");

  const [aadhaarPhotoUri, setAadhaarPhotoUri] =
    useState<string | undefined>();


  useEffect(() => {
    loadSharingOptions();
  }, []);


  async function loadSharingOptions() {
    if (!listingId) {
      setLoadingSharing(false);
      return;
    }

    try {
      setLoadingSharing(true);

      const response = await fetch(
        `${API_BASE_URL}/api/v1/owner/listings/${listingId}`,
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "Failed to load sharing options.",
        );
      }

      const options: ListingSharing[] =
        data.sharing ?? [];

      setSharingOptions(options);

      if (options.length > 0) {
        setSharingId(options[0].id);

        const firstOption = options[0];

        setAmountToPay(
          String(firstOption.monthly_price),
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load sharing options.";

      Alert.alert(
        "Unable to Load",
        message,
      );
    } finally {
      setLoadingSharing(false);
    }
  }


  function selectSharing(
    option: ListingSharing,
  ) {
    setSharingId(option.id);

    if (!amountToPay) {
      setAmountToPay(
        String(option.monthly_price),
      );
    }
  }


  async function pickAadhaarPhoto() {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow photo library access to upload the Aadhaar photo.",
      );
      return;
    }

    const result =
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

    if (
      !result.canceled &&
      result.assets.length > 0
    ) {
      setAadhaarPhotoUri(
        result.assets[0].uri,
      );
    }
  }


  function validateForm(): string | null {
    if (!listingId) {
      return "Listing information is missing.";
    }

    if (!ownerPhone) {
      return "Owner information is missing.";
    }

    if (!name.trim()) {
      return "Please enter the member name.";
    }

    if (!phone.trim()) {
      return "Please enter the member phone number.";
    }

    const cleanPhone = phone.replace(
      /\D/g,
      "",
    );

    if (cleanPhone.length < 10) {
      return "Please enter a valid 10-digit phone number.";
    }

    if (!sharingId) {
      return "Please select a sharing option.";
    }

    if (!roomNumber.trim()) {
      return "Please enter the room number.";
    }

    if (!amountToPay.trim()) {
      return "Please enter the amount to pay.";
    }

    const payable =
      Number(amountToPay);

    if (
      !Number.isFinite(payable) ||
      payable < 0
    ) {
      return "Please enter a valid amount to pay.";
    }

    const paid =
      Number(amountPaid || "0");

    if (
      !Number.isFinite(paid) ||
      paid < 0
    ) {
      return "Please enter a valid paid amount.";
    }

    if (paid > payable) {
      return "Amount paid cannot be greater than amount to pay.";
    }

    if (!joiningDate.trim()) {
      return "Please enter the joining date.";
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(
      joiningDate.trim(),
    )) {
      return "Joining date must be YYYY-MM-DD.";
    }

    if (leavingDate.trim()) {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
          leavingDate.trim(),
        )
      ) {
        return "Leaving date must be YYYY-MM-DD.";
      }

      if (
        new Date(leavingDate) <
        new Date(joiningDate)
      ) {
        return "Leaving date cannot be before joining date.";
      }
    }

    return null;
  }


  async function handleSave() {
    const validationError =
      validateForm();

    if (validationError) {
      Alert.alert(
        "Check Details",
        validationError,
      );
      return;
    }

    try {
      setSaving(true);

      await addMember(
        listingId,
        {
          ownerPhone,

          name: name.trim(),

          phone: phone.trim(),

          sharingId: sharingId,

          roomNumber: roomNumber.trim(),

          amountToPay:
            Number(amountToPay),

          amountPaid:
            Number(amountPaid || "0"),

          foodPreference,

          joiningDate:
            joiningDate.trim(),

          leavingDate:
            leavingDate.trim() || undefined,

          aadhaarPhotoUri,
        },
      );

      Alert.alert(
        "Member Added",
        `${name.trim()} has been added successfully.`,
        [
          {
            text: "OK",
            onPress: () => {
              router.replace({
                pathname:
                  "/(owner)/members/[listingId]",
                params: {
                  listingId,
                  ownerPhone,
                },
              });
            },
          },
        ],
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to add member.";

      Alert.alert(
        "Unable to Add Member",
        message,
      );
    } finally {
      setSaving(false);
    }
  }


  return (
    <View className="flex-1 bg-[#F8FAFC]">

      {/* Header */}
      <View className="border-b border-[#E2E8F0] bg-white px-5 pb-4 pt-14">

        <Text className="text-[13px] font-medium text-[#64748B]">
          Property Management
        </Text>

        <Text className="mt-1 text-[25px] font-bold text-[#0F172A]">
          Add Member
        </Text>

      </View>


      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 50,
        }}
      >

        {/* Personal Information */}
        <Text className="mb-3 text-[17px] font-bold text-[#0F172A]">
          Personal Information
        </Text>


        <View className="rounded-2xl border border-[#E2E8F0] bg-white p-4">

          <Text className="text-[12px] font-semibold text-[#475569]">
            Full Name
          </Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Enter member name"
            placeholderTextColor="#94A3B8"
            className="mt-2 rounded-xl border border-[#E2E8F0] px-4 py-3 text-[14px] text-[#0F172A]"
          />


          <Text className="mt-4 text-[12px] font-semibold text-[#475569]">
            Phone Number
          </Text>

          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="Enter 10-digit phone number"
            placeholderTextColor="#94A3B8"
            keyboardType="phone-pad"
            maxLength={15}
            className="mt-2 rounded-xl border border-[#E2E8F0] px-4 py-3 text-[14px] text-[#0F172A]"
          />

        </View>


        {/* Sharing */}
        <Text className="mb-3 mt-6 text-[17px] font-bold text-[#0F172A]">
          Sharing & Room
        </Text>


        <View className="rounded-2xl border border-[#E2E8F0] bg-white p-4">

          <Text className="text-[12px] font-semibold text-[#475569]">
            Select Sharing
          </Text>


          {loadingSharing ? (
            <View className="items-center py-6">
              <ActivityIndicator
                size="small"
                color="#2563EB"
              />

              <Text className="mt-2 text-[12px] text-[#64748B]">
                Loading sharing options...
              </Text>
            </View>
          ) : sharingOptions.length === 0 ? (
            <Text className="mt-3 text-[13px] text-[#DC2626]">
              No sharing options available.
            </Text>
          ) : (
            <View className="mt-3 flex-row flex-wrap">

              {sharingOptions.map(
                (option) => {
                  const selected =
                    sharingId === option.id;

                  const disabled =
                    option.available_beds <= 0;

                  return (
                    <Pressable
                      key={option.id}
                      disabled={disabled}
                      onPress={() =>
                        selectSharing(
                          option,
                        )
                      }
                      className={`mb-3 mr-2 rounded-xl border px-4 py-3 ${
                        selected
                          ? "border-[#2563EB] bg-[#EFF6FF]"
                          : disabled
                          ? "border-[#E2E8F0] bg-[#F8FAFC]"
                          : "border-[#E2E8F0] bg-white"
                      }`}
                    >

                      <Text
                        className={`text-[13px] font-bold ${
                          selected
                            ? "text-[#2563EB]"
                            : disabled
                            ? "text-[#94A3B8]"
                            : "text-[#334155]"
                        }`}
                      >
                        {option.sharing_type} Sharing
                      </Text>


                      <Text
                        className={`mt-1 text-[11px] ${
                          disabled
                            ? "text-[#94A3B8]"
                            : "text-[#64748B]"
                        }`}
                      >
                        ₹
                        {option.monthly_price.toLocaleString(
                          "en-IN",
                        )}
                      </Text>


                      <Text
                        className={`mt-1 text-[10px] ${
                          disabled
                            ? "text-[#DC2626]"
                            : "text-[#64748B]"
                        }`}
                      >
                        {disabled
                          ? "No beds available"
                          : `${option.available_beds} beds available`}
                      </Text>

                    </Pressable>
                  );
                },
              )}

            </View>
          )}


          <Text className="mt-2 text-[12px] font-semibold text-[#475569]">
            Room Number
          </Text>

          <TextInput
            value={roomNumber}
            onChangeText={setRoomNumber}
            placeholder="Example: 201"
            placeholderTextColor="#94A3B8"
            className="mt-2 rounded-xl border border-[#E2E8F0] px-4 py-3 text-[14px] text-[#0F172A]"
          />

        </View>


        {/* Payment */}
        <Text className="mb-3 mt-6 text-[17px] font-bold text-[#0F172A]">
          Payment
        </Text>


        <View className="rounded-2xl border border-[#E2E8F0] bg-white p-4">

          <Text className="text-[12px] font-semibold text-[#475569]">
            Amount To Pay
          </Text>

          <TextInput
            value={amountToPay}
            onChangeText={setAmountToPay}
            placeholder="Example: 6000"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            className="mt-2 rounded-xl border border-[#E2E8F0] px-4 py-3 text-[14px] text-[#0F172A]"
          />


          <Text className="mt-4 text-[12px] font-semibold text-[#475569]">
            Amount Paid
          </Text>

          <TextInput
            value={amountPaid}
            onChangeText={setAmountPaid}
            placeholder="Example: 4000"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            className="mt-2 rounded-xl border border-[#E2E8F0] px-4 py-3 text-[14px] text-[#0F172A]"
          />

          {amountToPay &&
            amountPaid &&
            Number(amountPaid) <=
              Number(amountToPay) && (
              <View className="mt-3 rounded-xl bg-[#F0FDF4] px-4 py-3">

                <Text className="text-[12px] text-[#166534]">
                  Pending Amount
                </Text>

                <Text className="mt-1 text-[18px] font-bold text-[#15803D]">
                  ₹
                  {(
                    Number(amountToPay) -
                    Number(amountPaid)
                  ).toLocaleString(
                    "en-IN",
                  )}
                </Text>

              </View>
            )}

        </View>


        {/* Food */}
        <Text className="mb-3 mt-6 text-[17px] font-bold text-[#0F172A]">
          Food Preference
        </Text>


        <View className="flex-row">

          <Pressable
            onPress={() =>
              setFoodPreference("veg")
            }
            className={`mr-3 flex-1 rounded-xl border px-4 py-4 ${
              foodPreference === "veg"
                ? "border-[#16A34A] bg-[#F0FDF4]"
                : "border-[#E2E8F0] bg-white"
            }`}
          >
            <Text
              className={`text-center text-[14px] font-bold ${
                foodPreference === "veg"
                  ? "text-[#15803D]"
                  : "text-[#475569]"
              }`}
            >
              Veg
            </Text>
          </Pressable>


          <Pressable
            onPress={() =>
              setFoodPreference("non_veg")
            }
            className={`flex-1 rounded-xl border px-4 py-4 ${
              foodPreference === "non_veg"
                ? "border-[#EA580C] bg-[#FFF7ED]"
                : "border-[#E2E8F0] bg-white"
            }`}
          >
            <Text
              className={`text-center text-[14px] font-bold ${
                foodPreference ===
                "non_veg"
                  ? "text-[#C2410C]"
                  : "text-[#475569]"
              }`}
            >
              Non-Veg
            </Text>
          </Pressable>

        </View>


        {/* Dates */}
        <Text className="mb-3 mt-6 text-[17px] font-bold text-[#0F172A]">
          Stay Dates
        </Text>


        <View className="rounded-2xl border border-[#E2E8F0] bg-white p-4">

          <Text className="text-[12px] font-semibold text-[#475569]">
            Joining Date
          </Text>

          <TextInput
            value={joiningDate}
            onChangeText={setJoiningDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#94A3B8"
            className="mt-2 rounded-xl border border-[#E2E8F0] px-4 py-3 text-[14px] text-[#0F172A]"
          />


          <Text className="mt-4 text-[12px] font-semibold text-[#475569]">
            Leaving Date
          </Text>

          <TextInput
            value={leavingDate}
            onChangeText={setLeavingDate}
            placeholder="YYYY-MM-DD (optional)"
            placeholderTextColor="#94A3B8"
            className="mt-2 rounded-xl border border-[#E2E8F0] px-4 py-3 text-[14px] text-[#0F172A]"
          />

        </View>


        {/* Aadhaar */}
        <Text className="mb-3 mt-6 text-[17px] font-bold text-[#0F172A]">
          Aadhaar Photo
        </Text>


        <View className="rounded-2xl border border-[#E2E8F0] bg-white p-4">

          {aadhaarPhotoUri ? (
            <View>

              <Image
                source={{
                  uri: aadhaarPhotoUri,
                }}
                className="h-48 w-full rounded-xl"
                resizeMode="cover"
              />

              <Pressable
                onPress={pickAadhaarPhoto}
                className="mt-3 rounded-xl border border-[#2563EB] px-4 py-3"
              >
                <Text className="text-center text-[13px] font-bold text-[#2563EB]">
                  Change Photo
                </Text>
              </Pressable>

            </View>
          ) : (
            <Pressable
              onPress={pickAadhaarPhoto}
              className="items-center rounded-xl border border-dashed border-[#94A3B8] px-4 py-7"
            >
              <Text className="text-[15px] font-bold text-[#334155]">
                Upload Aadhaar Photo
              </Text>

              <Text className="mt-2 text-center text-[12px] text-[#64748B]">
                JPG, PNG or WEBP
              </Text>

              <Text className="mt-1 text-center text-[11px] text-[#94A3B8]">
                Maximum 5 MB
              </Text>
            </Pressable>
          )}

        </View>


        {/* Save */}
        <Pressable
          disabled={saving}
          onPress={handleSave}
          className={`mt-7 rounded-2xl py-4 ${
            saving
              ? "bg-[#93C5FD]"
              : "bg-[#2563EB]"
          }`}
        >
          {saving ? (
            <View className="flex-row items-center justify-center">

              <ActivityIndicator
                size="small"
                color="#FFFFFF"
              />

              <Text className="ml-2 text-[15px] font-bold text-white">
                Adding Member...
              </Text>

            </View>
          ) : (
            <Text className="text-center text-[15px] font-bold text-white">
              Add Member
            </Text>
          )}
        </Pressable>

      </ScrollView>

    </View>
  );
}