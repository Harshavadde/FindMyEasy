import {
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  onSearch?: () => void;
};

export default function SearchBar({
  value,
  onChangeText,
  onSearch,
}: Props) {
  return (
    <View className="flex-row">
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSearch}
        placeholder="Search PG, hostel or area..."
        placeholderTextColor="#94A3B8"
        className="h-[52px] flex-1 rounded-[15px] bg-white px-4 text-[14px] text-[#0F172A]"
        style={{
          borderWidth: 1,
          borderColor: "#E2E8F0",
        }}
      />

      <Pressable
        onPress={onSearch}
        className="ml-2 h-[52px] w-[52px] items-center justify-center rounded-[15px] bg-[#2563EB]"
      >
        <Text className="text-[20px]">
          🔍
        </Text>
      </Pressable>
    </View>
  );
}