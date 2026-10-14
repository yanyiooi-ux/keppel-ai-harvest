/**
 * Each vitest worker gets its own shared-memory file.
 *
 * Vitest runs test files in parallel workers that share one working directory.
 * Without this, every file would Reset the same demo out from under the
 * others. tests/setup.ts stays byte for byte as it was (run rule 6), so this
 * lives in its own setup file.
 */

process.env.PILL_DESK_STATE_FILE = `${process.cwd()}/data/state.test-${
  process.env.VITEST_WORKER_ID ?? "0"
}.json`;
