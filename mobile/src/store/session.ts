import { create } from "zustand";

import { findCorrection } from "../corrections/matcher";
import { coachTypedPhrase } from "../corrections/coaching";
import { useTracking } from "../corrections/tracking";
import { evaluateLevelCleared } from "../corrections/notifications";
import { transcribe, translate } from "../api/client";
import { ApiError } from "../api/errors";
import type { CoachingInfo, Direction, Turn } from "../types";
import { directionLanguages } from "../types";

export type SessionError =
  | { kind: "network"; message: string }
  | { kind: "timeout"; message: string }
  | { kind: "no-speech"; message: string }
  | { kind: "provider"; message: string }
  | { kind: "permission"; message: string }
  | { kind: "mic"; message: string };

interface SessionState {
  turns: Turn[];
  direction: Direction;
  listening: boolean;
  submitting: boolean;
  error: SessionError | null;
  lastTurnId: string | null;
  /** True once the proxy reports placeholder/mock responses (no API keys). */
  mockMode: boolean;

  setDirection: (d: Direction) => void;
  setListening: (v: boolean) => void;
  setError: (e: SessionError | null) => void;
  clearError: () => void;
  submitUtterance: (audioBase64: string, direction: Direction) => Promise<void>;
  submitText: (text: string, direction: Direction) => Promise<void>;
  markKept: (turnId: string, recordId: string) => void;
  reset: () => void;
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `turn_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export const ERROR_COPY = {
  network: "Can't reach the translation service. Check your internet connection and try again.",
  timeout: "The translation service took too long to respond. Try again.",
  noSpeech: "No speech detected — speak a little louder and hold the device closer.",
  provider: "The translation service had a problem. Please try again.",
  permission:
    "Microphone access is off. Allow VUGA to use the microphone in Settings, then try again.",
  mic: "The microphone could not start. Close other apps using it and try again.",
} as const;

export const useSession = create<SessionState>((set) => ({
  turns: [],
  direction: "rw-zh",
  listening: false,
  submitting: false,
  error: null,
  lastTurnId: null,
  mockMode: false,

  setDirection: (d) => set({ direction: d, error: null }),
  setListening: (v) => set({ listening: v }),
  setError: (e) => set({ error: e }),
  clearError: () => set({ error: null }),

  markKept: (turnId, recordId) =>
    set((s) => ({
      turns: s.turns.map((t) => (t.id === turnId ? { ...t, keptId: recordId } : t)),
    })),

  reset: () => set({ turns: [], error: null, lastTurnId: null }),

  submitUtterance: async (audioBase64, direction) => {
    const { source, target } = directionLanguages(direction);
    const userSpeaks = direction === "rw-zh" ? "rw" : "zh-CN";
    try {
      set({ submitting: true });
      const stt = await transcribe(audioBase64, userSpeaks);
      const text = stt.text.trim();
      if (!text) {
        set({
          submitting: false,
          error: { kind: "no-speech", message: ERROR_COPY.noSpeech },
        });
        return;
      }
      const mt = await translate(text, source, target);
      const hit = userSpeaks === "rw" ? findCorrection(text) : null;
      // rw-zh: the vendor (user) is speaking. zh-rw: the customer speaks.
      const speaker: Turn["speaker"] = direction === "rw-zh" ? "you" : "them";
      const turn: Turn = {
        id: nextId(),
        speaker,
        original: text,
        translated: mt.translated,
        correction: hit ? { wrong: hit.wrong, right: hit.right, tip: hit.tip, entryId: hit.entryId } : undefined,
        topic: hit?.topic,
        at: Date.now(),
      };
      // V3 signal tracking: log every "you"-side Kinyarwanda exchange for the
      // proficiency heuristic.
      if (speaker === "you") {
        useTracking
          .getState()
          .recordTurn({ turnId: turn.id, hadMistake: Boolean(hit), entryId: hit?.entryId });
        const report = useTracking.getState().recompute();
        // V3 trigger 2: fire a local notification when a per-topic level has
        // risen vs. the session-start snapshot. No-ops unless notifications
        // are on, permitted, and a baseline exists.
        evaluateLevelCleared(report);
      }
      set((s) => ({
        turns: [...s.turns, turn],
        submitting: false,
        lastTurnId: turn.id,
        error: null,
        mockMode: s.mockMode || stt.mock || mt.mock,
      }));
    } catch (e) {
      set({ submitting: false, error: toSessionError(e) });
    }
  },

  submitText: async (text, direction) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const { source, target } = directionLanguages(direction);
    try {
      set({ submitting: true });
      const mt = await translate(trimmed, source, target);
      const speaker: Turn["speaker"] = source === "rw" ? "you" : "them";
      const hit = source === "rw" ? findCorrection(text) : null;
      // V3 typed-text coaching: attached only to typed "you" turns in
      // Kinyarwanda. The correction ticket (when the matcher fires) is rendered
      // exactly as before — coaching only adds to it.
      let coaching: CoachingInfo | undefined;
      let topic = hit?.topic;
      if (speaker === "you" && source === "rw") {
        const result = coachTypedPhrase(text);
        topic = topic ?? (result.kind === "mistake" ? result.hit?.topic : result.topic);
        coaching = result.hit
          ? {
              kind: "mistake",
              wrong: result.hit.wrong,
              right: result.hit.right,
              tip: result.hit.tip,
              entryId: result.hit.entryId,
              matched: result.hit.matched,
              topic: result.hit.topic,
              line: result.line,
              practicedBefore: result.practicedBefore,
            }
          : {
              kind: "clean",
              topic: result.topic,
              clean: result.clean,
              level: result.level,
              levelText: result.levelText,
              line: result.line,
              tip: result.tip,
              practicedBefore: false,
            };
      }
      const turn: Turn = {
        id: nextId(),
        speaker,
        original: trimmed,
        translated: mt.translated,
        correction: hit ? { wrong: hit.wrong, right: hit.right, tip: hit.tip, entryId: hit.entryId } : undefined,
        topic,
        coaching,
        at: Date.now(),
      };
      // V3 signal tracking: typed exchanges with no known mistake still count
      // as clean volume for the topic the phrase touched.
      if (speaker === "you") {
        useTracking
          .getState()
          .recordTurn({
            turnId: turn.id,
            hadMistake: Boolean(hit),
            entryId: hit?.entryId,
            topic,
            typed: true,
          });
        const report = useTracking.getState().recompute();
        evaluateLevelCleared(report);
      }
      set((s) => ({
        turns: [...s.turns, turn],
        submitting: false,
        lastTurnId: turn.id,
        error: null,
        mockMode: s.mockMode || mt.mock,
      }));
    } catch (e) {
      set({ submitting: false, error: toSessionError(e) });
    }
  },
}));

function toSessionError(e: unknown): SessionError {
  if (e instanceof ApiError) {
    if (e.code === "NETWORK") return { kind: "network", message: e.userMessage };
    if (e.code === "TIMEOUT") return { kind: "timeout", message: e.userMessage };
    if (e.code === "NO_SPEECH") return { kind: "no-speech", message: e.userMessage };
    return { kind: "provider", message: e.userMessage };
  }
  return { kind: "provider", message: ERROR_COPY.provider };
}
