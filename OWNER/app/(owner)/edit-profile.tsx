
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function EditOwnerProfileScreen() {
  const params = useLocalSearchParams<{
    name?: string;
    phone?: string;
    email?: string;
  }>();

  const [name, setName] = useState(params.name ?? "");
  const [phone, setPhone] = useState(params.phone ?? "");
  const [email, setEmail] = useState(params.email ?? "");
  const [saving, setSaving] = useState(false);

  
async function handleSave() {
  const cleanName = name.trim();
  const cleanPhone = phone.trim();
  const cleanEmail = email.trim();

  if (!cleanName) {
    Alert.alert("Required", "Please enter your full name.");
    return;
  }

  if (!/^\d{10}$/.test(cleanPhone)) {
    Alert.alert(
      "Invalid phone number",
      "Enter a valid 10-digit phone number."
    );
    return;
  }

  if (
    cleanEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
  ) {
    Alert.alert("Invalid email", "Enter a valid email address.");
    return;
  }

  setSaving(true);

  try {
    const profile = {
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
    };

    await AsyncStorage.setItem(
      "findmyeasy_owner_profile",
      JSON.stringify(profile)
    );

    Alert.alert(
      "Success",
      "Your profile has been saved.",
      [
        {
          text: "OK",
          onPress: () => router.replace("/(owner)/profile"),
        },
      ]
    );
  } catch {
    Alert.alert(
      "Save failed",
      "Could not save your profile. Please try again."
    );
  } finally {
    setSaving(false);
  }
}


  const inputStyle =
    "mt-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-[15px] text-[#0F172A]";

  return (
    <SafeAreaView className="flex-1 bg-[#F4F7FC]">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 22, paddingBottom: 40 }}
        >
          <Pressable
            onPress={() => router.back()}
            className="mb-5 self-start rounded-full bg-white px-4 py-2"
          >
            <Text className="font-semibold text-[#2563EB]">
              ← Back to Profile
            </Text>
          </Pressable>

          <Text className="text-[14px] font-medium text-[#64748B]">
            Property Management
          </Text>

          <Text className="mt-1 text-[30px] font-extrabold text-[#0F172A]">
            Edit Profile
          </Text>

          <Text className="mt-2 text-[14px] text-[#64748B]">
            Update your personal information.
          </Text>

          <View className="mt-7 rounded-3xl border border-[#E2E8F0] bg-white p-5">
            <Text className="mb-1 font-semibold text-[#475569]">
              Full Name *
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter your full name"
              autoCapitalize="words"
              className={inputStyle}
            />

            <Text className="mb-1 mt-5 font-semibold text-[#475569]">
              Phone Number *
            </Text>
            <TextInput
              value={phone}
              onChangeText={(value) =>
                setPhone(value.replace(/\D/g, "").slice(0, 10))
              }
              placeholder="Enter 10-digit phone number"
              keyboardType="phone-pad"
              maxLength={10}
              className={inputStyle}
            />

            <Text className="mb-1 mt-5 font-semibold text-[#475569]">
              Email Address
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email address"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              className={inputStyle}
            />
          </View>

          <Pressable
            disabled={saving}
            onPress={handleSave}
            className={`mt-6 items-center rounded-2xl p-4 ${
              saving ? "bg-blue-300" : "bg-[#2563EB]"
            }`}
          >
            <Text className="text-[16px] font-bold text-white">
              {saving ? "Saving..." : "Save Changes"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
