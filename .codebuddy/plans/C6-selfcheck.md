---
name: C6-selfcheck
overview: "Run rule 3f for step C6: every T-C6a and T-C6b bullet, and the test that proves it."
---

# Step C6 selfcheck

Built by Claude Code (not CodeBuddy). Test names are `file > describe > it`. All of them already existed when this
selfcheck was written; it added no test.

## T-C6a

| Bullet | Proved by |
|---|---|
| No key: the replay banner, then the fallback, and the same cards | `c6a.test.ts > T-C6a: no key gives the replay banner, then the fallback, and the same cards > Building B's leads: a saved answer shows with the banner, the rest fall back, the leads never change`; `c6a.test.ts > C6a: every call goes Hunyuan, then a replay with the banner, then the fallback > an empty key turns replay on by itself: the model is never called` and `> with no deps at all, the empty test key means no call: the client is never built` |
| AI off: the same cards and ranks, the "AI off" label, tips word for word, the fix line as the rule text | `c6a.test.ts > T-C6a: AI off gives the same cards and ranks, the AI off label, the tips and the fix line > leads: same order, same reasons, no call, and the AI off label`, `> tenant reply: the tips word for word`, `> new solution: the fix line is the rule text, fact and effects picked by hand`, `> a stored worded card shows on Off as the same card with the AI off label and no AI line` |
| Red cards are never worded: with a fake client on, RS-04 and the RS-08 card keep AI calls 0 | `c6a.test.ts > T-C6a: red cards are never worded > RS-04, the RS-08 card, the TS-CC-06 refusal and the Safety list keep AI calls 0 with a fake client on` |
| A 4-sentence tenant reply fails | `c6a.test.ts > T-C6a: the tenant reply > a 4-sentence reply fails and the tips show word for word` |
| The tenant prompt's input never contains a cause line or another tenant's name | `c6a.test.ts > T-C6a: the tenant reply > the tenant prompt's input never holds a cause line or a tenant's name` |
| A fake 401 whose message holds a test secret: the output and the logs show only the status and "AI unavailable, using replay" | `c6a.test.ts > T-C6a: a fake 401 shows and logs only the status and the fixed phrase > rank wording, tenant reply and new solution: only '401 AI unavailable, using replay'` |
| A fake `new-solution` answer that blocks step 8 comes back as a note | `c6a.test.ts > T-C6a: the new solution > a fake answer that blocks step 8 comes back as a note` |
| The replay quality test exists and skips while `web/data/replay/` is empty | cut 3, not built (run rule 4) |

## T-C6b

| Bullet | Proved by |
|---|---|
| After `npm run ai:record`, `web/data/replay/` holds answers with text and pass flags only (a test searches them for "LLM_", "Authorization" and "http" and finds none) | `c6b-replay.test.ts > T-C6b: web/data/replay/ holds answers with text and pass flags only > holds saved answers`, `> no saved file holds "LLM_", "Authorization" or "http"`, `> every file is only { text, pass }, under a demo target's replay key` |
| The replay quality test runs (not skipped) and passes | cut 3, not built (run rule 4) |

Not a T-list bullet, for the record: run rule 12's tenant reply on Replay is `c6b-replay.test.ts > C6b run rule 12:
the tenant reply on Replay finds the saved real answer > not recorded: tenant-reply for 2318 ...`, an it.todo, because
the saved answer failed its checks after 3 tries (QUESTIONS.md question 3). The record-time limits are proved by
`c6b-limits.test.ts > C6b: the record path has its own limits; the live app keeps S15's > ...` (6 tests).
