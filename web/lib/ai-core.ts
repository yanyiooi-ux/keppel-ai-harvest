/**
 * ai-core.ts: the AI layer (S15). Code decides, the AI only words.
 *
 * - The one OpenAI-compatible client for Tencent Cloud TokenHub (Hunyuan).
 * - The three AI jobs of the S15 table: rank-wording, tenant-reply and
 *   new-solution. Each has its input, its limit, its checks and its fallback,
 *   and nothing else. (The chip job is cut 1 and not built.)
 * - The order for every call: Hunyuan, then a replay with the banner
 *   "replay: saved real AI answer", then the fallback.
 *
 * Rules (S0 rules 4 and 12, S15):
 * - NO `import "server-only"` here. Scripts import this file directly with tsx;
 *   app code imports ai.ts, which is server-only plus a re-export of this file.
 * - Never loads the env file itself. Reads process.env at call time.
 * - Never NEXT_PUBLIC_.
 * - Nobody prints the key, the base URL, a header or err.message. An error shows
 *   and logs only its HTTP status and a fixed phrase.
 * - reasoning_content (hy3 thinks first) is never read, shown, stored, logged or
 *   replayed. Only content counts.
 */

import OpenAI from "openai";
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { Pill, TenantTip } from "./pill";
import { scanNeverList, tenantReplyOrTips } from "./never-list";
import { checkWording } from "./wording-check";
import { screenSuggestion, BLOCK_STEPS, PUT_FIRST_STEPS, type ScreenedSuggestion } from "./conditions";
import { AI_OFF_LABEL, AI_UNAVAILABLE, REPLAY_BANNER, type AiMode } from "./ai-mode";

export {
  AI_MODES,
  AI_MODE_COOKIE,
  AI_MODE_LABELS,
  AI_OFF_LABEL,
  AI_UNAVAILABLE,
  AI_WORDING_LABEL,
  REPLAY_BANNER,
  aiModeCookie,
  aiModeFrom,
  isAiMode,
  type AiMode,
} from "./ai-mode";

/** Max tokens for every AI call (spec S15: 600 so hy3 has room after thinking). */
export const AI_MAX_TOKENS = 600;

/** Timeout for every AI call in ms (spec S15: 8 s). */
export const AI_TIMEOUT_MS = 8000;

/**
 * Record-time limits (spec S15, record mode). `npm run ai:record` runs offline
 * before the demo, so it may wait longer and allow more tokens: on the demo's
 * longer prompts hy3 spent all 600 tokens or all 8 s thinking, and 16 of 16
 * calls gave no answer. Only the record path uses these. The live app keeps
 * AI_MAX_TOKENS and AI_TIMEOUT_MS, and on Live falls back to the saved answer.
 */
export const AI_RECORD_MAX_TOKENS = 2000;
export const AI_RECORD_TIMEOUT_MS = 30000;

// ---- The client ----

let cachedClient: OpenAI | null = null;

/**
 * Returns the one OpenAI client. Reads env at call time so tests can stub
 * process.env before importing.
 */
export function getClient(): OpenAI {
  if (cachedClient) return cachedClient;
  const baseURL = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY ?? "";
  // maxRetries 0: the SDK would otherwise quietly retry a 5xx, 429 or dropped
  // connection twice inside the 8 s window, so one AI job could send 3 requests
  // while its receipt and the memory's count say 1, and a 429 would use up 3x
  // the trial quota. One job is one request; a failure goes on to the replay.
  cachedClient = new OpenAI({ baseURL, apiKey, maxRetries: 0 });
  return cachedClient;
}

/** The model id, from LLM_MODEL (spec says Hunyuan hy3). */
export function getModel(): string {
  return process.env.LLM_MODEL ?? "";
}

/** True when the key is set (non-empty). */
export function hasKey(): boolean {
  return (process.env.LLM_API_KEY ?? "").length > 0;
}

/** Clear the cached client (for tests). */
export function _resetClient(): void {
  cachedClient = null;
}

export interface AiMessage {
  role: "system" | "user";
  content: string;
}

/** What one model call gives back: only the answer's content, never the thinking. */
export interface ModelReply {
  content: string | null;
  finish: string | null;
}

/** The one thing the AI layer needs from a model. Tests pass a fake. */
export interface ModelClient {
  complete(messages: AiMessage[], signal: AbortSignal): Promise<ModelReply>;
}

