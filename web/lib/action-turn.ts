/**
 * One button press, start to end: the whole of POST /api/action except reading
 * the request and the AI switch's cookie, so a test runs the route's real code.
 *
 * Every press goes through runAction's gate and body. The one press with an AI
 * part is the self-check answer that ends with tips (S10): the tenant reply is
 * worded first (S15), outside memory.update and never inside it (S20), and only
 * after the seat and status gate passed, so a refused press never reaches the
 * AI. runAction then plans again inside the update and keeps the wording only
 * if it is for exactly the reply code makes there.
 */

import { runAction, type ActionInput, type ActionResult } from "./actions";
import { planAnswer, replyToWord } from "./self-check-flow";
import { mayPress } from "./permissions";
import { tenantReply, type AiDeps, type AiMode } from "./ai";
import * as memory from "./memory";

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
  return runAction(input, realNow);
}
