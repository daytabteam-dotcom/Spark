import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface Props {
  name: string;
  color: string;
  size?: number;
  locked?: boolean;
}

export function CharacterAvatar({ name, color, size = 56, locked }: Props) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: locked ? "#9ca3af" : color,
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.4 }]}>
        {locked ? "?" : initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: "white",
    fontFamily: "Inter_700Bold",
  },
});