/** The part of the OpenAI client the AI layer uses: a streamed chat completion. */
export interface StreamingChat {
  chat: {
    completions: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create(body: any, options?: any): Promise<AsyncIterable<any>>;
    };
  };
}

/**
 * A model client over an OpenAI-compatible stream. hy3 streams a
 * reasoning_content part before content; only content is read. A stream that
 * ends with no content (for example finish "length" while still thinking) is
 * no answer.
 */
export function openAiModelClient(openai: StreamingChat, model: string, maxTokens: number = AI_MAX_TOKENS): ModelClient {
  return {
    async complete(messages, signal) {
      const stream = await openai.chat.completions.create(
        { model, messages, stream: true, max_tokens: maxTokens },
        { signal }
      );
      let content = "";
      let finish: string | null = null;
      for await (const chunk of stream) {
        const choice = chunk?.choices?.[0];
        const piece = choice?.delta?.content;
        if (typeof piece === "string") content += piece;
        if (typeof choice?.finish_reason === "string") finish = choice.finish_reason;
      }
      const text = content.trim();
      return { content: text.length > 0 ? text : null, finish };
    },
  };
}

/** The TokenHub client, built only when a live call is really made. */
export function defaultModelClient(): ModelClient {
  return openAiModelClient(getClient() as unknown as StreamingChat, getModel());
}

/**
 * The record path's client (`npm run ai:record` only): the same stream, asking
 * for AI_RECORD_MAX_TOKENS. The TokenHub client is built only when none is given.
 */
export function recordModelClient(openai?: StreamingChat, model?: string): ModelClient {
  return openAiModelClient(
    openai ?? (getClient() as unknown as StreamingChat),
    model ?? getModel(),
    AI_RECORD_MAX_TOKENS
  );
}

type CallResult = { ok: true; content: string | null } | { ok: false; status: number | null };

/** The HTTP status of an error, and nothing else from it. */
function statusOf(err: unknown): number | null {
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status: unknown }).status;
    if (typeof status === "number") return status;
  }
  return null;
}

/** "<status> <phrase>", or the phrase alone when there is no status. */
function unavailableLine(status: number | null, phrase: string): string {
  return status === null ? phrase : `${status} ${phrase}`;
}

/** One model call with the 8 s timeout. Never throws; an error keeps only its status. */
async function callModel(client: ModelClient, messages: AiMessage[], timeoutMs: number): Promise<CallResult> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("timeout"));
    }, timeoutMs);
  });
  try {
    const reply = await Promise.race([client.complete(messages, controller.signal), timedOut]);
    return { ok: true, content: reply.content && reply.content.trim().length > 0 ? reply.content.trim() : null };
  } catch (err) {
    return { ok: false, status: statusOf(err) };
  } finally {
    clearTimeout(timer);
  }
}

// ---- Replay: saved real AI answers ----

/** The one setting for the replay folder (run rule 6). Tests point it at an empty temp folder. */
export function replayDir(): string {
  return process.env.PILL_DESK_REPLAY_DIR ?? join(process.cwd(), "data", "replay");
}

export type AiJobName = "rank-wording" | "tenant-reply" | "new-solution";

/**
 * A replay key (S15): AI job, seat, job, pill version and a hash of the code
 * text the answer words. Any change to any part is a mismatch, and a mismatch
 * shows the fallback.
 */
export function replayKey(parts: { aiJob: AiJobName; seat: string; jobId: string; version: string; text: string }): string {
  const hash = createHash("sha256").update(parts.text, "utf8").digest("hex").slice(0, 16);
  return `${parts.aiJob}__${parts.seat}__${parts.jobId}__v${parts.version}__${hash}`;
}

export interface SavedAnswer {
  text: string;
  pass: boolean;
}

function replayPath(key: string, dir: string): string {
  return join(dir, `${key}.json`);
}

/** A saved answer, or null when there is none (or the file is not one). */
export function readReplay(key: string, dir: string = replayDir()): SavedAnswer | null {
  const path = replayPath(key, dir);
  if (!existsSync(path)) return null;
  try {
    const saved = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
    if (typeof saved.text !== "string" || typeof saved.pass !== "boolean") return null;
    return { text: saved.text, pass: saved.pass };
  } catch {
    return null;
  }
}

