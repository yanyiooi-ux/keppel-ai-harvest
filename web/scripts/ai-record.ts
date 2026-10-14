/**
 * ai-record.ts: call Hunyuan for the demo's AI jobs and save each answer in
 * web/data/replay/ (S15 record mode). `npm run ai:record`, or with one job:
 * `npm run ai:record -- rank`, `-- tenant` or `-- solution`.
 *
 * Rules (spec S15, S0 rules 4 and 12, run rule 12):
 * - Imports ai-core.ts, never ai.ts (server-only throws outside Next).
 * - Loads web/.env.local itself with loadEnvConfig from @next/env, passing a
 *   no-op logger so it never prints the file path.
 * - Ignores the replay setting: with a key it always calls the model.
 * - Saves only the answer text and whether it passed its checks. Never the key,
 *   the headers or the request.
 * - Records only what is missing, or saved with its pass flag false.
 * - Prints only fixed phrases, an HTTP status, the model id and counts. Never
 *   the key, the base URL, a header, a file path or anything from an error.
 */

import { loadEnvConfig } from "@next/env";
import { defaultModelClient, getModel, hasKey, _resetClient } from "../lib/ai-core";
import { demoRecordTargets, recordMissing } from "../lib/ai-demo-targets";

// Load the env file with a no-op logger so the file path is never printed.
loadEnvConfig(process.cwd(), false, { info() {}, error() {} });

// The client may have been cached before env loaded; clear it.
_resetClient();

/** The demo solution, from the role-played senior manager (S16). */
const DEMO_FIX_LINE =
  "If the zone had a fit-out in the last 12 months, check where the thermostat sits against the fit-out drawing before any nudge.";
const DEMO_WHY_LINE =
  "The fit-out 8 months ago moved the core thermostat next to the new printer bay, so it reads warm and the box keeps cooling the open area.";

const JOBS = ["rank", "tenant", "solution"] as const;
type Job = (typeof JOBS)[number];

async function main() {
  const arg = process.argv[2];
  if (arg !== undefined && !(JOBS as readonly string[]).includes(arg)) {
    console.log("usage: npm run ai:record, or add one of: rank, tenant, solution");
    return;
  }

  if (!hasKey()) {
    console.log("key: empty");
    return;
  }

  const model = getModel();
  if (!model) {
    console.log("model: empty (LLM_MODEL is not set)");
    return;
  }

  console.log(`model: ${model}`);
  const targets = demoRecordTargets({ fixLine: DEMO_FIX_LINE, whyLine: DEMO_WHY_LINE }, arg as Job | undefined);
  console.log(`answers to check: ${targets.length}`);

  const counts = await recordMissing(targets, defaultModelClient());
  console.log(
    `recorded: ${counts.passed} passed checks, ${counts.failed} failed checks, ${counts.unavailable} unavailable, ${counts.skipped} already saved`
  );
}

main().then(() => process.exit(0));
