import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useCreateUser } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { Button } from "@/components/ui/Button";
import { CharacterAvatar } from "@/components/ui/CharacterAvatar";
import { useSparkUser } from "@/hooks/useSparkUser";
import { setStoredCharacterId } from "@/lib/userStore";
import {
  ONBOARDING_QUESTIONS,
  type OnboardingAnswer,
  type OnboardingQuestion,
} from "@/lib/onboardingQuestions";

if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const STARTER_CHARACTERS = [
  {
    id: "entropy-fox",
    name: "Entropy Fox",
    color: "#FF6B35",
    tagline: "Warm chaos, quick sparks, low-pressure momentum.",
  },
  {
    id: "laser-owl",
    name: "Laser Owl",
    color: "#4ECDC4",
    tagline: "Clear focus, calm structure, one step at a time.",
  },
];

type SetupAnswers = Record<string, OnboardingAnswer>;

const TOTAL_STEPS = ONBOARDING_QUESTIONS.length + 3;

export default function Onboarding() {
  const colors = useColors();
  const router = useRouter();
  const { setUser } = useSparkUser();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [characterId, setCharacterId] = useState("entropy-fox");
  const [answers, setAnswers] = useState<SetupAnswers>({});
  const [openResponse, setOpenResponse] = useState("");
  const createUser = useCreateUser();

  const progress = useMemo(() => (step + 1) / TOTAL_STEPS, [step]);
  const currentQuestion = ONBOARDING_QUESTIONS[step - 2];
  const isOpenResponseStep = step === TOTAL_STEPS - 1;

  const animateNext = (nextStep: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStep(nextStep);
  };

  const selectAnswer = (question: OnboardingQuestion, selectedOption: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAnswers((prev) => ({
      ...prev,
      [question.id]: {
        selectedOption,
        customAnswer:
          selectedOption === "Other" ? prev[question.id]?.customAnswer ?? "" : undefined,
      },
    }));
  };

  const updateCustomAnswer = (question: OnboardingQuestion, customAnswer: string) => {
    setAnswers((prev) => ({
      ...prev,
      [question.id]: { selectedOption: "Other", customAnswer },
    }));
  };

  const canContinue = () => {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return Boolean(characterId);
    if (isOpenResponseStep) return true;
    if (!currentQuestion) return false;
    const answer = answers[currentQuestion.id];
    if (!answer?.selectedOption) return false;
    if (answer.selectedOption === "Other") return Boolean(answer.customAnswer?.trim());
    return true;
  };

  const onFinish = async () => {
    try {
      const onboardingAnswers = {
        ...answers,
        optional_context: openResponse.trim(),
      };
      const user = await createUser.mutateAsync({
        data: {
          name: name.trim() || "Spark Friend",
          selectedCharacterId: characterId,
          difficultyTags: [],
          onboardingAnswers,
        },
      });
      await setUser(user.id);
      await setStoredCharacterId(characterId);
      router.replace("/(tabs)");
    } catch (e) {
      Alert.alert("Could not finish setup", String(e));
    }
  };

  const next = () => {
    if (isOpenResponseStep) {
      onFinish();
      return;
    }
    animateNext(Math.min(step + 1, TOTAL_STEPS - 1));
  };

  const back = () => {
    if (step === 0) return;
    animateNext(step - 1);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <View>
            <Text style={[styles.brand, { color: colors.primary }]}>Spark</Text>
            <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
              A setup that learns how work feels for you.
            </Text>
          </View>
          {step > 0 && (
            <Pressable onPress={back} hitSlop={12} style={styles.backButton}>
              <Feather name="arrow-left" size={22} color={colors.foreground} />
            </Pressable>
          )}
        </View>

        <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: colors.primary, width: `${progress * 100}%` },
            ]}
          />
        </View>

        {step === 0 && (
          <View style={styles.section}>
            <Text style={[styles.kicker, { color: colors.primary }]}>First, the basics</Text>
            <Text style={[styles.heading, { color: colors.foreground }]}>
              What should we call you?
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="First name or nickname"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="words"
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                  borderRadius: 14,
                },
              ]}
            />
          </View>
        )}

        {step === 1 && (
          <View style={styles.section}>
            <Text style={[styles.kicker, { color: colors.primary }]}>Your starting companion</Text>
            <Text style={[styles.heading, { color: colors.foreground }]}>
              Pick the voice you want beside you.
            </Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              You can change this later as Spark gets to know your rhythm.
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
                      borderWidth: active ? 2 : 1,
                    },
                  ]}
                >
                  <CharacterAvatar name={c.name} color={c.color} />
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={[styles.charName, { color: colors.foreground }]}>{c.name}</Text>
                    <Text style={[styles.charTag, { color: colors.mutedForeground }]}>
                      {c.tagline}
                    </Text>
                  </View>
                  {active && <Feather name="check" size={20} color={colors.primary} />}
                </Pressable>
              );
            })}
          </View>
        )}

        {currentQuestion && (
          <QuestionStep
            question={currentQuestion}
            answer={answers[currentQuestion.id]}
            onSelect={selectAnswer}
            onCustomAnswer={updateCustomAnswer}
          />
        )}

        {isOpenResponseStep && (
          <View style={styles.section}>
            <Text style={[styles.kicker, { color: colors.primary }]}>Optional</Text>
            <Text style={[styles.heading, { color: colors.foreground }]}>
              Anything else we should know to make this work better for you?
            </Text>
            <TextInput
              value={openResponse}
              onChangeText={setOpenResponse}
              multiline
              placeholder="Tiny context, strong preferences, things that never work for you..."
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.textarea,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                  borderRadius: 14,
                },
              ]}
            />
          </View>
        )}

        <View style={styles.footer}>
          <Button
            label={isOpenResponseStep ? "Finish setup" : "Continue"}
            onPress={next}
            disabled={!canContinue()}
            loading={createUser.isPending}
            fullWidth
          />
          <Text style={[styles.stepText, { color: colors.mutedForeground }]}>
            Step {step + 1} of {TOTAL_STEPS}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuestionStep({
  question,
  answer,
  onSelect,
  onCustomAnswer,
}: {
  question: OnboardingQuestion;
  answer?: OnboardingAnswer;
  onSelect: (question: OnboardingQuestion, selectedOption: string) => void;
  onCustomAnswer: (question: OnboardingQuestion, customAnswer: string) => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.kicker, { color: colors.primary }]}>How work feels</Text>
      <Text style={[styles.heading, { color: colors.foreground }]}>{question.title}</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>
        Choose the closest fit. Your own words are welcome too.
      </Text>
      <View style={styles.optionStack}>
        {question.options.map((option) => {
          const active = answer?.selectedOption === option;
          return (
            <Pressable
              key={option}
              onPress={() => onSelect(question, option)}
              style={[
                styles.optionCard,
                {
                  backgroundColor: active ? colors.secondary : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.optionText, { color: colors.foreground }]}>{option}</Text>
              <View
                style={[
                  styles.radio,
                  { borderColor: active ? colors.primary : colors.border },
                ]}
              >
                {active && <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />}
              </View>
            </Pressable>
          );
        })}
      </View>
      {answer?.selectedOption === "Other" && (
        <TextInput
          value={answer.customAnswer ?? ""}
          onChangeText={(text) => onCustomAnswer(question, text)}
          placeholder={question.otherPrompt}
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.input,
            {
              marginTop: 12,
              backgroundColor: colors.card,
              borderColor: colors.primary,
              color: colors.foreground,
              borderRadius: 14,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 22, paddingTop: 28, paddingBottom: 48 },
  topBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  brand: { fontSize: 38, fontFamily: "Inter_700Bold" },
  tagline: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 4, maxWidth: 260 },
  backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  progressTrack: { height: 8, borderRadius: 999, overflow: "hidden", marginBottom: 30 },
  progressFill: { height: "100%", borderRadius: 999 },
  section: { gap: 8 },
  kicker: { fontSize: 12, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0 },
  heading: { fontSize: 25, lineHeight: 31, fontFamily: "Inter_700Bold", marginBottom: 4 },
  sub: { fontSize: 14, lineHeight: 20, fontFamily: "Inter_400Regular", marginBottom: 10 },
  input: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  textarea: {
    borderWidth: 1,
    minHeight: 160,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    lineHeight: 23,
    fontFamily: "Inter_400Regular",
    textAlignVertical: "top",
  },
  charRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginVertical: 6,
    borderRadius: 14,
  },
  charName: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  charTag: { fontSize: 13, lineHeight: 18, fontFamily: "Inter_400Regular", marginTop: 2 },
  optionStack: { gap: 9 },
  optionCard: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionText: { flex: 1, fontSize: 15, lineHeight: 20, fontFamily: "Inter_500Medium" },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 10, height: 10, borderRadius: 999 },
  footer: { marginTop: 28, gap: 12 },
  stepText: { textAlign: "center", fontSize: 12, fontFamily: "Inter_500Medium" },
});
