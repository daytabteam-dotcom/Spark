import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import {
  useListTasks,
  useListCharacters,
  getListTasksQueryKey,
  getListCharactersQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useSparkUser } from "@/hooks/useSparkUser";
import { Card } from "@/components/ui/Card";
import { CharacterAvatar } from "@/components/ui/CharacterAvatar";
import { Button } from "@/components/ui/Button";

function nextLevelInfo(xp: number, characters: { xpRequired: number; name: string }[]) {
  const sorted = [...characters].sort((a, b) => a.xpRequired - b.xpRequired);
  const next = sorted.find((c) => c.xpRequired > xp);
  if (!next) return { progress: 1, label: "Max companions unlocked!" };
  const prev = [...sorted].reverse().find((c) => c.xpRequired <= xp);
  const base = prev ? prev.xpRequired : 0;
  const progress = Math.max(0, Math.min(1, (xp - base) / (next.xpRequired - base)));
  return { progress, label: `${next.xpRequired - xp} XP to unlock ${next.name}` };
}

export default function Home() {
  const colors = useColors();
  const router = useRouter();
  const { userId, user } = useSparkUser();
  const tasks = useListTasks(
    { userId: userId ?? "" },
    {
      query: {
        enabled: !!userId,
        queryKey: getListTasksQueryKey({ userId: userId ?? "" }),
      },
    },
  );
  const characters = useListCharacters(
    { userId: userId ?? undefined },
    {
      query: {
        enabled: !!userId,
        queryKey: getListCharactersQueryKey({ userId: userId ?? undefined }),
      },
    },
  );

  const open = useMemo(
    () => (tasks.data ?? []).filter((t) => t.status !== "completed").slice(0, 5),
    [tasks.data],
  );
  const completedCount = useMemo(
    () => (tasks.data ?? []).filter((t) => t.status === "completed").length,
    [tasks.data],
  );

  const selected = (characters.data ?? []).find(
    (c) => c.id === user?.selectedCharacterId,
  );

  const xpInfo = user && characters.data
    ? nextLevelInfo(user.xp, characters.data)
    : { progress: 0, label: "" };

  if (!userId || !user) {
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

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      <Text style={[styles.greeting, { color: colors.foreground }]}>
        Hey {user.name.split(" ")[0]}.
      </Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>
        Here{"'"}s your spark for today.
      </Text>

      <Card style={{ marginTop: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {selected ? (
            <CharacterAvatar name={selected.name} color={selected.color} size={48} />
          ) : (
            <View style={{ width: 48, height: 48 }} />
          )}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>
              Active companion
            </Text>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              {selected?.name ?? "—"}
            </Text>
          </View>
          <Pressable onPress={() => router.push("/(tabs)/characters")}>
            <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium" }}>
              Switch
            </Text>
          </Pressable>
        </View>
        <View style={{ marginTop: 16 }}>
          <View
            style={{
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.muted,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${xpInfo.progress * 100}%`,
                height: "100%",
                backgroundColor: colors.primary,
              }}
            />
          </View>
          <Text style={[styles.xpLabel, { color: colors.mutedForeground }]}>
            {user.xp} XP · {xpInfo.label}
          </Text>
        </View>
      </Card>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={[styles.statNum, { color: colors.foreground }]}>{open.length}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Open</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statNum, { color: colors.success }]}>{completedCount}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Done</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statNum, { color: colors.primary }]}>{user.xp}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>XP</Text>
        </Card>
      </View>

      <Text style={[styles.section, { color: colors.foreground }]}>Up next</Text>
      {open.length === 0 ? (
        <Card>
          <Text style={{ color: colors.mutedForeground, textAlign: "center" }}>
            No tasks yet. Brain-dump in the Tasks tab.
          </Text>
        </Card>
      ) : (
        open.map((t) => (
          <Pressable key={t.id} onPress={() => router.push(`/focus/${t.id}`)}>
            <Card style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor:
                      t.resistanceLevel === "high"
                        ? colors.destructive
                        : t.resistanceLevel === "medium"
                          ? colors.warning
                          : colors.success,
                    marginRight: 12,
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium" }}>
                    {t.title}
                  </Text>
                  {t.durationMinutes ? (
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                      ~{t.durationMinutes} min
                    </Text>
                  ) : null}
                </View>
                <Feather name="chevron-right" color={colors.mutedForeground} />
              </View>
            </Card>
          </Pressable>
        ))
      )}

      <Button
        label="Brain-dump tasks"
        onPress={() => router.push("/(tabs)/tasks")}
        fullWidth
        style={{ marginTop: 16 }}
      />
    </ScrollView>
  );
}

import { Feather } from "@expo/vector-icons";

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60 },
  greeting: { fontSize: 28, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 15, fontFamily: "Inter_400Regular", marginTop: 4 },
  cardLabel: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase" },
  cardTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  xpLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 8 },
  statsRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  statCard: { flex: 1, alignItems: "center", padding: 12 },
  statNum: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  section: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 24, marginBottom: 8 },
});
