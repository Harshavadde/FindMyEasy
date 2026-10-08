import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import {
  deleteMember,
  getMemberStats,
  getMembers,
} from "../../../services/memberApi";

import type {
  HostelMember,
  MemberStats,
} from "../../../types/member";


export default function MembersScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    listingId: string;
    ownerPhone?: string;
  }>();

  const listingId = params.listingId;
  const ownerPhone = params.ownerPhone ?? "";

  const [members, setMembers] = useState<HostelMember[]>([]);
  const [stats, setStats] = useState<MemberStats | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);


  const loadData = useCallback(
    async (showLoader = true) => {
      if (!listingId || !ownerPhone) {
        setError("Listing information is missing.");
        setLoading(false);
        return;
      }

      try {
        if (showLoader) {
          setLoading(true);
        }

        setError(null);

        const [membersData, statsData] =
          await Promise.all([
            getMembers(
              listingId,
              ownerPhone,
            ),
            getMemberStats(
              listingId,
              ownerPhone,
            ),
          ]);

        setMembers(membersData);
        setStats(statsData);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to load members.";

        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [listingId, ownerPhone],
  );


  useEffect(() => {
    loadData();
  }, [loadData]);


  const handleRefresh = () => {
    setRefreshing(true);
    loadData(false);
  };


  const handleDelete = (member: HostelMember) => {
    Alert.alert(
      "Delete Member",
      `Are you sure you want to delete ${member.name}?`,
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
              setDeletingId(member.id);

              await deleteMember(
                listingId,
                member.id,
                ownerPhone,
              );

              await loadData(false);
            } catch (err) {
              const message =
                err instanceof Error
                  ? err.message
                  : "Failed to delete member.";

              Alert.alert(
                "Delete Failed",
                message,
              );
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };


  const formatCurrency = (value: number) => {
    return `₹${value.toLocaleString("en-IN")}`;
  };


  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F8FAFC]">
        <ActivityIndicator
          size="large"
          color="#2563EB"
        />

        <Text className="mt-3 text-[14px] text-[#64748B]">
          Loading members...
        </Text>
      </View>
    );
  }


  if (error && !stats) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F8FAFC] px-6">
        <Text className="text-center text-[16px] font-bold text-[#0F172A]">
          Unable to load members
        </Text>

        <Text className="mt-2 text-center text-[14px] text-[#64748B]">
          {error}
        </Text>

        <Pressable
          onPress={() => loadData()}
          className="mt-5 rounded-xl bg-[#2563EB] px-6 py-3"
        >
          <Text className="font-bold text-white">
            Try Again
          </Text>
        </Pressable>
      </View>
    );
  }


  return (
    <View className="flex-1 bg-[#F8FAFC]">

      {/* Header */}
      <View className="border-b border-[#E2E8F0] bg-white px-5 pb-4 pt-14">

        <View className="flex-row items-center justify-between">

          <View className="flex-1 pr-3">

            <Text className="text-[13px] font-medium text-[#64748B]">
              Property Members
            </Text>

            <Text className="mt-1 text-[25px] font-bold text-[#0F172A]">
              Members
            </Text>

          </View>

          <Pressable
            onPress={() =>
              router.push({
                pathname:
                  "/(owner)/members/add",
                params: {
                  listingId,
                  ownerPhone,
                },
              })
            }
            className="rounded-xl bg-[#2563EB] px-4 py-3"
          >
            <Text className="text-[13px] font-bold text-white">
              + Add Member
            </Text>
          </Pressable>

        </View>

      </View>


      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: 40,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
      >

        {/* Error banner */}
        {error && (
          <View className="mx-5 mt-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4">
            <Text className="text-[13px] text-[#B91C1C]">
              {error}
            </Text>
          </View>
        )}


        {/* Statistics */}
        {stats && (
          <View className="px-5 pt-5">

            <Text className="mb-3 text-[17px] font-bold text-[#0F172A]">
              Overview
            </Text>


            <View className="flex-row flex-wrap justify-between">

              {/* Total Members */}
              <View className="mb-3 w-[48%] rounded-2xl border border-[#E2E8F0] bg-white p-4">
                <Text className="text-[12px] text-[#64748B]">
                  Total Members
                </Text>

                <Text className="mt-2 text-[25px] font-bold text-[#0F172A]">
                  {stats.total_members}
                </Text>
              </View>


              {/* Occupied */}
              <View className="mb-3 w-[48%] rounded-2xl border border-[#E2E8F0] bg-white p-4">
                <Text className="text-[12px] text-[#64748B]">
                  Occupied Beds
                </Text>

                <Text className="mt-2 text-[25px] font-bold text-[#2563EB]">
                  {stats.occupied_beds}
                </Text>
              </View>


              {/* Available */}
              <View className="mb-3 w-[48%] rounded-2xl border border-[#E2E8F0] bg-white p-4">
                <Text className="text-[12px] text-[#64748B]">
                  Available Beds
                </Text>

                <Text className="mt-2 text-[25px] font-bold text-[#16A34A]">
                  {stats.available_beds}
                </Text>
              </View>


              {/* Total Beds */}
              <View className="mb-3 w-[48%] rounded-2xl border border-[#E2E8F0] bg-white p-4">
                <Text className="text-[12px] text-[#64748B]">
                  Total Beds
                </Text>

                <Text className="mt-2 text-[25px] font-bold text-[#0F172A]">
                  {stats.total_beds}
                </Text>
              </View>

            </View>


            {/* Payment summary */}
            <View className="mt-1 rounded-2xl border border-[#E2E8F0] bg-white p-4">

              <Text className="text-[15px] font-bold text-[#0F172A]">
                Payment Summary
              </Text>

              <View className="mt-4 flex-row justify-between">

                <View>
                  <Text className="text-[12px] text-[#64748B]">
                    Expected
                  </Text>

                  <Text className="mt-1 text-[17px] font-bold text-[#0F172A]">
                    {formatCurrency(
                      stats.total_amount,
                    )}
                  </Text>
                </View>


                <View>
                  <Text className="text-[12px] text-[#64748B]">
                    Paid
                  </Text>

                  <Text className="mt-1 text-[17px] font-bold text-[#16A34A]">
                    {formatCurrency(
                      stats.paid_amount,
                    )}
                  </Text>
                </View>


                <View>
                  <Text className="text-[12px] text-[#64748B]">
                    Pending
                  </Text>

                  <Text className="mt-1 text-[17px] font-bold text-[#DC2626]">
                    {formatCurrency(
                      stats.pending_amount,
                    )}
                  </Text>
                </View>

              </View>

            </View>


            {/* Food summary */}
            <View className="mt-3 flex-row justify-between">

              <View className="w-[48%] rounded-2xl border border-[#E2E8F0] bg-white p-4">
                <Text className="text-[12px] text-[#64748B]">
                  Veg Members
                </Text>

                <Text className="mt-2 text-[22px] font-bold text-[#16A34A]">
                  {stats.veg_members}
                </Text>
              </View>


              <View className="w-[48%] rounded-2xl border border-[#E2E8F0] bg-white p-4">
                <Text className="text-[12px] text-[#64748B]">
                  Non-Veg Members
                </Text>

                <Text className="mt-2 text-[22px] font-bold text-[#EA580C]">
                  {stats.non_veg_members}
                </Text>
              </View>

            </View>

          </View>
        )}


        {/* Member list */}
        <View className="mt-7 px-5">

          <View className="mb-3 flex-row items-center justify-between">

            <Text className="text-[17px] font-bold text-[#0F172A]">
              Members
            </Text>

            <Text className="text-[12px] text-[#64748B]">
              {members.length} member
              {members.length === 1 ? "" : "s"}
            </Text>

          </View>


          {members.length === 0 ? (
            <View className="items-center rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-6 py-10">

              <Text className="text-[17px] font-bold text-[#0F172A]">
                No members yet
              </Text>

              <Text className="mt-2 text-center text-[13px] leading-5 text-[#64748B]">
                Add your first hostel member to start
                managing occupancy and payments.
              </Text>

              <Pressable
                onPress={() =>
                  router.push({
                    pathname:
                      "/(owner)/members/add",
                    params: {
                      listingId,
                      ownerPhone,
                    },
                  })
                }
                className="mt-5 rounded-xl bg-[#2563EB] px-5 py-3"
              >
                <Text className="font-bold text-white">
                  Add First Member
                </Text>
              </Pressable>

            </View>
          ) : (
            members.map((member) => (

              <View
                key={member.id}
                className="mb-3 rounded-2xl border border-[#E2E8F0] bg-white p-4"
              >

                {/* Member header */}
                <View className="flex-row items-start justify-between">

                  <View className="flex-1 pr-3">

                    <Text className="text-[17px] font-bold text-[#0F172A]">
                      {member.name}
                    </Text>

                    <Text className="mt-1 text-[13px] text-[#64748B]">
                      {member.phone}
                    </Text>

                  </View>


                  <View
                    className={`rounded-full px-3 py-1 ${
                      member.status === "active"
                        ? "bg-[#DCFCE7]"
                        : "bg-[#F1F5F9]"
                    }`}
                  >
                    <Text
                      className={`text-[11px] font-bold ${
                        member.status === "active"
                          ? "text-[#15803D]"
                          : "text-[#64748B]"
                      }`}
                    >
                      {member.status === "active"
                        ? "ACTIVE"
                        : "LEFT"}
                    </Text>
                  </View>

                </View>


                {/* Member details */}
                <View className="mt-4 flex-row flex-wrap">

                  <View className="mb-3 w-1/2">
                    <Text className="text-[11px] text-[#94A3B8]">
                      Sharing
                    </Text>

                    <Text className="mt-1 text-[13px] font-semibold text-[#334155]">
                      {member.sharing_type} Sharing
                    </Text>
                  </View>


                  <View className="mb-3 w-1/2">
                    <Text className="text-[11px] text-[#94A3B8]">
                      Room
                    </Text>

                    <Text className="mt-1 text-[13px] font-semibold text-[#334155]">
                      {member.room_number}
                    </Text>
                  </View>


                  <View className="mb-3 w-1/2">
                    <Text className="text-[11px] text-[#94A3B8]">
                      Food
                    </Text>

                    <Text className="mt-1 text-[13px] font-semibold capitalize text-[#334155]">
                      {member.food_preference ===
                      "non_veg"
                        ? "Non-Veg"
                        : "Veg"}
                    </Text>
                  </View>


                  <View className="mb-3 w-1/2">
                    <Text className="text-[11px] text-[#94A3B8]">
                      Joining Date
                    </Text>

                    <Text className="mt-1 text-[13px] font-semibold text-[#334155]">
                      {member.joining_date}
                    </Text>
                  </View>

                </View>


                {/* Payment */}
                <View className="border-t border-[#F1F5F9] pt-3">

                  <View className="flex-row justify-between">

                    <View>
                      <Text className="text-[11px] text-[#94A3B8]">
                        To Pay
                      </Text>

                      <Text className="mt-1 text-[14px] font-bold text-[#0F172A]">
                        {formatCurrency(
                          member.amount_to_pay,
                        )}
                      </Text>
                    </View>


                    <View>
                      <Text className="text-[11px] text-[#94A3B8]">
                        Paid
                      </Text>

                      <Text className="mt-1 text-[14px] font-bold text-[#16A34A]">
                        {formatCurrency(
                          member.amount_paid,
                        )}
                      </Text>
                    </View>


                    <View>
                      <Text className="text-[11px] text-[#94A3B8]">
                        Pending
                      </Text>

                      <Text className="mt-1 text-[14px] font-bold text-[#DC2626]">
                        {formatCurrency(
                          member.amount_pending,
                        )}
                      </Text>
                    </View>

                  </View>

                </View>


                {/* Aadhaar + Delete */}
                <View className="mt-4 flex-row items-center justify-between">

                  <View
                    className={`rounded-lg px-3 py-2 ${
                      member.aadhaar_photo_available
                        ? "bg-[#EFF6FF]"
                        : "bg-[#F8FAFC]"
                    }`}
                  >
                    <Text
                      className={`text-[11px] font-semibold ${
                        member.aadhaar_photo_available
                          ? "text-[#2563EB]"
                          : "text-[#64748B]"
                      }`}
                    >
                      {member.aadhaar_photo_available
                        ? "Aadhaar Uploaded"
                        : "No Aadhaar Photo"}
                    </Text>
                  </View>


                  <Pressable
                    disabled={
                      deletingId === member.id
                    }
                    onPress={() =>
                      handleDelete(member)
                    }
                    className="rounded-lg bg-[#FEF2F2] px-3 py-2"
                  >
                    {deletingId === member.id ? (
                      <ActivityIndicator
                        size="small"
                        color="#DC2626"
                      />
                    ) : (
                      <Text className="text-[11px] font-bold text-[#DC2626]">
                        Delete
                      </Text>
                    )}
                  </Pressable>

                </View>

              </View>

            ))
          )}

        </View>

      </ScrollView>

    </View>
  );
}