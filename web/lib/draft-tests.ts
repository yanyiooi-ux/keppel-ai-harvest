/**
 * Run tests on a draft (S16 item 5).
 *
 * - checkPill: 0 errors.
 * - red stops: equal to v1.0's.
 * - every golden case in golden-cases.ts, with its appliesTo.
 * - R-01: for every open job whose facts make a rule's fact true, ranked with
 *   the draft as its live pill, the technician seat, no ticks and no open red
 *   stops, the first live lead's checkStep is that rule's put-first step.
 *   R-01 tests the rule, so it ranks with the rules only: an open red stop is a
 *   safety pause on a floor, not a rule, and neither fails nor skips R-01.
 *
 * It reports passed, failed and not applicable. A case that does not apply shows
 * "not applicable to v{version}", never passed. The run keeps the draft hash it
 * saw, so send-to-hq can check the draft has not changed since.
 */

import { isDeepStrictEqual } from "util";
import { parse } from "yaml";
import { checkPill, loadPill, type Pill } from "./pill";
import {
  GOLDEN_CASES,
  runGoldenCase,
  loadGoldenData,
  notApplicableLabel,
  type GoldenCaseResult,
  type GoldenData,
} from "./golden-cases";
import { conditionRules, factIsTrue } from "./conditions";
import { draftHash } from "./draft";
import { rankLeads } from "./rank";
import { loadCauses } from "./causes";
import { allCases } from "./cases";
import { factsFor } from "./facts";
import type { Ticket } from "./rule-engine";

export type DraftTestResult = GoldenCaseResult;

export interface DraftTestRun {
  version: string;
  /** SHA-256 of the YAML text this run saw. */
  draftHash: string;
  results: DraftTestResult[];
  passed: number;
  failed: number;
  notApplicable: number;
  /** 0 failed, and at least one check ran. */
  ok: boolean;
}

export interface DraftTestOptions {
  /** The demo clock. R-01 ranks at this time. */
  now: Date;
  /** The open jobs R-01 ranks. Defaults to the open tickets in tickets.json. */
  openJobs?: Ticket[];
  /** Every call, for the facts and the cases. Defaults to tickets.json. */
  calls?: Ticket[];
}

function passed(id: string, title: string, detail: string): DraftTestResult {
  return { id, title, status: "passed", label: "passed", detail };
}

function failed(id: string, title: string, detail: string): DraftTestResult {
  return { id, title, status: "failed", label: `failed: ${detail}`, detail };
}

function notApplicable(id: string, title: string, version: string, detail: string): DraftTestResult {
  return { id, title, status: "not-applicable", label: notApplicableLabel(version), detail };
}

function summarise(version: string, hash: string, results: DraftTestResult[]): DraftTestRun {
  const count = (s: DraftTestResult["status"]) => results.filter((r) => r.status === s).length;
  const p = count("passed");
  const f = count("failed");
  return { version, draftHash: hash, results, passed: p, failed: f, notApplicable: count("not-applicable"), ok: f === 0 && p > 0 };
}

const CHECK_PILL = "checkPill: the draft passes every structural check";
const RED_STOPS = "Red stops: the same 10 stops as v1.0, word for word";
const R01 = "R-01: the rule's put-first check ranks first on every open job it covers";

function runR01(pill: Pill, opts: DraftTestOptions, data: GoldenData): DraftTestResult {
  const rules = conditionRules(pill).filter((r) => r.condition!.effects.some((e) => e.effect === "put-first"));
  if (rules.length === 0) {
    return notApplicable("R-01", R01, pill.version, "No rule in this draft puts a check first.");
  }

  const jobs = opts.openJobs ?? data.tickets.filter((t) => t.status === "open");
  const causes = loadCauses().causes;
  const cases = allCases(data.calls);
  const ranked: string[] = [];
  const fails: string[] = [];

  for (const job of jobs) {
    const facts = factsFor(job, data.calls, data.buildings, data.places);
    const steps = rules
      .filter((r) => factIsTrue(r.condition!.fact, { facts }))
      .flatMap((r) => r.condition!.effects.filter((e) => e.effect === "put-first").map((e) => e.step));
    if (steps.length === 0) continue;

    const result = rankLeads({
      job: { ...job, facts },
      seat: "technician",
      livePill: pill,
      causes,
      allCases: cases,
      ticks: [],
      openRedStops: [],
      now: opts.now,
    });
    ranked.push(job.id);
    const first = result.leads[0];
    if (!first || !steps.includes(first.checkStep)) {
      fails.push(
        `job ${job.id} ranks ${first ? `${first.causeId} (step ${first.checkStep})` : "nothing"} first, not step ${steps.join(" or ")}`
      );
    }
  }

  if (ranked.length === 0) {
    return notApplicable("R-01", R01, pill.version, "No open job has the rule's fact.");
  }
  return fails.length === 0
    ? passed("R-01", R01, `The put-first check ranked first on jobs ${ranked.join(", ")}.`)
    : failed("R-01", R01, fails.join("; "));
}

/** Run every test on a draft's YAML text. */
export function runDraftTests(yamlText: string, opts: DraftTestOptions): DraftTestRun {
  const hash = draftHash(yamlText);

  let pill: Pill;
  try {
    pill = parse(yamlText) as Pill;
  } catch {
    return summarise("?", hash, [failed("checkPill", CHECK_PILL, "the draft is not valid YAML")]);
  }
  if (!pill || typeof pill !== "object" || typeof pill.version !== "string") {
    return summarise("?", hash, [failed("checkPill", CHECK_PILL, "the draft is not a pill")]);
  }

  const results: DraftTestResult[] = [];

  const errors = checkPill(pill);
  results.push(
    errors.length === 0
      ? passed("checkPill", CHECK_PILL, "0 errors")
      : failed("checkPill", CHECK_PILL, `${errors.length} errors: ${errors.join("; ")}`)
  );

  const v10 = loadPill(pill.pill_id || "ts-cc", "1.0");
  results.push(
    isDeepStrictEqual(pill.red_stops, v10.red_stops)
      ? passed("red-stops", RED_STOPS, "equal to v1.0")
      : failed("red-stops", RED_STOPS, "the red stops differ from v1.0's")
  );

  const loaded = loadGoldenData();
  const data: GoldenData = opts.calls ? { ...loaded, calls: opts.calls } : loaded;
  for (const c of GOLDEN_CASES) {
    results.push(runGoldenCase(c, pill, data));
  }

  try {
    results.push(runR01(pill, opts, data));
  } catch {
    results.push(failed("R-01", R01, "R-01 could not rank this draft"));
  }

  return summarise(pill.version, hash, results);
}
