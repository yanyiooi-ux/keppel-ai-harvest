---
name: C2d
overview: "Ranking in 4 steps. Part 4 of 4 of C2 [step C2 done]. Plain code, no AI, no screens."
---

# C2d: Ranking in 4 steps

## Spec
S9: rankLeads(input) in web/lib/rank.ts. Pure code, imports nothing from AI modules.
Input: job (with facts and spot), seat, live pill, causes, all cases, job's ticks, open red stops, now.
Output: { leads, ruledOut, removed, alertSeniorManager }.

## Step a: Rules first (remove causes)
For each cause in file order:
1. Symptoms don't include job direction: removed "Does not explain too cold/hot."
2. Red cause: removed "Red: out of scope. {fixRoute}."
3. Seat not in checkSeats: removed "This check is the senior manager's."
4. canNudge not allowed for setpoint: removed "Removed by TS-CC-09: {first sentence}"
5. tenantItem + fit-out-12m: lead stays, fixAllowedHere false, fix line changes to "Covered by tenant's fit-out contract"

## Step b: Match facts
For each lead: similar cases with same cause. W=won, F=failed, N=W+F, P=pending/unconfirmed.
Score = sum(won weights) - sum(failed weights).

## Step c: Order (tiers, highest first)
- found: ticked Found it
- signed-rule: pill rule with put-first effect on checkStep
- case-backed: N>=3 and score>0
- low-confidence: N<3
- net-failed: N>=3 and score<=0
Close groups: sort by score high first, group = leads within 2 of top score, order by checkMinutes then score then file order.

## Step d: Show why (code reasons, never AI)

## T-C2d checks
- 2318 technician v1.0 no ticks: precool, min-airflow, thermostat-spot
- 2318 removed: setpoint (TS-CC-09), sun-west, capacity, rebalance
- 2318 reasons exactly as S9
- After Not this on precool: min-airflow first
- After Not this on both: thermostat-spot first, alertSeniorManager true
- clear on min-airflow: brings it back first
- 2401: precool, min-airflow, thermostat-spot, setpoint (net-failed, score -3)
- Senior manager 2318 with 2 ticks: thermostat-spot, rebalance; rebalance fixAllowedHere false
- 2315: capacity removed "Red: out of scope"
- rank.ts imports nothing from ai.ts or ai-core.ts
- Same input twice: deep-equal output

## Files
- web/lib/rank.ts (new)
- web/tests/c2d.test.ts (new)
