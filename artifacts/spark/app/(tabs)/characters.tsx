import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCharacters,
  useUpdateUser,
  getGetUserQueryKey,
  getListCharactersQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useSparkUser } from "@/hooks/useSparkUser";
import { Card } from "@/components/ui/Card";
import { CharacterAvatar } from "@/components/ui/CharacterAvatar";
import { setStoredCharacterId } from "@/lib/userStore";

export default function CharactersScreen() {
  const colors = useColors();
  const qc = useQueryClient();
  const { userId, user } = useSparkUser();
  const characters = useListCharacters(
    { userId: userId ?? undefined },
    {
      query: {
        enabled: !!userId,
        queryKey: getListCharactersQueryKey({ userId: userId ?? undefined }),
      },
    },
  );
  const updateUser = useUpdateUser();

  const onSelect = async (id: string, locked: boolean) => {
    if (!userId || locked) return;
    try {
      await updateUser.mutateAsync({
        userId,
        data: { selectedCharacterId: id },
      });
      await setStoredCharacterId(id);
      qc.invalidateQueries({ queryKey: getGetUserQueryKey(userId) });
    } catch (e) {
      Alert.alert("Could not switch", String(e));
    }
  };

  if (characters.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Companions</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>
        Each one has a different personality. Earn XP to unlock more.
      </Text>

      {(characters.data ?? []).map((c) => {
        const active = c.id === user?.selectedCharacterId;
        return (
          <Pressable key={c.id} onPress={() => onSelect(c.id, c.isLocked)}>
            <Card
              style={{
                marginTop: 10,
                opacity: c.isLocked ? 0.6 : 1,
                borderColor: active ? colors.primary : colors.border,
                borderWidth: active ? 2 : 1,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <CharacterAvatar name={c.name} color={c.color} locked={c.isLocked} />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 16 }}>
                    {c.name}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 2 }}>
                    {c.isLocked ? `Unlocks at ${c.xpRequired} XP` : c.tagline}
                  </Text>
                  <Text
                    style={{
                      color: c.color,
                      fontSize: 11,
                      fontFamily: "Inter_500Medium",
                      marginTop: 4,
                      textTransform: "uppercase",
                    }}
                  >
                    {c.mode}
                  </Text>
                </View>
                {active && (
                  <Text
                    style={{
                      color: colors.primary,
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 12,
                    }}
                  >
                    ACTIVE
                  </Text>
                )}
              </View>
            </Card>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 4 },
});
