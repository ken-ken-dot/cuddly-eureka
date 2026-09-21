import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../theme";
import { RADII, SPACING, TRACKING, TYPE } from "../theme/tokens";
import { elevate } from "../theme/elevation";
import { PhosphorIcon } from "../components/PhosphorIcon";
import { Logo } from "../components/Logo";
import { LanguageToggle } from "../components/LanguageToggle";
import { LanguagePicker } from "../components/LanguagePicker";
import { MicButton, type MicButtonState } from "../components/MicButton";
import { EmptyState } from "../components/EmptyState";
import { Ticket } from "../components/Ticket";
import { CoachingTicket } from "../components/CoachingTicket";
import { ErrorBar } from "../components/ErrorBar";
import { useSession, ERROR_COPY } from "../store/session";
import { useCorrections } from "../store/corrections";
import { useSpeech } from "../speech/useSpeech";
import { openRealtimeSession, type RelayHandle } from "../api/realtime";
import { startLiveAudio } from "../speech/liveAudio";
import { evaluateKeptMistake } from "../corrections/notifications";
import type { Turn } from "../types";
import { directionLanguages } from "../types";
import {
  Keyboard,
  Microphone,
  PaperPlaneRight,
  Waveform as WaveformIcon,
} from "phosphor-react-native";

