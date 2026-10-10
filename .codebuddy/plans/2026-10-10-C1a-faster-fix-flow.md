# Plan for C1a: Rules, decisions and design refs for the faster-fix flow

approved by YY on 10 Oct 2026. Docs and rules only, no product code.

## Context
The old tour and "ask for a yes" steps are gone. The build now follows YY's 2 Oct flow: tenant self-check, filled and ranked checklist, Solved or Not solved, senior manager, HQ, AOM. People approve only at A1 to A4. The spec is `docs/plan/BUILD-SPEC.md` (S0, S1, S2, S15, S24, T-C1a).

## Steps

### 1. Copy design refs in (never overwrite)
Targets checked: none exist yet.
- `..\design-refs\BUILD-SPEC.md` -> `docs/plan/BUILD-SPEC.md`
- `..\design-refs\how-prototype.html` -> `docs/design/how-prototype.html`
- `..\design-refs\chat-look-samples.html` -> `docs/design/chat-look-samples.html`

Verify: Get-FileHash of each source and target, they must match. Then check versions:
- First lines of `docs/plan/BUILD-SPEC.md` must say "Version 2".
- SHA-256 of BUILD-SPEC.md must equal `AB3250269ECDA2D32C24F8FF4042F86C8B3E752E24C11BF34B30A856E020C14F`.
- SHA-256 of `docs/design/how-prototype.html` must equal `0D98A4C256168E1128183175CE225138C14047F972F17521BE198D4FDB6AB898`.
If any is wrong, stop and tell YY.

### 2. Read the spec all the way
Done. "The spec" means `docs/plan/BUILD-SPEC.md` from now on.

### 3. Rewrite `.codebuddy/rules/product-rules.md` (S24)
- Add word for word: "Approvals exist only at A1, A2, A3 and A4.", "A fix counts as a win only after 30 days with no repeat at the same spot.", "The AI never ranks. It only words what code decided."
- List the 4 AI jobs from S15: rank wording, tenant replies from approved tips, the new solution's rule text, a chip for typed text. A person confirms anything that counts.
- Remove the old amber yes, Fixed, 80 percent and per-building Accept rules.
- "Below 5 cases" becomes "below 3".
- Keep the never-list and made-up data rules.

### 4. Update `.codebuddy/rules/safety-and-secrets.md` (S24)
Replace the line saying keys go in `.env` only with S0 rule 4 and S0 rule 12.

### 5. New `.codebuddy/settings.json`
Permissions deny Read and Edit of `./web/.env.local`, `./web/.env` and `./.env`.

### 6. Rewrite CODEBUDDY.md
Rewrite "Current status" and "What we are building" for Pill Desk chats and the faster-fix flow (S1, S2): the 5 seats, A1 to A4, the 4 AI jobs, the Ember look, links to `docs/plan/BUILD-SPEC.md` and the decisions file. Use the words "Pill Desk chats". Short.

### 7. New `docs/decisions/2026-10-10-faster-fix-flow.md`
The 15 items from S24 with their D numbers. Top line: "approved by YY on 10 Oct 2026, one approval for the whole list".

### 8. Run T-C1a checks
One Select-String per file, single quotes. Show the output.

## End sequence
1. In `web/`: npm test, then npm run build. Both must pass. Show real output, say pass or fail for both and the test count (38).
2. Render check: no screen changed.
3. git add, then `git grep --cached -l -E "LLM_API_KEY=[A-Za-z0-9_.-]{8,}"` must print nothing. git status: no .env.local, no state.json, nothing from proof/_inbox. Commit as "docs: rules, decisions and design refs for the faster-fix flow [C1a]".
4. Say "C1a committed, ready for /log-proof". Don't push. Stop.