/** Save only the answer text and whether it passed its checks. Only ai:record calls this on web/data/replay/. */
export function saveReplay(key: string, answer: SavedAnswer, dir: string = replayDir()): string {
  mkdirSync(dir, { recursive: true });
  const path = replayPath(key, dir);
  writeFileSync(path, `${JSON.stringify({ text: answer.text, pass: answer.pass }, null, 2)}\n`, "utf-8");
  return path;
}

// ---- The one chain every job runs ----

/** One AI job: its input, its checks (accept) and its fallback. */
export interface AiJobSpec<T> {
  aiJob: AiJobName;
  key: string;
  messages: AiMessage[];
  /** The checks: the value to show, or null when the text fails. */
  accept(text: string): T | null;
  /** What shows when there is no answer that passes, or the AI is off. */
  fallback(): T;
}

export interface AiOutcome<T> {
  value: T;
  source: "live" | "replay" | "fallback" | "off";
  /** The AI answer that passed its checks, or null. */
  aiText: string | null;
  /** "replay: saved real AI answer" when the answer came from a replay. */
  banner: string | null;
  /** "<status> AI unavailable, using replay" when the live call failed. */
  notice: string | null;
  /** "AI off" when the switch is Off. */
  aiOff: string | null;
  /** Model calls made for this answer: 0 or 1. */
  aiCalls: number;
  key: string;
}

export interface AiDeps {
  /** The model. Default: the TokenHub client, built only for a real live call. */
  client?: ModelClient | null;
  /** Whether the key is set. Default: read from process.env. */
  keyPresent?: boolean;
  replayDir?: string;
  /** Where the one-line error goes. Default: console.log. */
  log?: (line: string) => void;
  timeoutMs?: number;
}

/**
 * Hunyuan, then a replay with the banner, then the fallback (S15).
 *
 * Off: no AI at all, the fallback and the "AI off" label. An empty key turns
 * Live into Replay by itself. A live call that errors or times out logs only its
 * status and "AI unavailable, using replay", then tries the replay. A live
 * answer that fails its checks, or has no content, shows the fallback. Every
 * answer, live or saved, runs its checks before it shows; a saved answer whose
 * pass flag is false never shows.
 */
export async function runAiJob<T>(spec: AiJobSpec<T>, mode: AiMode, deps: AiDeps = {}): Promise<AiOutcome<T>> {
  const base = { key: spec.key, aiText: null, banner: null, notice: null, aiOff: null, aiCalls: 0 };
  if (mode === "off") {
    return { ...base, value: spec.fallback(), source: "off", aiOff: AI_OFF_LABEL };
  }

  const keyPresent = deps.keyPresent ?? hasKey();
  const log = deps.log ?? ((line: string) => console.log(line));
  let notice: string | null = null;
  let aiCalls = 0;

  if (mode === "live" && keyPresent) {
    const client = deps.client ?? defaultModelClient();
    aiCalls = 1;
    const reply = await callModel(client, spec.messages, deps.timeoutMs ?? AI_TIMEOUT_MS);
    if (reply.ok) {
      // Hunyuan answered. Its text shows only if it passes its checks. A fail
      // shows only the code text (S14), and a reply with no content counts as
      // no answer, so the fallback shows (S15). Neither turns into a replay:
      // only an error does.
      const value = reply.content !== null ? spec.accept(reply.content) : null;
      if (value !== null) {
        return { ...base, value, source: "live", aiText: reply.content, aiCalls };
      }
      return { ...base, value: spec.fallback(), source: "fallback", aiCalls };
    }
    notice = unavailableLine(reply.status, AI_UNAVAILABLE);
    log(notice);
  }

  const saved = readReplay(spec.key, deps.replayDir ?? replayDir());
  if (saved && saved.pass) {
    const value = spec.accept(saved.text);
    if (value !== null) {
      return { ...base, value, source: "replay", aiText: saved.text, banner: REPLAY_BANNER, notice, aiCalls };
    }
  }

  return { ...base, value: spec.fallback(), source: "fallback", notice, aiCalls };
}

// ---- The prompts (web/prompts/, read at call time so judges can read them) ----

export type PromptName = AiJobName;

export function loadPrompt(name: PromptName): string {
  return readFileSync(join(process.cwd(), "prompts", `${name}.md`), "utf-8");
}

/** Where an answer is about: the seat, the job and the live pill version. */
export interface AiPlace {
  seat: string;
  version: string;
  job: { id: string; tenant: string; building: string; floor: number };
}

