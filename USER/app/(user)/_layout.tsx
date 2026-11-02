import { Stack } from "expo-router";
import FavoritesToast from "../../components/FavoritesToast";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function UserLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <FavoritesToast />
    </>
  );
}