
import { useState, useEffect } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function OwnerProfileScreen() {
  const [editing, setEditing] = useState(false);
  const [ownerName, setOwnerName] = useState("Property Owner");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");


  
useEffect(() => {
  async function loadProfile() {
    try {
      const saved = await AsyncStorage.getItem(
        "findmyeasy_owner_profile"
      );

      if (saved) {
        const profile = JSON.parse(saved);

        setOwnerName(profile.name ?? "Property Owner");
        setPhone(profile.phone ?? "");
        setEmail(profile.email ?? "");
      }
    } catch {
      Alert.alert(
        "Profile",
        "Unable to load saved profile details."
      );
    }
  }

  loadProfile();
}, []);


  function handleSave() {
    // Connect this to your profile API in the next step.
    Alert.alert(
      "Profile",
      "Profile API is not connected yet."
    );
    setEditing(false);
  }

  function ProfileRow({
    icon,
    title,
    subtitle,
    onPress,
  }: {
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    title: string;
    subtitle: string;
    onPress: () => void;
  }) {
    return (
      <Pressable
        onPress={onPress}
        className="mb-3 flex-row items-center rounded-2xl border border-[#E2E8F0] bg-white p-4"
      >
        <View className="mr-3 h-11 w-11 items-center justify-center rounded-xl bg-[#E8F1FF]">
          <MaterialCommunityIcons
            name={icon}
            size={23}
            color="#2563EB"
          />
        </View>

        <View className="flex-1">
          <Text className="text-[15px] font-bold text-[#0F172A]">
            {title}
          </Text>
          <Text className="mt-1 text-[12px] text-[#64748B]">
            {subtitle}
          </Text>
        </View>

        <MaterialCommunityIcons
          name="chevron-right"
          size={23}
          color="#94A3B8"
        />
      </Pressable>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F4F7FC]">
      <ScrollView
        contentContainerStyle={{ padding: 22, paddingBottom: 35 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-[14px] font-medium text-[#64748B]">
          Property Management
        </Text>

        <Text className="mt-1 text-[30px] font-extrabold text-[#0F172A]">
          My Profile
        </Text>

        <Text className="mt-1 text-[14px] text-[#64748B]">
          Manage your owner account
        </Text>

        <View className="mt-7 items-center rounded-3xl bg-white p-6">
          <View className="h-24 w-24 items-center justify-center rounded-full bg-[#E8F1FF]">
            <MaterialCommunityIcons
              name="account"
              size={54}
              color="#2563EB"
            />
          </View>

          <Text className="mt-4 text-[23px] font-extrabold text-[#0F172A]">
            {ownerName}
          </Text>

          <Text className="mt-1 text-[13px] text-[#64748B]">
            Owner Account
          </Text>

          <Pressable
            onPress={() =>
            router.push({
                pathname: "/(owner)/edit-profile",
                params: {
                name: ownerName,
                phone,
                email,
                },
            })
            }
            className="mt-5 rounded-xl bg-[#2563EB] px-6 py-3"
          >
            <Text className="font-bold text-white">
              {editing ? "Cancel Editing" : "Edit Profile"}
            </Text>
          </Pressable>
        </View>

        <Text className="mb-3 mt-7 text-[19px] font-extrabold text-[#0F172A]">
          Personal Information
        </Text>

        <View className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
          <Text className="mb-2 text-[13px] font-semibold text-[#64748B]">
            Full Name
          </Text>

          <View className="mb-4 rounded-xl border border-[#E2E8F0] px-3 py-3">
            <Text
              className="text-[15px] text-[#0F172A]"
              onPress={() => {
                if (editing) {
                  Alert.alert(
                    "Full Name",
                    "Name editing will be connected in the next step."
                  );
                }
              }}
            >
              {ownerName}
            </Text>
          </View>

          <Text className="mb-2 text-[13px] font-semibold text-[#64748B]">
            Phone Number
          </Text>

          <View className="mb-4 rounded-xl border border-[#E2E8F0] px-3 py-3">
            <Text className="text-[15px] text-[#64748B]">
              {phone || "No phone number added"}
            </Text>
          </View>

          <Text className="mb-2 text-[13px] font-semibold text-[#64748B]">
            Email Address
          </Text>

          <View className="rounded-xl border border-[#E2E8F0] px-3 py-3">
            <Text className="text-[15px] text-[#64748B]">
              {email || "No email address added"}
            </Text>
          </View>

          {editing && (
            <Pressable
              onPress={handleSave}
              className="mt-5 items-center rounded-xl bg-[#2563EB] p-4"
            >
              <Text className="font-bold text-white">
                Save Changes
              </Text>
            </Pressable>
          )}
        </View>

        <Text className="mb-3 mt-7 text-[19px] font-extrabold text-[#0F172A]">
          Account Management
        </Text>

        <ProfileRow
          icon="home-city-outline"
          title="My Properties"
          subtitle="View and manage your PGs and hostels"
          onPress={() =>
            router.push("/(owner)/listings")
          }
        />

        <ProfileRow
          icon="account-group-outline"
          title="Manage Members"
          subtitle="Manage members of your properties"
          onPress={() =>
            Alert.alert(
              "Manage Members",
              "Open a property first to manage its members."
            )
          }
        />

        <ProfileRow
          icon="cog-outline"
          title="Settings"
          subtitle="App preferences and account settings"
          onPress={() =>
            Alert.alert(
              "Settings",
              "Settings will be implemented next."
            )
          }
        />

        <ProfileRow
          icon="logout"
          title="Logout"
          subtitle="Sign out of your owner account"
          onPress={() =>
            Alert.alert(
              "Logout",
              "Connect this action to your existing logout flow."
            )
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
