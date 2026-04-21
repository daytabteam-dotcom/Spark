import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useSparkUser } from "@/hooks/useSparkUser";
import { useColors } from "@/hooks/useColors";

export default function Index() {
  const { userId, loaded } = useSparkUser();
  const colors = useColors();

  if (!loaded) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <Redirect href={userId ? "/(tabs)" : "/onboarding"} />;
}
