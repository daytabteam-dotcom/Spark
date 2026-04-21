import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useCreateUser } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { Button } from "@/components/ui/Button";
import { CharacterAvatar } from "@/components/ui/CharacterAvatar";
import { useSparkUser } from "@/hooks/useSparkUser";
import { setStoredCharacterId } from "@/lib/userStore";

const STARTER_CHARACTERS = [
  {
    id: "entropy-fox",
    name: "Entropy Fox",
    color: "#FF6B35",
    tagline: "Playful, slightly chaotic. Loves brain dumps.",
  },
  {
    id: "laser-owl",
    name: "Laser Owl",
    color: "#4ECDC4",
    tagline: "Surgical focus. One step at a time.",
  },
];

const TAG_OPTIONS = [
  "Time blindness",
  "Task initiation",
  "Hyperfocus",
  "Overwhelm",
  "Forgetfulness",
  "Emotional regulation",
];

export default function Onboarding() {
  const colors = useColors();
  const router = useRouter();
  const { setUser } = useSparkUser();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [characterId, setCharacterId] = useState("entropy-fox");
  const [tags, setTags] = useState<string[]>([]);
  const createUser = useCreateUser();

  const toggleTag = (t: string) => {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const onFinish = async () => {
    try {
      const user = await createUser.mutateAsync({
        data: {
          name: name.trim() || "Spark Friend",
          selectedCharacterId: characterId,
          difficultyTags: tags,
        },
      });
      await setUser(user.id);
      await setStoredCharacterId(characterId);
      router.replace("/(tabs)");
    } catch (e) {
      Alert.alert("Could not create account", String(e));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.brand, { color: colors.primary }]}>Spark</Text>
        <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
          Your ADHD companion
        </Text>

        {step === 0 && (
          <View style={styles.section}>
            <Text style={[styles.heading, { color: colors.foreground }]}>
              What should we call you?
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="First name or nickname"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                  borderRadius: colors.radius,
                },
              ]}
            />
            <Button
              label="Next"
              onPress={() => setStep(1)}
              disabled={name.trim().length === 0}
              fullWidth
              style={{ marginTop: 24 }}
            />
          </View>
        )}

        {step === 1 && (
          <View style={styles.section}>
            <Text style={[styles.heading, { color: colors.foreground }]}>
              Pick a starting companion
            </Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              You{"'"}ll unlock 18 more as you earn XP.
            </Text>
            {STARTER_CHARACTERS.map((c) => {
              const active = c.id === characterId;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCharacterId(c.id)}
                  style={[
                    styles.charRow,
                    {
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: colors.card,
                      borderRadius: colors.radius,
                      borderWidth: active ? 2 : 1,
                    },
                  ]}
                >
                  <CharacterAvatar name={c.name} color={c.color} />
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={[styles.charName, { color: colors.foreground }]}>
                      {c.name}
                    </Text>
                    <Text style={[styles.charTag, { color: colors.mutedForeground }]}>
                      {c.tagline}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            <Button
              label="Next"
              onPress={() => setStep(2)}
              fullWidth
              style={{ marginTop: 24 }}
            />
          </View>
        )}

        {step === 2 && (
          <View style={styles.section}>
            <Text style={[styles.heading, { color: colors.foreground }]}>
              What{"'"}s hard for you?
            </Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              Helps your companion understand. Pick any.
            </Text>
            <View style={styles.tagWrap}>
              {TAG_OPTIONS.map((t) => {
                const active = tags.includes(t);
                return (
                  <Pressable
                    key={t}
                    onPress={() => toggleTag(t)}
                    style={[
                      styles.tag,
                      {
                        backgroundColor: active ? colors.primary : colors.secondary,
                        borderRadius: colors.radius,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: active ? colors.primaryForeground : colors.foreground,
                        fontFamily: "Inter_500Medium",
                      }}
                    >
                      {t}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Button
              label="Let's go"
              onPress={onFinish}
              loading={createUser.isPending}
              fullWidth
              style={{ marginTop: 24 }}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 40 },
  brand: { fontSize: 48, fontFamily: "Inter_700Bold" },
  tagline: { fontSize: 16, fontFamily: "Inter_400Regular", marginTop: 4, marginBottom: 32 },
  section: { gap: 8 },
  heading: { fontSize: 24, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  sub: { fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 16 },
  input: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  charRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginVertical: 6,
  },
  charName: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  charTag: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { paddingHorizontal: 14, paddingVertical: 10 },
});
