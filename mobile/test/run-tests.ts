/**
 * Minimal test entry for `npm test` in the mobile workspace. The project has no
 * bundler-based test setup, so this runs each test file through node with tsx
 * as the on-the-fly TS loader (tsx is already in the monorepo).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const testFiles = ["proficiency.test.ts", "insights.test.ts", "directions.test.ts"];

let failed = false;
for (const file of testFiles) {
  const res = spawnSync(process.execPath, ["--import", "tsx", `test/${file}`], {
    stdio: "inherit",
    cwd: fileURLToPath(new URL("..", import.meta.url)),
  });
  if (res.status !== 0) failed = true;
}
if (failed) process.exit(1);
