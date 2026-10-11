---
name: C2b
overview: "Place tags, facts, repeat and speak first. Part 2 of 4 of C2. Plain code, no AI, no screens. Places.json, placeTag, spotKey, allCalls, factsFor, speakFirstFor."
---

# C2b: Place tags, facts, repeat and speak first

## Items (from RUN-ALL C2b + spec S5, S6, T-C2b)

1. **places.json**: New file web/data/places.json exactly as S5, labelled "made up for the demo". placeTag(job) returns {building, floor, zone, equipment}. spotKey(job) is "<building>/<floor>". allCalls(state) is every ticket in tickets.json plus every runtime job in Ticket shape with fix: null.
2. **facts.ts**: factsFor(job, allCalls, buildings, places) returns fact ids in S5 fixed order. Clock rule: job's report time + 20 min as asOfDate, never real clock, never demo clock. Expected: 2318 gives cold-mornings, core-zone, repeat, opposite-fixes, fit-out-12m, vav. 2401 gives cold-mornings, core-zone, fit-out-12m, vav. 2305 gives hot-afternoons, west-zone, repeat, opposite-fixes, fit-out-12m, vav. 2301 gives cold-mornings, core-zone, fit-out-12m, vav.
3. **computeRepeatFlag**: reuse existing, called with allCalls. No change to its body. git diff shows no change inside it.
4. **speakFirstFor**: returns {fire, count, opposite, spotKey} from repeat flag. Notice text exactly as S6. Never twice for same spot in 30 days. Pure part only: which notices to post given jobs and notices already there.
5. After Reset test moves to C4. Here, test the pure part.

## T-C2b checks
- factsFor gives exactly the 4 lists for 2318, 2401, 2305, 2301
- placeTag(2318) is { building: "tower-a", floor: 23, zone: "core", equipment: "VAV-23-C1" }
- 2301 alone: count 1, speakFirstFor fire false
- 2305: count 2, opposite fixes true, fire true
- 2318: count 5, fire true. 2401: fire false
- After Reset: moves to C4
- git diff rule-engine.ts: no change inside computeRepeatFlag

## Files
- web/data/places.json (new)
- web/lib/places.ts (new: placeTag, spotKey, allCalls)
- web/lib/facts.ts (new: factsFor)
- web/lib/speak-first.ts (new: speakFirstFor, notice text)
- web/tests/c2b.test.ts (new: all T-C2b tests)