/**
 * The job's own tenant, building and floor, and the seat (for HQ and the senior
 * manager both buildings are their own), for the S13 checks. Never sent to the AI.
 */
function checkContext(place: AiPlace) {
  return { tenant: place.job.tenant, building: place.job.building, floor: place.job.floor, seat: place.seat };
}

function keyFor(aiJob: AiJobName, place: AiPlace, text: string): string {
  return replayKey({ aiJob, seat: place.seat, jobId: place.job.id, version: place.version, text });
}

// ---- Job 1: rank-wording (cut 5) ----

export interface LeadText {
  label: string;
  reason: string;
  checkText: string;
}

export interface RankWording {
  /** The code reason. It always stays on screen. */
  code: string;
  /** The extra "AI wording" line, or null. */
  aiWording: string | null;
}

/** Input: one lead's label, code reason and check text, and nothing else. */
export function rankWordingInput(lead: LeadText): string {
  return [`Lead: ${lead.label}`, `Code reason: ${lead.reason}`, `Check: ${lead.checkText}`].join("\n");
}

/** At most 2 sentences; S13 and S14; fallback the code reason only. */
export function rankWordingSpec(pill: Pill, lead: LeadText, place: AiPlace): AiJobSpec<RankWording> {
  const input = rankWordingInput(lead);
  const codeText = [lead.label, lead.reason, lead.checkText].join(" ");
  return {
    aiJob: "rank-wording",
    key: keyFor("rank-wording", place, input),
    messages: [
      { role: "system", content: loadPrompt("rank-wording") },
      { role: "user", content: input },
    ],
    accept(text) {
      const t = text.trim();
      if (t.length === 0) return null;
      if (scanNeverList(pill, t, checkContext(place)).violated.length > 0) return null;
      if (!checkWording(t, codeText, "rank").passes) return null;
      return { code: lead.reason, aiWording: t };
    },
    fallback: () => ({ code: lead.reason, aiWording: null }),
  };
}

export function rankWording(
  pill: Pill,
  lead: LeadText,
  place: AiPlace,
  mode: AiMode,
  deps?: AiDeps
): Promise<AiOutcome<RankWording>> {
  return runAiJob(rankWordingSpec(pill, lead, place), mode, deps);
}

// ---- Job 2: tenant-reply ----

export interface TenantReply {
  /** The code line, for example "A technician visit is booked." It always stays. */
  codeLine: string;
  /** The chosen tips, word for word from the live pill. */
  tips: string[];
  /** What the tenant reads: the AI reply when it passed, else the tips word for word. */
  lines: string[];
  aiWording: string | null;
}

/**
 * Input: only the chosen tips word for word and the code line. Never the job,
 * its cause line, its notes or any tenant's name (S13 item 10).
 */
export function tenantReplyInput(tips: TenantTip[], codeLine: string): string {
  return [
    `Code line: ${codeLine}`,
    "Approved tips, word for word:",
    ...tips.map((tip, i) => `${i + 1}. ${tip.text}`),
  ].join("\n");
}

/** At most 3 sentences; S13 with item 10 and S14; fallback the tips word for word. */
export function tenantReplySpec(pill: Pill, tips: TenantTip[], codeLine: string, place: AiPlace): AiJobSpec<TenantReply> {
  const input = tenantReplyInput(tips, codeLine);
  const tipLines = tips.map((t) => t.text);
  return {
    aiJob: "tenant-reply",
    key: keyFor("tenant-reply", place, input),
    messages: [
      { role: "system", content: loadPrompt("tenant-reply") },
      { role: "user", content: input },
    ],
    accept(text) {
      const t = text.trim();
      if (t.length === 0) return null;
      const shown = tenantReplyOrTips(pill, t, tips, checkContext(place));
      if (shown.source !== "ai") return null;
      return { codeLine, tips: tipLines, lines: [t], aiWording: t };
    },
    fallback: () => ({ codeLine, tips: tipLines, lines: tipLines, aiWording: null }),
  };
}

export function tenantReply(
  pill: Pill,
  tips: TenantTip[],
  codeLine: string,
  place: AiPlace,
  mode: AiMode,
  deps?: AiDeps
): Promise<AiOutcome<TenantReply>> {
  return runAiJob(tenantReplySpec(pill, tips, codeLine, place), mode, deps);
}

// ---- Job 3: new-solution ----

