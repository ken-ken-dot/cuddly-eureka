let counter = 0;

/** Monotonic, dependency-free id — good enough for turn identifiers within a session. */
export function makeId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}
