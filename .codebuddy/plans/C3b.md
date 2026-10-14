---
name: C3b
overview: "Never-list scanner and wording checks. Part 2 of 3 of C3. Plain code, no screens."
---

# C3b: Never-list scanner, tenant text and wording checks

## Items (S13, S14, T-C3b)
1. never-list.ts: scanner S13 items 1-6, replaces checkNeverList, returns pill never_list ids
2. Rewrite GT-05 and GT-17 never-list lines (checkRedStop lines stay byte for byte)
3. 7 must-pass phrases pass
4. TS-CC-06 refusal card (RS-10) for typed hit, 0 AI calls, pointer line
5. hideAmounts: every amount becomes "[amount hidden]"
6. Extra blocks on AI tenant text: at most 3 sentences, checked against job's own tenant/building/floor
7. wording-check.ts: every rule in S14
