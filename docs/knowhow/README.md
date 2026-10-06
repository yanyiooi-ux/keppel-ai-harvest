# Know-how pack

What the pill TS-CC (repeat comfort complaints on an office floor) is built from. Made 5 Oct 2026.

**No real expert has been interviewed.** Everything here comes from public sources and practitioner writing, each one
opened and checked, plus the team's own decisions (labelled).

| File | What it is |
|---|---|
| [`pill-v0-source-pack.md`](pill-v0-source-pack.md) | 26 rules, the 31-step checklist in order, 8 hands-off tenant tips, 10 red stops, newcomer versus veteran pairs, 20 golden tests, what only a real chief engineer can settle, a glossary, and the rule reserved for the v1.1 demo correction. |
| [`pill-v0-source-pack.json`](pill-v0-source-pack.json) | The same pack, machine-readable. Prompt P3 builds `web/pills/ts-cc/v1.0.yaml` from it. |
| [`sources.md`](sources.md) | All 144 research items with their source links. 88 held as written, 56 were narrowed to what the page really says, 0 were dropped. |
| [`interview-guide.md`](interview-guide.md) | A 25-minute guide (11 questions) for interviewing anyone who has worked with office air-con. |
| [`composed-interview.md`](composed-interview.md) | A transcript composed only from the pack's rules, for the capture demo (P11). **It is not a real interview** and says so at the top. |

## How it was made
1. 8 research agents, one angle each: air-side faults, fit-outs, sun and the building edge, BMS trends, Singapore rules,
   complaint handling, practitioner know-how, safety.
2. A second agent opened every cited page and confirmed, narrowed or rejected each claim.
3. A critic thinking like a Singapore chief engineer reviewed the draft. All 9 of its "unsafe or wrong" points were
   fixed (for example: look at a suspect heater, never touch it; isolate and lock off before controller work; follow
   the building's own fire plan).
4. A strict checker tested the revision against the sources and the approved decisions, and a fixer closed its 9
   medium and high findings.

## Known small gaps (low severity, left open on purpose)
- Some "because" lines slightly overstate a source (for example a single occupant's comment, or "under-counted" where
  the page says "often different"). `sources.md` holds the exact narrowed wording.
- A few glossary entries (for example "clo") have no research id.
- The override check sits under "remote check" where the decisions list it under "context". The order still holds.
- The v1.1 rule has no golden test yet. Prompt P10 adds it.
- Every comfort number from the 1996 NEA guideline must be checked against the current SS 554 before it goes on a
  slide. The app never quotes comfort ranges to tenants.

If a real interview happens, its transcript replaces `composed-interview.md`, and the rules it supports are marked as
coming from a real interview.
