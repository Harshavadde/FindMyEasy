import { Stack } from "expo-router";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function UserLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}