import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import { findCorrection } from "./matcher";
import { computeProficiency, type HistoryEntry, type ProficiencyReport } from "./proficiency";
import { useCorrections } from "../store/corrections";

/**
 * V3 signal tracking — the event log the proficiency heuristic needs.
 *
 * V1 only stored kept corrections. That is not enough for "clean exchanges"
 * (successful, uncorrected exchanges per topic), so V3 adds an additive,
 * separate store with its own storage key. It never rewrites anything V1/V2
 * wrote; if this log is corrupt or missing, proficiency just starts from kept
 * corrections alone and nothing crashes.
 *
 * Sources of entries:
 *   - `recordTurn` — every "you"-side exchange in Kinyarwanda, spoken or typed,
 *     with whether the matcher fired. Typed turns also carry the session's
 *     topic so typed coaching can be attributed.
 *   - kept corrections come in via useCorrections (already a store).
 */

export interface TrackedTurn {
  /** Turn id (matches the Translate screen's Turn.id, for dedupe on markKept). */
  turnId: string;
  at: number;
  hadMistake: boolean;
  entryId?: string;
  /** Topic attributed by the session at submission time (typed turns). */
  topic?: string;
  /** True for typed submissions — typed exchanges only ever attribute clean volume. */
  typed?: boolean;
}

/** One proficiency snapshot per app session — used to detect "level cleared"
 * without ever persisting a lastSeen the user could lose by clearing data. */
interface LevelSnapshot {
  at: number;
  score: number;
  level: number;
  /** Per-topic level at snapshot time, for per-topic "cleared" detection. */
  topics: Record<string, number>;
}

interface TrackingState {
  /** Chronological log of "you"-side Kinyarwanda exchanges. */
  history: TrackedTurn[];
  /** Proficiency snapshot taken at the start of the current app session. */
  sessionStart: LevelSnapshot | null;
  /** Latest report computed from the current data. */
  report: ProficiencyReport | null;
  /** Turn ids already credited with a "repeat" notification this session. */
  repeatNotified: Set<string>;
  /** Topics already credited with a "level cleared" notification this session. */
  levelNotified: Set<string>;

  hydrate: () => Promise<void>;
  beginSession: () => void;
  recordTurn: (turn: Omit<TrackedTurn, "at">) => void;
  /** Recompute the report from current data; returns the fresh report. */
  recompute: () => ProficiencyReport;
}

const KEY = "vuga.tracking.v1";

let counter = 0;

export const useTracking = create<TrackingState>((set, get) => ({
  history: [],
  sessionStart: null,
  report: null,
  repeatNotified: new Set(),
  levelNotified: new Set(),

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      // Cap the log so it can't grow without bound over months of use.
      const list = parsed.filter(isTrackedTurn).slice(-MAX_LOG);
      set({ history: list });
    } catch {
      // Corrupt log is not fatal — proficiency falls back to kept corrections.
    }
  },

  beginSession: () => {
    const report = get().recompute();
    const topics: Record<string, number> = {};
    for (const tp of report.topics) topics[tp.topic] = tp.level;
    set({ sessionStart: { at: Date.now(), score: report.score, level: report.level, topics } });
  },

  recordTurn: (turn) => {
    counter += 1;
    // Defensive: a re-render can deliver the same turn twice; log it once.
    if (get().history.some((h) => h.turnId === turn.turnId)) return;
    const entry: TrackedTurn = { ...turn, at: Date.now() };
    const history = [...get().history, entry].slice(-MAX_LOG);
    set({ history });
    void persist(history);
  },

  recompute: () => {
    const corrections = useCorrections.getState().corrections;
    const { history } = get();
    const events: HistoryEntry[] = history.map((h) => ({
      at: h.at,
      hadMistake: h.hadMistake,
      entryId: h.entryId,
      topic: h.topic,
    }));
    const report = computeProficiency(corrections, events);
    set({ report });
    return report;
  },
}));

const MAX_LOG = 2000;

function isTrackedTurn(v: unknown): v is TrackedTurn {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.turnId === "string" && typeof r.at === "number" && typeof r.hadMistake === "boolean";
}

function persist(history: TrackedTurn[]): Promise<void> {
  return AsyncStorage.setItem(KEY, JSON.stringify(history)).catch(() => undefined);
}
