/**
 * One button press, start to end: the whole of POST /api/action except reading
 * the request and the AI switch's cookie, so a test runs the route's real code.
 *
 * Every press goes through runAction's gate and body. Two kinds of press have an
 * AI part, and both run it outside memory.update, never inside it (S20):
 *
 * - The self-check answer that ends with tips (S10): the tenant reply is worded
 *   first (S15), only after the seat and status gate passed, so a refused press
 *   never reaches the AI. runAction then plans again inside the update and keeps
 *   the wording only if it is for exactly the reply code makes there.
 * - Open job and a tick (C7b): after the press is stored, the job's live leads
 *   are worded with rank-wording (S15, cut 5 built) and each answer is kept by
 *   its replay key in one more update. The screen shows a wording only under
 *   the reason it worded, and a poll never calls the AI.
 */

import { runAction, type ActionInput, type ActionResult } from "./actions";
import { planAnswer, replyToWord } from "./self-check-flow";
import { mayPress } from "./permissions";
import { leadsForJob } from "./leads";
import { loadAndCheckPill } from "./pill";
import { tenantReply, rankWording, type AiDeps, type AiMode } from "./ai";
import * as memory from "./memory";

/** The presses after which the ranking may have changed, so the leads are worded again. */
const WORDED_AFTER = ["open-job", "tick"];

export async function actionTurn(
  input: ActionInput,
  mode: AiMode,
  deps?: AiDeps,
  realNow: Date = new Date()
): Promise<ActionResult> {
  if (input.action === "answer" && input.jobId) {
    const state = memory.read();
    const job = memory.jobById(state, input.jobId);
    if (job && mayPress(input.seat, input.action, job.status).allowed) {
      const end = replyToWord(planAnswer(state, input.jobId, input.payload));
      if (end) {
        const tenantWording = await tenantReply(end.pill, end.tips, end.codeLine, end.place, mode, deps);
        return runAction(input, realNow, { tenantWording });
      }
    }
  }

  const result = runAction(input, realNow);
  if (result.ok && input.jobId && WORDED_AFTER.includes(input.action)) {
    await wordJobLeads(input.jobId, input.seat, mode, deps, realNow);
  }
  return result;
}

/**
 * Word one job's live leads for one seat, then keep each answer by its replay
 * key and add the model calls to the memory's count, in one update. On Off
 * there is no AI at all and nothing is kept: the screen shows "AI off".
 */
export async function wordJobLeads(
  jobId: string,
  seat: string,
  mode: AiMode,
  deps?: AiDeps,
  realNow: Date = new Date()
): Promise<void> {
  if (mode === "off") return;
  const state = memory.read();
  const job = memory.jobById(state, jobId);
  if (!job) return;
  const version = state.liveVersionByBuilding[job.building] ?? "1.0";
  const pill = loadAndCheckPill("ts-cc", version);
  const leads = leadsForJob(state, job, seat, realNow).leads;
  if (leads.length === 0) return;

  const place = { seat, version, job };
  const results = await Promise.all(leads.map((lead) => rankWording(pill, lead, place, mode, deps)));
  const calls = results.reduce((sum, r) => sum + r.aiCalls, 0);

  memory.update((s) => {
    const kept = { ...(s.leadWordings ?? {}) };
    for (const r of results) {
      kept[r.key] = { aiWording: r.value.aiWording, banner: r.banner, notice: r.notice, aiCalls: r.aiCalls };
    }
    s.leadWordings = kept;
    s.aiCalls = (s.aiCalls ?? 0) + calls;
  });
}
