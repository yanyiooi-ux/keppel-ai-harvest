---
name: C3a
overview: "Safety stops. Part 1 of 3 of C3. Plain code with tests, no AI, no screens."
---

# C3a: Safety words, Safety list and red stop locks

## Items (from RUN-ALL C3a + spec S11, S12, T-C3a)

1. Safety list: all 10 stops loaded from red_stops in live pill at run time. Picking one gives card (trigger, action, "Call:" who_to_call), receipt "Red stop RS-xx . pill v{version} . AI calls: 0", alerts as data.
2. Typed safety words as S12: word prep (lowercase, drop apostrophes, non-letter/digit to space, split on spaces, match whole words only). Longest first. Exceptions, pairs (RS-02 breaker pair, RS-03, RS-04 two pairs). Every match in YAML order. Non-Latin letters get picker. Picker words bring up "Is this a safety problem?" (cut 4: skip picker; Q0 and red words stay).
3. Locks as S11: which open jobs a stop locks, where a stop attaches, lock line from pill not_when. Only button opens locking stop (safety-pick or Raise this stop). Typed words give card, alerts, Raise this stop button, lock nothing. RS-08 from trend data locks nothing. RS-10 locks nothing.
4. Guard test: web/app/ and web/lib/ hold none of the red stop texts or not_when lines.

## T-C3a checks
- 21 red phrases, one test each
- 11 picker phrases, tested as not red (cut 4)
- 7 calm phrases (not red, no picker)
- "smoking socket" shows RS-01 and RS-03
- Safety list: 10 entries, each equal to YAML trigger/action/who_to_call. RS-04 returns words exactly, 0 AI calls, alerts for senior manager and AOM.
- Guard: source search finds 0 hits in web/app/ and web/lib/
- Locks: stop on 2318 locks every open job on Tower A Level 23 and not 2401; RS-08 from trend data locks nothing; RS-10 locks nothing; stop from AOM Tower A attaches to Tower A Level 23
- Typed words never lock: typed red phrase returns card, alerts, Raise this stop button, 0 AI calls, no open stop; pressing Raise this stop opens stop and locks, no second alert
- Lock line: RS-04 shows TS-CC-03's not_when; RS-05 shows TS-CC-04's

## Files
- web/lib/safety.ts (new)
- web/tests/c3a.test.ts (new)
