import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import { CORRECTIONS, DEFAULT_TOPIC, topicFor } from "../corrections/data";

export interface CorrectionRecord {
  id: string;
  wrong: string;
  right: string;
  tip: string;
  /** Language code the user was speaking (V1: always "rw"). */
  sourceLang: string;
  /** Language code the user was translating into (V1: always "zh-CN"). */
  targetLang: string;
  createdAt: number;
  /** V3: id of the curated list entry this came from (absent on V1/V2 records). */
  entryId?: string;
  /** V3: topic/category for proficiency attribution (absent on V1/V2 records). */
  topic?: string;
}

interface CorrectionsState {
  corrections: CorrectionRecord[];
  hydrate: () => Promise<void>;
  keep: (c: Omit<CorrectionRecord, "id" | "createdAt">) => CorrectionRecord;
  remove: (id: string) => void;
  clear: () => void;
}

const KEY = "vuga.corrections.v1";

let counter = 0;

export const useCorrections = create<CorrectionsState>((set, get) => ({
  corrections: [],

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const list = parsed
        .filter(isRecord)
        // V3 backfill: default missing topic in memory only. Never rewrites the
        // persisted records, so nothing about a V1/V2 install is lost or reset.
        .map((r) => (r.topic ? r : { ...r, topic: backfillTopic(r) }))
        .sort((a, b) => b.createdAt - a.createdAt);
      set({ corrections: list });
    } catch {
      // Corrupt history is not fatal — start empty rather than crash.
    }
  },

  keep: (c) => {
    counter += 1;
    const record: CorrectionRecord = {
      ...c,
      id: `cor_${Date.now().toString(36)}_${counter.toString(36)}`,
      createdAt: Date.now(),
    };
    set((s) => ({ corrections: [record, ...s.corrections] }));
    void persist(get().corrections);
    return record;
  },

  remove: (id) => {
    set((s) => ({ corrections: s.corrections.filter((c) => c.id !== id) }));
    void persist(get().corrections);
  },

  clear: () => {
    set({ corrections: [] });
    void persist(get().corrections);
  },
}));

function isRecord(v: unknown): v is CorrectionRecord {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.wrong === "string" &&
    typeof r.right === "string" &&
    typeof r.tip === "string" &&
    typeof r.createdAt === "number"
  );
}

/** Best-effort topic for a pre-V3 record: match the curated list by entryId,
 * then by its (wrong, right) pair; otherwise the shared default. */
function backfillTopic(r: CorrectionRecord): string {
  if (r.entryId) {
    const byId = CORRECTIONS.find((e) => e.id === r.entryId);
    if (byId) return topicFor(byId);
  }
  const byPair = CORRECTIONS.find(
    (e) => e.wrong.toLowerCase() === r.wrong.toLowerCase() && e.right.toLowerCase() === r.right.toLowerCase(),
  );
  return byPair ? topicFor(byPair) : DEFAULT_TOPIC;
}

function persist(list: CorrectionRecord[]): Promise<void> {
  return AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => undefined);
}
