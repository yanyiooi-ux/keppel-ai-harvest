/**
 * Decide charge (A4, S17, cut 9, C9): the AOM's only press besides Safety.
 *
 * runAction's gate has already checked the seat (only the AOM). The refusal
 * reads the memory and never writes; the press runs inside memory.update and
 * checks again on the memory it is given.
 *
 * The AOM picks Tenant pays (a whole-number amount from 1 to 100000, typed in
 * a number field), Landlord pays or Goodwill, no charge, each with a reason
 * of 3 words or more. Then code, not the AI, posts the tenant's card, word for
 * word as S17 writes it. Nothing here calls the AI, and the amount is stored
 * only on the request, which no AI prompt reads: the AI never writes, suggests
 * or sees an amount.
 */

import { wordCount } from "./draft";
import { hideAmounts } from "./never-list";
import { sgStamp, TENANT_HOME, type ChargeRequest, type ChargeDecision } from "./self-check-flow";
import * as memory from "./memory";
import type { MemoryState } from "./memory";

export type ChargeChoice = ChargeDecision["choice"];

/** S17's three choices, in its order. */
export const CHARGE_CHOICES: { id: ChargeChoice; label: string }[] = [
  { id: "tenant-pays", label: "Tenant pays" },
  { id: "landlord-pays", label: "Landlord pays" },
  { id: "goodwill", label: "Goodwill, no charge" },
];

export const AMOUNT_MIN = 1;
export const AMOUNT_MAX = 100000;

export const PICK_WHO = "Pick who pays: Tenant pays, Landlord pays, or Goodwill, no charge.";
export const AMOUNT_NEEDED = `Tenant pays needs a whole-number amount from ${AMOUNT_MIN} to ${AMOUNT_MAX}, typed in the number field.`;
export const REASON_NEEDED = "Decide charge needs a reason of 3 words or more.";
export const AMOUNT_IN_REASON = "Leave the amount out of the reason: it goes only in the number field.";

export interface FlowResult {
  ok: boolean;
  message: string;
  jobId?: string;
}

// ---- Words ----

export function choiceLabel(choice: ChargeChoice): string {
  return CHARGE_CHOICES.find((c) => c.id === choice)!.label;
}

/** S17's cost words: "S$350, made-up demo amount" for Tenant pays, else "no charge to you". */
export function costWords(choice: ChargeChoice, amount?: number): string {
  return choice === "tenant-pays" ? `S$${amount}, made-up demo amount` : "no charge to you";
}

/** S17's tenant card, word for word. Code only. */
export function tenantChargeText(tenantSolution: string, choice: ChargeChoice, amount?: number): string {
  return `What we will do: ${tenantSolution} Cost: ${costWords(choice, amount)}. Approved by the AOM (role-played).`;
}

/**
 * What the tenant hears the work is. HQ's Approve stores the cause's
 * tenantSolution on the request (S16 item 9). The after-hours request (S10)
 * has none in the spec, so it uses the request's own words for now
 * (QUESTIONS.md question 10).
 */
export function whatWeWillDo(request: ChargeRequest): string {
  return request.tenantSolution ?? `${request.text}.`;
}

// ---- Reading the requests ----

/** Every A4 request in the memory, oldest first. */
export function chargeRequests(state: MemoryState): ChargeRequest[] {
  return (state.requests as ChargeRequest[]).filter((r) => r && r.kind === "A4");
}

const noneCalled = (id: string) => `There is no open charge request called "${id}" (A4).`;
const noneOnJob = (jobId: string) => `There is no open charge request on job ${jobId} (A4).`;
const alreadyDecided = (id: string) => `Charge request ${id} is already decided (A4).`;

/** The request a press is about: by its id, else the job's newest open one. */
function requestFor(
  state: MemoryState,
  jobId: string | undefined,
  payload: Record<string, unknown> | undefined
): { request: ChargeRequest } | { refusal: string } {
  const all = chargeRequests(state);
  const id = typeof payload?.requestId === "string" ? payload.requestId : undefined;
  if (id !== undefined) {
    const request = all.find((r) => r.id === id);
    if (!request) return { refusal: noneCalled(id) };
    if (jobId !== undefined && request.jobId !== jobId) return { refusal: noneOnJob(jobId) };
    if (request.status !== "open") return { refusal: alreadyDecided(request.id) };
    return { request };
  }
  if (jobId === undefined) return { refusal: "Pick a charge request first." };
  const open = all.filter((r) => r.jobId === jobId && r.status === "open");
  if (open.length === 0) return { refusal: noneOnJob(jobId) };
  return { request: open[open.length - 1] };
}

function choiceOf(value: unknown): ChargeChoice | null {
  return CHARGE_CHOICES.some((c) => c.id === value) ? (value as ChargeChoice) : null;
}

/** A whole number from 1 to 100000, as a number: the number field's value. */
function amountOf(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value >= AMOUNT_MIN && value <= AMOUNT_MAX ? value : null;
}

function oneLine(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

// ---- decide-charge ----

/** Why Decide charge is refused, or null. Reads only. */
export function decideChargeRefusal(
  state: MemoryState,
  jobId: string | undefined,
  payload: Record<string, unknown> | undefined
): string | null {
  const found = requestFor(state, jobId, payload);
  if ("refusal" in found) return found.refusal;
  const choice = choiceOf(payload?.choice);
  if (!choice) return PICK_WHO;
  if (choice === "tenant-pays" && amountOf(payload?.amount) === null) return AMOUNT_NEEDED;
  const reason = oneLine(payload?.reason);
  if (wordCount(reason) < 3) return REASON_NEEDED;
  if (hideAmounts(reason) !== reason) return AMOUNT_IN_REASON;
  return null;
}

/**
 * Decide charge (S17). The request is decided once, with the choice, the
 * amount (Tenant pays only), the reason, who and when; then code posts the
 * tenant's card in the tenant chat. Call it inside memory.update.
 */
export function applyDecideCharge(
  state: MemoryState,
  seat: string,
  jobId: string | undefined,
  payload: Record<string, unknown> | undefined,
  realNow: Date
): FlowResult {
  const refusal = decideChargeRefusal(state, jobId, payload);
  if (refusal) return { ok: false, message: refusal };
  const found = requestFor(state, jobId, payload) as { request: ChargeRequest };
  const request = found.request;

  const choice = choiceOf(payload!.choice)!;
  const amount = choice === "tenant-pays" ? amountOf(payload!.amount)! : undefined;
  const at = sgStamp(memory.now(state, realNow));
  const card = tenantChargeText(whatWeWillDo(request), choice, amount);

  const decision: ChargeDecision = {
    choice,
    ...(amount !== undefined ? { amount } : {}),
    reason: oneLine(payload!.reason),
    decidedBy: seat,
    decidedAt: at,
    tenantCard: card,
  };
  request.status = "decided";
  request.decision = decision;

  // The tenant seat is Tower A Level 23's tenant (S2): only its own request reaches it (S13 item 4).
  const toTenant = request.building === TENANT_HOME.building && request.floor === TENANT_HOME.floor;
  if (toTenant) {
    state.messages.push({
      seat: "tenant",
      from: "pip",
      text: card,
      at,
      cards: [{ kind: "charge-decision", body: card, jobId: request.jobId, receipt: `Charge decision (A4) · AI calls: 0` }],
    });
  }

  return {
    ok: true,
    message: `Charge decided: ${choiceLabel(choice)}.${toTenant ? " The tenant's card is in the tenant chat." : ""}`,
    jobId: request.jobId,
  };
}