export function TranslateScreen() {
  const { tokens: t } = useTheme();
  const session = useSession();
  const keep = useCorrections((s) => s.keep);
  const speech = useSpeech();

  const [textMode, setTextMode] = useState(false);
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList<Turn>>(null);

  // --- Live real-time mode (multilingual brief Section 4) — additive. The
  // default VOICE flow below is byte-for-byte the V1 behavior; LIVE is an
  // explicit opt-in toggle that routes the mic through the WS relay instead.
  const [liveMode, setLiveMode] = useState(false);
  const relayRef = useRef<RelayHandle | null>(null);
  const audioRef = useRef<{ stop: () => Promise<void> } | null>(null);

  const stopLive = useCallback(async () => {
    relayRef.current?.stop();
    relayRef.current = null;
    await audioRef.current?.stop().catch(() => undefined);
    audioRef.current = null;
    session.setLive(false);
    session.setLivePartial("");
  }, [session]);

  const startLive = useCallback(async () => {
    session.clearError();
    const { source, target } = directionLanguages(session.direction);
    try {
      const audio = await startLiveAudio({
        onChunk: (chunk) => relayRef.current?.sendAudioChunk(chunk),
        onEnded: () => {
          void stopLive();
          session.setError({ kind: "mic", message: ERROR_COPY.mic });
        },
      });
      audioRef.current = audio;
      const relay = openRealtimeSession(source, target, {
        onState: (state) => {
          if (state === "idle" && relayRef.current) {
            // Server closed (error/stop) — stop capture and reset the toggle.
            void stopLive();
          }
        },
        onPartial: (text) => session.setLivePartial(text),
        onFinal: (text, translated) => session.pushLiveTurn(text, translated, session.direction),
        onError: (code, message, fatal) => {
          session.setError({ kind: fatal ? "provider" : "network", message });
          if (fatal) void stopLive();
        },
      });
      relayRef.current = relay;
      session.setLive(true);
      AccessibilityInfo.announceForAccessibility("Live translation on. Press the microphone again to stop.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      session.setError(
        message === "PERMISSION"
          ? { kind: "permission", message: ERROR_COPY.permission }
          : { kind: "mic", message: ERROR_COPY.mic },
      );
    }
  }, [session, stopLive]);

  const toggleLiveMode = useCallback(() => {
    setLiveMode((v) => {
      if (v) void stopLive();
      return !v;
    });
  }, [stopLive]);

  const onMicPress = useCallback(async () => {
    // LIVE mode: mic press starts/stops the continuous relay session.
    if (liveMode) {
      if (session.live) {
        await stopLive();
      } else {
        await startLive();
      }
      return;
    }
    // --- V1 flow, unchanged ---
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
  }, [session, speech, liveMode, startLive, stopLive]);

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

  // Tear the relay down when the screen unmounts (tab switch / app close).
  useEffect(() => {
    return () => {
      relayRef.current?.stop();
      relayRef.current = null;
      void audioRef.current?.stop().catch(() => undefined);
      audioRef.current = null;
    };
  }, []);

  // Mic button state machine: idle breathing → recording ring → processing.
  // LIVE mode reuses the same visual states via session.live.
  const micState: MicButtonState = session.submitting
    ? "processing"
    : session.listening || session.live
      ? "recording"
      : "idle";

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.surface }]} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        {/* Brand + direction selector — V1 is locked to Kinyarwanda ⇄ Mandarin */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Logo size={18} ochre={t.ochre} rust={t.rust} />
            <Text style={[styles.brand, { color: t.ink }]}>VUGA</Text>
            {session.mockMode ? (
              <View style={[styles.mockTag, { backgroundColor: t.rustSoft }]}>
                <Text style={[styles.mockText, { color: t.rust }]}>DEMO</Text>
              </View>
            ) : null}
          </View>
          {/* Multilingual brief Section 5: four verified languages via the
              source/target picker. Kinyarwanda⇄Mandarin stays the default
              option; the V1 two-segment toggle remains for the locked-pair
              layout if product wants it back. */}
          <LanguagePicker tokens={t} value={session.direction} onChange={session.setDirection} />
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

        {/* Transcript — each exchange is a tactile card */}
        <FlatList
          ref={listRef}
          data={session.turns}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              tokens={t}
              icon={WaveformIcon}
              title="Nothing translated yet"
              body="Press the microphone and speak. You'll see what was heard, its translation, and a ticket for any word worth fixing."
            />
          }
          renderItem={({ item }) => {
            const them = item.speaker === "them";
            return (
              <View
                style={[
                  styles.turn,
                  { backgroundColor: them ? t.surface2 : t.card, borderColor: t.line },
                  elevate("card", t),
                ]}
              >
                <Text style={[styles.speaker, them ? { color: t.teal } : { color: t.ochre }]}>
                  {them ? "THEM" : "YOU"}
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
            );
          }}
        />

        {/* Live interim transcript — only during an open relay session */}
        {session.live && session.livePartial ? (
          <View style={styles.livePartialWrap}>
            <Text style={[styles.livePartial, { color: t.inkDim }]}>{session.livePartial}…</Text>
          </View>
        ) : null}

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
                { backgroundColor: t.ochre, opacity: pressed || session.submitting ? 0.85 : 1 },
              ]}
            >
              <PhosphorIcon icon={PaperPlaneRight} size={20} color={t.surface} weight="fill" />
            </Pressable>
          </View>
        ) : null}

        {/* Mic-first controls with the mode toggle beside it */}
        <View style={[styles.controls, { borderTopColor: t.line }]}>
          <View style={styles.side}>
            <Pressable
              accessible
              accessibilityRole="button"
              accessibilityState={{ selected: textMode }}
              accessibilityLabel={textMode ? "Switch to voice mode" : "Switch to text input mode"}
              onPress={() => setTextMode((v) => !v)}
              style={({ pressed }) => [
                styles.modeBtn,
                { backgroundColor: textMode ? t.cardIn : "transparent", opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <PhosphorIcon
                icon={textMode ? Keyboard : Microphone}
                size={16}
                color={textMode ? t.ochre : t.inkDim}
              />
              <Text style={[styles.modeLabel, { color: textMode ? t.ochre : t.inkDim }]}>
                {textMode ? "TEXT" : "VOICE"}
              </Text>
            </Pressable>
          </View>
          <MicButton tokens={t} state={micState} onPress={onMicPress} />
          <View style={styles.side}>
            {/* Multilingual brief Section 4: opt-in continuous real-time mode.
                Off by default — V1's record-once flow stays the default. */}
            <Pressable
              accessible
              accessibilityRole="button"
              accessibilityState={{ selected: liveMode }}
              accessibilityLabel={liveMode ? "Turn off live mode" : "Turn on live mode"}
              onPress={toggleLiveMode}
              style={({ pressed }) => [
                styles.modeBtn,
                { backgroundColor: liveMode ? t.cardIn : "transparent", opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <PhosphorIcon icon={WaveformIcon} size={16} color={liveMode ? t.ochre : t.inkDim} />
              <Text style={[styles.modeLabel, { color: liveMode ? t.ochre : t.inkDim }]}>LIVE</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: SPACING.m,
    paddingTop: SPACING.s,
    paddingBottom: SPACING.xs,
    gap: SPACING.s,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.s,
    minHeight: 24,
  },
  brand: { fontSize: TYPE.body, fontWeight: "800", letterSpacing: 3 },
  mockTag: {
    borderRadius: RADII.pill,
    paddingHorizontal: SPACING.s,
    paddingVertical: 2,
  },
  mockText: { fontSize: TYPE.tiny, fontWeight: "800", letterSpacing: TRACKING.wide },
  mockBanner: {
    marginHorizontal: SPACING.m,
    marginTop: SPACING.xs,
    borderRadius: RADII.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACING.s,
    paddingVertical: 6,
  },
  errorWrap: { paddingHorizontal: SPACING.m, paddingTop: SPACING.xs },
  listContent: { padding: SPACING.m, flexGrow: 1, gap: SPACING.m },
  turn: {
    borderRadius: RADII.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.m,
  },
  speaker: { fontSize: TYPE.tiny, letterSpacing: TRACKING.wide, fontWeight: "800", marginBottom: 4 },
  original: { fontSize: TYPE.body, lineHeight: 22 },
  translated: { fontSize: TYPE.body, lineHeight: 24, marginTop: 2, fontWeight: "600" },
  ticketWrap: { marginTop: SPACING.s },
  textInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: SPACING.s,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
  },
  textInput: {
    flex: 1,
    borderRadius: RADII.card,
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
    height: 44,
    borderRadius: RADII.button,
    alignItems: "center",
    justifyContent: "center",
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACING.m,
    paddingTop: SPACING.xs,
  },
  side: { width: 84, alignItems: "center" },
  modeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: RADII.button,
    paddingHorizontal: SPACING.s,
    paddingVertical: 8,
  },
  modeLabel: { fontSize: TYPE.tiny, fontWeight: "800", letterSpacing: TRACKING.wide },
  livePartialWrap: {
    paddingHorizontal: SPACING.m,
    paddingTop: SPACING.xs,
    alignItems: "center",
  },
  livePartial: { fontSize: TYPE.body, fontStyle: "italic" },
});
