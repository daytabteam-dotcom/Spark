import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetChatHistory,
  useSendChatMessage,
  useListCharacters,
  getGetChatHistoryQueryKey,
  getListCharactersQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useSparkUser } from "@/hooks/useSparkUser";
import { CharacterAvatar } from "@/components/ui/CharacterAvatar";
import { getChatPlaceholder } from "@/lib/personalization";

export default function ChatScreen() {
  const colors = useColors();
  const qc = useQueryClient();
  const { userId, user } = useSparkUser();
  const [input, setInput] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const characterId = user?.selectedCharacterId ?? "entropy-fox";
  const chatPlaceholder = getChatPlaceholder(user);

  const characters = useListCharacters(
    { userId: userId ?? undefined },
    {
      query: {
        enabled: !!userId,
        queryKey: getListCharactersQueryKey({ userId: userId ?? undefined }),
      },
    },
  );
  const character = (characters.data ?? []).find((c) => c.id === characterId);

  const history = useGetChatHistory(
    { userId: userId ?? "", characterId, limit: 50 },
    {
      query: {
        enabled: !!userId,
        queryKey: getGetChatHistoryQueryKey({
          userId: userId ?? "",
          characterId,
          limit: 50,
        }),
      },
    },
  );
  const sendMut = useSendChatMessage();

  useEffect(() => {
    if (history.data?.length) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [history.data?.length]);

  const onSend = async () => {
    if (!userId || !input.trim()) return;
    const message = input.trim();
    setInput("");
    try {
      await sendMut.mutateAsync({
        data: { userId, characterId, message },
      });
      qc.invalidateQueries({
        queryKey: getGetChatHistoryQueryKey({ userId, characterId, limit: 50 }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  if (!userId || !user) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <View
        style={[
          styles.header,
          { borderBottomColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        {character && (
          <CharacterAvatar name={character.name} color={character.color} size={36} />
        )}
        <View style={{ marginLeft: 10 }}>
          <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>
            {character?.name ?? "Companion"}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
            {character?.tagline}
          </Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {(history.data ?? []).length === 0 && (
          <View style={{ alignItems: "center", paddingTop: 40 }}>
            <Text style={{ color: colors.mutedForeground, textAlign: "center" }}>
              Say hi. {character?.name} is listening.
            </Text>
          </View>
        )}
        {(history.data ?? []).map((m) => {
          const isUser = m.role === "user";
          return (
            <View key={m.id}>
              <View
                style={[
                  styles.bubble,
                  {
                    backgroundColor: isUser ? colors.primary : colors.card,
                    alignSelf: isUser ? "flex-end" : "flex-start",
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                  },
                ]}
              >
                <Text
                  style={{
                    color: isUser ? colors.primaryForeground : colors.foreground,
                    fontFamily: "Inter_400Regular",
                    fontSize: 15,
                    lineHeight: 21,
                  }}
                >
                  {m.content}
                </Text>
              </View>
              {Array.isArray(m.uiBlocks) &&
                m.uiBlocks.map((blk, i) => <UIBlockView key={i} block={blk} />)}
            </View>
          );
        })}
        {sendMut.isPending && (
          <View
            style={[
              styles.bubble,
              {
                backgroundColor: colors.card,
                alignSelf: "flex-start",
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <ActivityIndicator color={colors.primary} size="small" />
          </View>
        )}
      </ScrollView>

      <View
        style={[
          styles.inputRow,
          { borderTopColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={chatPlaceholder}
          placeholderTextColor={colors.mutedForeground}
          multiline
          style={[
            styles.input,
            {
              color: colors.foreground,
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        />
        <Pressable
          onPress={onSend}
          disabled={!input.trim() || sendMut.isPending}
          style={[
            styles.sendBtn,
            {
              backgroundColor: input.trim() ? colors.primary : colors.muted,
              borderRadius: colors.radius,
            },
          ]}
        >
          <Feather
            name="arrow-up"
            size={20}
            color={input.trim() ? colors.primaryForeground : colors.mutedForeground}
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function UIBlockView({ block }: { block: unknown }) {
  const colors = useColors();
  if (!block || typeof block !== "object") return null;
  const b = block as { type?: string; options?: string[]; items?: string[]; data?: { minutes?: number; message?: string } };
  if (b.type === "options" && Array.isArray(b.options)) {
    return (
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
        {b.options.map((o, i) => (
          <View
            key={i}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              backgroundColor: colors.secondary,
              borderRadius: colors.radius,
            }}
          >
            <Text style={{ color: colors.foreground, fontSize: 13 }}>{o}</Text>
          </View>
        ))}
      </View>
    );
  }
  if (b.type === "checklist" && Array.isArray(b.items)) {
    return (
      <View
        style={{
          marginTop: 6,
          padding: 10,
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: colors.radius,
        }}
      >
        {b.items.map((it, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 4 }}>
            <Feather name="square" size={16} color={colors.mutedForeground} />
            <Text style={{ color: colors.foreground, marginLeft: 8 }}>{it}</Text>
          </View>
        ))}
      </View>
    );
  }
  if (b.type === "celebration" && b.data?.message) {
    return (
      <View
        style={{
          marginTop: 6,
          padding: 12,
          backgroundColor: colors.accent,
          borderRadius: colors.radius,
        }}
      >
        <Text style={{ color: colors.accentForeground, fontFamily: "Inter_600SemiBold" }}>
          ✨ {b.data.message}
        </Text>
      </View>
    );
  }
  if (b.type === "timer" && b.data?.minutes) {
    return (
      <View
        style={{
          marginTop: 6,
          padding: 10,
          backgroundColor: colors.secondary,
          borderRadius: colors.radius,
          alignSelf: "flex-start",
        }}
      >
        <Text style={{ color: colors.foreground }}>⏱ {b.data.minutes} min</Text>
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
  },
  bubble: {
    maxWidth: "85%",
    padding: 12,
    borderWidth: 1,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  sendBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
