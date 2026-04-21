import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";
import { useColors } from "@/hooks/useColors";

interface Props {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  style,
  fullWidth,
}: Props) {
  const colors = useColors();
  const bg =
    variant === "primary"
      ? colors.primary
      : variant === "destructive"
        ? colors.destructive
        : variant === "secondary"
          ? colors.secondary
          : "transparent";
  const fg =
    variant === "primary"
      ? colors.primaryForeground
      : variant === "destructive"
        ? colors.destructiveForeground
        : variant === "secondary"
          ? colors.secondaryForeground
          : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: bg,
          borderRadius: colors.radius,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          width: fullWidth ? "100%" : undefined,
          borderWidth: variant === "ghost" ? 1 : 0,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.label, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
});
