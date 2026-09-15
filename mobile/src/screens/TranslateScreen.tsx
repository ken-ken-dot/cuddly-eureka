import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../theme";
import { SPACING, TYPE } from "../theme/tokens";
import { Pill } from "../components/Pill";
import { Ticket } from "../components/Ticket";
import { CoachingTicket } from "../components/CoachingTicket";
import { ErrorBar } from "../components/ErrorBar";
import { Waveform } from "../components/Waveform";
import { TriangleDivider } from "../components/TriangleDivider";
import { useSession, ERROR_COPY } from "../store/session";
import { useCorrections } from "../store/corrections";
import { useSpeech } from "../speech/useSpeech";
import { evaluateKeptMistake } from "../corrections/notifications";
import { DIRECTIONS, directionLabel, type Turn } from "../types";

export function TranslateScreen() {
  const { tokens: t } = useTheme();
  const session = useSession();
  const keep = useCorrections((s) => s.keep);
  const speech = useSpeech();

  const [textMode, setTextMode] = useState(false);
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList<Turn>>(null);

  const onMicPress = useCallback(async () => {
    if (session.listening) {
      session.setListening(false);
      const audio = await speech.stop();
      if (audio) {
        await session.submitUtterance(audio, session.direction);
      } else {
        session.setError({ kind: "no-speech", message: ERROR_COPY.noSpeech });
      }
      return;
    }
    session.clearError();
    const result = await speech.start();
    if (result.ok) {
      session.setListening(true);
      AccessibilityInfo.announceForAccessibility("Listening. Press the microphone again to translate.");
    } else if (result.reason === "permission") {
      session.setError({ kind: "permission", message: ERROR_COPY.permission });
    } else {
      session.setError({ kind: "mic", message: ERROR_COPY.mic });
    }
  }, [session, speech]);

  const onSubmitText = useCallback(async () => {
    const value = draft;
    if (!value.trim()) return;
    setDraft("");
    await session.submitText(value, session.direction);
  }, [draft, session]);

  const onKeep = useCallback(
    (turn: Turn) => {
      if (!turn.correction || turn.keptId) return;
      const record = keep({
        wrong: turn.correction.wrong,
        right: turn.correction.right,
        tip: turn.correction.tip,
        sourceLang: session.direction === "rw-zh" ? "rw" : "zh-CN",
        targetLang: session.direction === "rw-zh" ? "zh-CN" : "rw",
        // V3: attribution fields — absent on V1/V2 records, which are backfilled
        // in memory by the corrections store (never rewritten on disk).
        entryId: turn.correction.entryId,
        topic: turn.topic,
      });
      session.markKept(turn.id, record.id);
      AccessibilityInfo.announceForAccessibility(`Correction kept. Say ${turn.correction.right}.`);
      // V3: after a keep, check the repeat-mistake notification trigger. All
      // client-side; silently no-ops when notifications are off or denied.
      if (turn.correction.entryId) {
        void evaluateKeptMistake(turn.correction.entryId, turn.correction.right);
      }
    },
    [keep, session],
  );

  useEffect(() => {
    if (session.lastTurnId) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [session.lastTurnId]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.surface }]} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        {/* Direction selector — V1 is locked to Kinyarwanda ⇄ Mandarin */}
        <View style={styles.directionRow}>
          {DIRECTIONS.map((d) => (
            <Pill
              key={d}
              tokens={t}
              label={directionLabel(d)}
              active={session.direction === d}
              onPress={() => session.setDirection(d)}
            />
          ))}
        </View>

        {session.mockMode ? (
          <View
            accessibilityRole="text"
            accessibilityLabel="Demo mode: responses are placeholders because no API keys are configured."
            style={[styles.mockBanner, { backgroundColor: t.surface2, borderColor: t.ochre }]}
          >
            <Text style={[styles.mockText, { color: t.ochre }]}>
              Demo mode — placeholder responses (no API keys configured)
            </Text>
          </View>
        ) : null}

        {session.error ? (
          <View style={styles.errorWrap}>
            <ErrorBar tokens={t} message={session.error.message} onDismiss={session.clearError} />
          </View>
        ) : null}

        {/* Transcript */}
        <FlatList
          ref={listRef}
          data={session.turns}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: t.ink }]}>Nothing translated yet</Text>
              <Text style={[styles.emptyBody, { color: t.inkDim }]}>
                Press the microphone and speak. You'll see what was heard, its translation, and a
                ticket for any word worth fixing.
              </Text>
              <TriangleDivider colors={[t.ochre, t.rust, t.moss]} />
            </View>
          }
          renderItem={({ item }) => (
            <View
              style={[styles.turn, item.speaker === "them" ? styles.turnThem : styles.turnYou]}
            >
              <Text style={[styles.speaker, { color: t.inkDim }]}>
                {item.speaker === "you" ? "YOU" : "THEM"}
              </Text>
              <Text style={[styles.original, { color: t.ink }]}>{item.original}</Text>
              <Text style={[styles.translated, { color: t.ochre }]}>{item.translated}</Text>
              {item.correction ? (
                <View style={styles.ticketWrap}>
                  <Ticket
                    tokens={t}
                    wrong={item.correction.wrong}
                    right={item.correction.right}
                    tip={item.correction.tip}
                    kept={Boolean(item.keptId)}
                    onKeep={() => onKeep(item)}
                  />
                </View>
              ) : null}
              {/* V3 typed-text coaching: only ever attached to typed turns; the
                  spoken flow renders exactly as before. */}
              {item.coaching ? (
                <View style={styles.ticketWrap}>
                  <CoachingTicket tokens={t} coaching={item.coaching} />
                </View>
              ) : null}
            </View>
          )}
        />

        {/* Text input mode */}
        {textMode ? (
          <View style={styles.textInputRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Type a phrase to translate…"
              placeholderTextColor={t.inkDim}
              accessibilityLabel="Phrase to translate"
              multiline
              style={[styles.textInput, { backgroundColor: t.surface2, borderColor: t.line, color: t.ink }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Translate typed phrase"
              disabled={session.submitting || !draft.trim()}
              onPress={onSubmitText}
              style={({ pressed }) => [
                styles.send,
                { backgroundColor: t.moss, opacity: pressed || session.submitting ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.sendText, { color: t.ink }]}>→</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Mic + mode toggle */}
        <View style={[styles.controls, { borderTopColor: t.line }]}>
          <Waveform active={session.listening} color={t.rust} />
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityState={{ busy: session.listening }}
            accessibilityLabel={
              session.listening ? "Stop listening and translate" : "Start listening"
            }
            onPress={onMicPress}
            disabled={session.submitting}
            style={({ pressed }) => [
              styles.mic,
              {
                backgroundColor: session.listening ? t.rust : t.ochre,
                opacity: pressed || session.submitting ? 0.85 : 1,
              },
            ]}
          >
            <Text style={[styles.micText, { color: t.surface }]}>
              {session.listening ? "STOP" : session.submitting ? "…" : "MIC"}
            </Text>
          </Pressable>
          <Pill
            tokens={t}
            label={textMode ? "Text: ON" : "Text mode"}
            active={textMode}
            onPress={() => setTextMode((v) => !v)}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  directionRow: {
    flexDirection: "row",
    gap: SPACING.s,
    paddingHorizontal: SPACING.m,
    paddingTop: SPACING.s,
    paddingBottom: SPACING.xs,
  },
  mockBanner: {
    marginHorizontal: SPACING.m,
    marginTop: SPACING.xs,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACING.s,
    paddingVertical: 6,
  },
  mockText: { fontSize: TYPE.tiny, fontWeight: "700" },
  errorWrap: { paddingHorizontal: SPACING.m, paddingTop: SPACING.xs },
  listContent: { padding: SPACING.m, flexGrow: 1 },
  empty: { flex: 1, justifyContent: "center", gap: SPACING.s, paddingHorizontal: SPACING.l },
  emptyTitle: { fontSize: TYPE.h2, fontWeight: "700", textAlign: "center" },
  emptyBody: { fontSize: TYPE.body, textAlign: "center", lineHeight: 22 },
  turn: { marginBottom: SPACING.l },
  turnYou: { alignSelf: "stretch" },
  turnThem: { alignSelf: "stretch" },
  speaker: { fontSize: TYPE.tiny, letterSpacing: 1, fontWeight: "700", marginBottom: 2 },
  original: { fontSize: TYPE.body, lineHeight: 22 },
  translated: { fontSize: TYPE.body, lineHeight: 24, marginTop: 2, fontWeight: "600" },
  ticketWrap: { marginTop: SPACING.s },
  textInputRow: {
    flexDirection: "row",
    gap: SPACING.s,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
  },
  textInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACING.m,
    paddingTop: 10,
    paddingBottom: 10,
    minHeight: 44,
    fontSize: TYPE.body,
    textAlignVertical: "center",
  },
  send: {
    width: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: { fontSize: 20, fontWeight: "800" },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.m,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  mic: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(0,0,0,0.15)",
  },
  micText: { fontSize: TYPE.small, fontWeight: "800", letterSpacing: 1 },
});
