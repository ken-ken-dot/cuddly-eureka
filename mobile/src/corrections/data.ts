/**
 * Single shared source of truth with the backend: ../../corrections.json at
 * the repo root. Metro bundles JSON imports natively; tsconfig resolves it
 * with resolveJsonModule.
 */
import corrections from "../../../corrections.json";

export interface CorrectionEntry {
  id: string;
  wrong: string;
  right: string;
  tip: string;
  maxDistance?: number;
  /** V3: topic/category the entry belongs to (added additively; older copies of the
   * file without it fall back to "general" via topicFor). */
  topic?: string;
}

export const CORRECTIONS = corrections as CorrectionEntry[];

export const DEFAULT_TOPIC = "general";

/** Topic for an entry, with a safe fallback for entries predating the topic field. */
export function topicFor(entry: Pick<CorrectionEntry, "topic">): string {
  return entry.topic && entry.topic.trim() ? entry.topic.trim() : DEFAULT_TOPIC;
}

/** Canonical display order for topic labels (only topics present in data appear). */
export const TOPIC_ORDER = [
  "greetings",
  "money",
  "prices",
  "buying-selling",
  "food-produce",
  "describing-things",
] as const;
