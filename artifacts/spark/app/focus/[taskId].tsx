import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListTasks,
  useUpdateTask,
  useAwardXp,
  useCreateSession,
  useUpdateSession,
  useSendChatMessage,
  getListTasksQueryKey,
  getGetUserQueryKey,
} from "@workspace/api-client-react";
import type { Task } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useSparkUser } from "@/hooks/useSparkUser";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function FocusScreen() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
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
  const task: Task | undefined = (tasks.data ?? []).find((t) => t.id === taskId);

  const initial = (task?.durationMinutes ?? 25) * 60;
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pep, setPep] = useState<string | null>(null);

  const createSession = useCreateSession();
  const updateSession = useUpdateSession();
  const updateTask = useUpdateTask();
  const awardXp = useAwardXp();
  const chat = useSendChatMessage();

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const start = async () => {
    if (!userId || !task) return;
    setRunning(true);
    try {
      const s = await createSession.mutateAsync({
        data: {
          userId,
          characterId: user?.selectedCharacterId ?? "entropy-fox",
          activeTaskId: task.id,
        },
      });
      setSessionId(s.id);
      await updateTask.mutateAsync({
        taskId: task.id,
        data: { status: "in_progress", startTime: new Date().toISOString() },
      });
      const r = await chat.mutateAsync({
        data: {
          userId,
          characterId: user?.selectedCharacterId ?? "entropy-fox",
          message: `I'm starting now: "${task.title}". Pump me up in one sentence.`,
          sessionId: s.id,
          activeTaskId: task.id,
        },
      });
      setPep(r.message);
    } catch (e) {
      console.error(e);
    }
  };

  const finish = async (completed: boolean) => {
    if (!task || !userId) return;
    setRunning(false);
    try {
      if (sessionId) {
        await updateSession.mutateAsync({
          sessionId,
          data: { endTime: new Date().toISOString() },
        });
      }
      await updateTask.mutateAsync({
        taskId: task.id,
        data: completed
          ? {
              status: "completed",
              endTime: new Date().toISOString(),
            }
          : { status: "paused" },
      });
      if (completed) {
        const xp =
          task.resistanceLevel === "high"
            ? 40
            : task.resistanceLevel === "medium"
              ? 20
              : 10;
        await awardXp.mutateAsync({
          data: { userId, eventType: "focus_completed", xpAwarded: xp },
        });
        Alert.alert("Nice work", `+${xp} XP earned.`);
      }
      qc.invalidateQueries({ queryKey: getListTasksQueryKey({ userId }) });
      qc.invalidateQueries({ queryKey: getGetUserQueryKey(userId) });
      router.back();
    } catch (e) {
      Alert.alert("Could not finish", String(e));
    }
  };

  if (!task) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const remaining = Math.max(0, initial - elapsed);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      <Text style={[styles.label, { color: colors.mutedForeground }]}>FOCUSING ON</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>{task.title}</Text>

      <View style={[styles.timer, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        <Text style={[styles.timerNum, { color: colors.primary }]}>{fmt(remaining)}</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 4 }}>
          {running ? "in flow" : "ready"}
        </Text>
      </View>

      {pep && (
        <Card style={{ marginTop: 16 }}>
          <Text style={{ color: colors.foreground, fontStyle: "italic" }}>"{pep}"</Text>
        </Card>
      )}

      {!running ? (
        <Button label="Start focus" onPress={start} fullWidth style={{ marginTop: 24 }} />
      ) : (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 24 }}>
          <Button
            label="Pause"
            variant="ghost"
            onPress={() => finish(false)}
            style={{ flex: 1 }}
          />
          <Button label="Done!" onPress={() => finish(true)} style={{ flex: 1 }} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", letterSpacing: 1 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", marginTop: 6 },
  timer: {
    marginTop: 32,
    paddingVertical: 48,
    alignItems: "center",
    borderWidth: 1,
  },
  timerNum: { fontSize: 64, fontFamily: "Inter_700Bold" },
});