export interface NewSolution {
  /** The AI's rule text when its answer fit the menu, else the fix line word for word. */
  ruleText: string;
  ruleTextFrom: "ai" | "fix-line";
  /** What the AI suggested, screened by code: a rule from the menu, or a note "advisory, not enforced". */
  suggestion: ScreenedSuggestion | null;
  /** "ai": suggested from the code menu, to confirm part by part. "by-hand": the senior manager picks. */
  conditionFrom: "ai" | "by-hand";
}

/** Input: the fix line, the why line, and the steps the menu names, with their text read from the pill. */
export function newSolutionInput(pill: Pill, fixLine: string, whyLine: string): string {
  const steps = [...new Set([...BLOCK_STEPS, ...PUT_FIRST_STEPS])].sort((a, b) => a - b);
  const stepLines = steps
    .map((n) => pill.checklist.find((s) => s.step === n))
    .filter((s): s is NonNullable<typeof s> => s !== undefined)
    .map((s) => `${s.step}: ${s.text}`);
  return [
    `Fix line: ${fixLine}`,
    `Why line: ${whyLine}`,
    "Steps the menu may name, from the live pill:",
    ...stepLines,
  ].join("\n");
}

/** The JSON object in an answer, with or without a code fence, or null. */
function parseJsonAnswer(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * JSON { ruleText, fact, effects } or { kind: "note", text }; S13 on the text;
 * the menu check in code (a rule the menu refuses comes back as a note);
 * fallback: the fix line word for word, fact and effects picked by hand.
 */
export function newSolutionSpec(pill: Pill, fixLine: string, whyLine: string, place: AiPlace): AiJobSpec<NewSolution> {
  const fallback = (): NewSolution => ({ ruleText: fixLine, ruleTextFrom: "fix-line", suggestion: null, conditionFrom: "by-hand" });
  return {
    aiJob: "new-solution",
    // Free text is keyed by a hash of the exact text (S15).
    key: keyFor("new-solution", place, `${fixLine}\n${whyLine}`),
    messages: [
      { role: "system", content: loadPrompt("new-solution") },
      { role: "user", content: newSolutionInput(pill, fixLine, whyLine) },
    ],
    accept(text) {
      const parsed = parseJsonAnswer(text);
      if (parsed === null || typeof parsed !== "object") return null;
      const screened = screenSuggestion(parsed, pill);
      if (screened.text.trim().length === 0) return null;
      if (scanNeverList(pill, screened.text, checkContext(place)).violated.length > 0) return null;
      if (screened.kind === "rule") {
        return { ruleText: screened.text, ruleTextFrom: "ai", suggestion: screened, conditionFrom: "ai" };
      }
      return { ruleText: fixLine, ruleTextFrom: "fix-line", suggestion: screened, conditionFrom: "by-hand" };
    },
    fallback,
  };
}

export function newSolution(
  pill: Pill,
  fixLine: string,
  whyLine: string,
  place: AiPlace,
  mode: AiMode,
  deps?: AiDeps
): Promise<AiOutcome<NewSolution>> {
  return runAiJob(newSolutionSpec(pill, fixLine, whyLine, place), mode, deps);
}

// ---- Record mode (npm run ai:record) ----

export type RecordResult = "passed" | "failed-checks" | "unavailable";

/**
 * Call the model once for one job and save only the answer text and whether it
 * passed its checks. Ignores REPLAY_MODE and the switch: it always calls. An
 * error saves nothing and prints only its status and "AI unavailable". It waits
 * up to the record timeout (AI_RECORD_TIMEOUT_MS), never the live 8 s.
 */
export async function recordAnswer<T>(
  spec: AiJobSpec<T>,
  client: ModelClient,
  opts: { dir?: string; log?: (line: string) => void; timeoutMs?: number } = {}
): Promise<RecordResult> {
  const log = opts.log ?? ((line: string) => console.log(line));
  const reply = await callModel(client, spec.messages, opts.timeoutMs ?? AI_RECORD_TIMEOUT_MS);
  if (!reply.ok) {
    log(unavailableLine(reply.status, "AI unavailable"));
    return "unavailable";
  }
  if (reply.content === null) {
    log("no answer");
    return "unavailable";
  }
  const pass = spec.accept(reply.content) !== null;
  saveReplay(spec.key, { text: reply.content, pass }, opts.dir ?? replayDir());
  return pass ? "passed" : "failed-checks";
}
