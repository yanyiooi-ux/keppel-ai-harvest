/**
 * Every test file gets its own empty replay folder (run rule 6, S15).
 *
 * ai-core.ts reads the replay folder from one setting, PILL_DESK_REPLAY_DIR.
 * Pointing it at an empty temp folder here means no test, old or new, ever reads
 * the saved answers in web/data/replay/ by accident. A test that needs a saved
 * answer writes it into its own temp folder. tests/setup.ts stays byte for byte
 * as it was, so this lives in its own setup file.
 */

import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { afterAll } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "pill-desk-replay-"));
process.env.PILL_DESK_REPLAY_DIR = dir;

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});
