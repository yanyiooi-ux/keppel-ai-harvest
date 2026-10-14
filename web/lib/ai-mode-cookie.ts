/**
 * Where the AI switch stands for this request (S15): the switch's cookie if
 * someone picked, else where REPLAY_MODE says it starts. Server code only: the
 * layout, the pages and the routes read it.
 */

import "server-only";
import { cookies } from "next/headers";
import { AI_MODE_COOKIE, aiModeFrom, type AiMode } from "./ai-mode";

export async function currentAiMode(): Promise<AiMode> {
  const store = await cookies();
  return aiModeFrom(store.get(AI_MODE_COOKIE)?.value, process.env.REPLAY_MODE);
}
