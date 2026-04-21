import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import {
  useListTasks,
  useExtractTasks,
  useConfirmExtractedTasks,
  useUpdateTask,
  useDeleteTask,
  useAwardXp,
  useLogBehaviorEvent,
  getListTasksQueryKey,
  getGetUserQueryKey,
} from "@workspace/api-client-react";
import type { ExtractedTask, Task } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useSparkUser } from "@/hooks/useSparkUser";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getAdaptiveTaskCopy } from "@/lib/personalization";

export default function TasksScreen() {
  const colors = useColors();
  const { userId, user } = useSparkUser();
  const qc = useQueryClient();
  const [dump, setDump] = useState("");
  const [extracted, setExtracted] = useState<ExtractedTask[] | null>(null);
  const taskCopy = getAdaptiveTaskCopy(user);
  const tasks = useListTasks(
    { userId: userId ?? "" },
    {
      query: {
        enabled: !!userId,
        queryKey: getListTasksQueryKey({ userId: userId ?? "" }),
      },
    },
  );
  const extractMut = useExtractTasks();
  const confirmMut = useConfirmExtractedTasks();
  const updateMut = useUpdateTask();
  const deleteMut = useDeleteTask();
  const awardXp = useAwardXp();
  const behaviorMut = useLogBehaviorEvent();

  const refresh = () => {
    if (userId) {
      qc.invalidateQueries({ queryKey: getListTasksQueryKey({ userId }) });
      qc.invalidateQueries({ queryKey: getGetUserQueryKey(userId) });
    }
  };

  const onExtract = async () => {
    if (!dump.trim() || !userId) return;
    try {
      const res = await extractMut.mutateAsync({ data: { rawText: dump, userId } });
      setExtracted(res.tasks);
      behaviorMut.mutate({
        data: {
          userId,
          eventType: "tasks_extracted",
          metadata: { count: res.tasks.length },
        },
      });
    } catch (e) {
      Alert.alert("Extraction failed", String(e));
    }
  };

  const onConfirm = async () => {
    if (!userId || !extracted || extracted.length === 0) return;
    try {
      await confirmMut.mutateAsync({ data: { userId, tasks: extracted } });
      setExtracted(null);
      setDump("");
      refresh();
    } catch (e) {
      Alert.alert("Save failed", String(e));
    }
  };

  const onComplete = async (t: Task) => {
    if (!userId) return;
    await updateMut.mutateAsync({
      taskId: t.id,
      data: { status: "completed", endTime: new Date().toISOString() },
    });
    const xp = t.resistanceLevel === "high" ? 30 : t.resistanceLevel === "medium" ? 15 : 8;
    await awardXp.mutateAsync({
      data: { userId, eventType: "task_completed", xpAwarded: xp },
    });
    refresh();
  };

  const onDelete = async (t: Task) => {
    if (userId) {
      behaviorMut.mutate({
        data: { userId, eventType: "task_abandoned", taskId: t.id, metadata: { source: "delete" } },
      });
    }
    await deleteMut.mutateAsync({ taskId: t.id });
    refresh();
  };

  const open = (tasks.data ?? []).filter((t) => t.status !== "completed");
  const done = (tasks.data ?? []).filter((t) => t.status === "completed");

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Card>
        <Text style={[styles.label, { color: colors.foreground }]}>Brain dump</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          {taskCopy.placeholder}
        </Text>
        <TextInput
          value={dump}
          onChangeText={setDump}
          multiline
          placeholder={"e.g. need to pay rent, reply to mom, gym tomorrow, finish slides..."}
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.textarea,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              color: colors.foreground,
              borderRadius: colors.radius,
            },
          ]}
        />
        <Button
          label={taskCopy.extractLabel}
          onPress={onExtract}
          loading={extractMut.isPending}
          disabled={!dump.trim()}
          fullWidth
          style={{ marginTop: 12 }}
        />
      </Card>

      {extracted && (
        <View style={{ marginTop: 16 }}>
          <Text style={[styles.section, { color: colors.foreground }]}>
            Found {extracted.length} task{extracted.length === 1 ? "" : "s"}
          </Text>
          {extracted.map((t, i) => (
            <Card key={i} style={{ marginBottom: 8 }}>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium" }}>
                {t.title}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }}>
                {t.durationMinutes ? `~${t.durationMinutes} min · ` : ""}
                resistance: {t.resistanceLevel}
                {t.taskType ? ` · ${t.taskType}` : ""}
              </Text>
            </Card>
          ))}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <Button
              label="Discard"
              variant="ghost"
              onPress={() => setExtracted(null)}
              style={{ flex: 1 }}
            />
            <Button
              label="Save all"
              onPress={onConfirm}
              loading={confirmMut.isPending}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      )}

      <Text style={[styles.section, { color: colors.foreground }]}>Open ({open.length})</Text>
      {tasks.isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : open.length === 0 ? (
        <Card>
          <Text style={{ color: colors.mutedForeground, textAlign: "center" }}>
            {taskCopy.emptyState}
          </Text>
        </Card>
      ) : (
        open.map((t) => (
          <Card key={t.id} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Pressable onPress={() => onComplete(t)} style={styles.checkbox}>
                <Feather name="circle" size={22} color={colors.mutedForeground} />
              </Pressable>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium" }}>
                  {t.title}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                  {t.durationMinutes ? `~${t.durationMinutes} min · ` : ""}
                  {t.resistanceLevel}
                </Text>
              </View>
              <Pressable onPress={() => onDelete(t)} hitSlop={10}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
          </Card>
        ))
      )}

      {done.length > 0 && (
        <>
          <Text style={[styles.section, { color: colors.foreground }]}>
            Done ({done.length})
          </Text>
          {done.slice(0, 10).map((t) => (
            <Card key={t.id} style={{ marginBottom: 8, opacity: 0.6 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Feather name="check-circle" size={22} color={colors.success} />
                <Text
                  style={{
                    color: colors.foreground,
                    marginLeft: 10,
                    textDecorationLine: "line-through",
                    flex: 1,
                  }}
                >
                  {t.title}
                </Text>
              </View>
            </Card>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60 },
  label: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  sub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4, marginBottom: 12 },
  textarea: {
    borderWidth: 1,
    minHeight: 120,
    padding: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlignVertical: "top",
  },
  section: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 24, marginBottom: 8 },
  checkbox: { padding: 2 },
});
