# 02 Domain research: Keppel, pill choice, heuristics, demo incident

> **Archived research (18 Sep 2026).** Written for the earlier "Pill Factory" idea. Domain facts are still useful (re-check anything in the Unverified list before it goes on a slide); the pill choice and demo incident are not decisions.

Research date: 18 Sep 2026.

## Summary

- Primary pill: Energy Optimisation for an office tower chiller plant. It scores 24 of 25. Expert rules are public, open data exists, and the numbers move on screen.
- Secondary pill: Tenant Experience, carrying the lease service terms (standard hours, after-hours cooling charge). Asset Operations is the manager's console, not a pill.
- The prior guess holds, with one warning. Keppel already runs AI on cooling plants [S4][S5]. Do not pitch "AI optimises chillers". Pitch "we capture the veteran's judgement, govern it, and reuse it".
- Demo contrast: a naive chatbot says "warmer chilled water saves energy". The veteran knows it backfires on a humid afternoon. Delta-T collapses, an extra chiller starts, and the tenant gets hot.
- Keppel's own terms: "asset manager and operator", "asset-light", "AI agents that think like experts", "digital co-workers" [S1][S9].

## Keppel context

**What it is.** Keppel calls itself a "global asset manager and operator". Funds under management were about S$95 billion at end 2025. The Real Estate Division describes a pivot to an "asset-light solutions provider" earning "Real Estate-as-a-Service" revenue [S9] (search summary). The CEO line: "the DNA of an asset manager and strong operating capabilities" [S3].

**Offices.** Keppel REIT holds 79.9% of Ocean Financial Centre, 100% of Keppel Bay Tower, and stakes in Marina Bay Financial Centre and One Raffles Quay, plus offices in Australia, Seoul and Tokyo [S8]. Keppel South Central is a new 33-storey Tanjong Pagar tower, Green Mark Platinum Super Low Energy, with micro-zoned air-con for 24/7 tenants [S3][S10].

**Other assets.** The handbook also names logistics facilities and data centres. Keppel reports a data centre "powerbank" above 1.0 GW [S9].

**Keppel Bay Tower.** Singapore's first Green Mark Platinum (Zero Energy) commercial building, 2020. Five new technologies were test-bedded with a BCA grant and energy use fell 22.3% [S5]. A digital twin linked to live BMS data found a further 7% [S6]. Reported plant efficiency: 0.577 kW/RT [S7].

**AI already announced.**
- Alpha and Duet: GenAI for deal evaluation and research. KAI: an "AI operating system" that builds "AI agents that think like experts, trained on proprietary data and subject matter expertise". Athena: a "black swan detector" for data centre cooling failures [S1].
- Operations nerve centre at Keppel Infrastructure @ Changi: machine learning watch over district cooling plants [S4].
- Sustainable Urban Renewal (SUR): "integrates people, processes and AI-driven technology" to renew older buildings [S2][S3].
- AWS collaboration on a central GenAI platform [S11].

**Why knowledge loss matters.** About 40% of resident PMETs in Singapore's Built Environment sector are 50 or older, and more than half of buildings were expected to pass 30 years old by 2025 [S12]. BCA and SIFMA name the ageing workforce as a core FM problem [S13].

**Takeaway.** KAI's public use cases are investment workflows. The gap is the plant room and the tenant desk.

## Pill choice scorecard

Scores are 1 to 5.

| Scenario | Public expert rules | Mock data | Demo drama | Crosses domains | Keppel fit | Total |
|---|---|---|---|---|---|---|
| Asset Operations | 3 | 3 | 3 | 5 | 5 | 19 |
| Energy Optimisation | 5 | 5 | 5 | 4 | 5 | 24 |
| Leasing | 2 | 2 | 2 | 3 | 4 | 13 |
| Technical Services | 5 | 4 | 4 | 3 | 4 | 20 |
| Sustainability | 3 | 4 | 2 | 4 | 5 | 18 |
| Tenant Experience | 3 | 2 | 4 | 5 | 4 | 18 |

**Primary: Energy Optimisation.** Rules are well published (ASHRAE, Green Mark, SS 591). LBNL gives labelled fault data for a three-chiller plant [S26]. kW/RT is one number a judge can watch move.

**Secondary: Tenant Experience.** Technical Services scores higher alone, but two engineering agents agreeing is not a cross-domain moment. Energy against tenant comfort is a real conflict of goals. It forces the manager to decide.

**Asset Operations** is too broad for one pill. Make it the manager's approve, reject and escalate screen.

## Expert heuristics

1. "Condenser approach creeping up means dirty tubes." Why: fouling blocks heat transfer, so the compressor works harder. A 0.6 mm layer can cost about 20% [S22]. Guardrail: never auto-stop a chiller for cleaning. Draft a work order.
2. "Low delta-T is a disease of the floors, not the chillers." Why: dirty coils, wide-open valves and wrong setpoints send water back too cold, so flow rises and extra chillers start [S18][S19]. Guardrail: never fix it by forcing chillers on.
3. "Reset chilled water warmer only when the air is dry enough." Why: each deg F warmer saves roughly 1 to 2.5% of chiller energy [S21], but warm coils stop removing moisture. Older SS 553 editions design for 24 to 26 deg C and RH up to 65% [S17]. Guardrail: lock out reset when space RH passes 65%.
4. "Know your number: 0.65 is the floor, under 0.6 is good." Why: Green Mark for existing buildings requires water-cooled plant at 0.65 kW/RT or better [S14]. Keppel Bay Tower reports 0.577 [S7]. Guardrail: never report kW/RT from an unchecked meter. **CORRECTION 2 Oct 2026 (fact-check):** 0.65 is NOT the minimum. In Green Mark Existing Buildings v3.0, 0.65 is the Platinum level for plants of 500 RT or more, and Certified is 0.75. BCA's current audit code (Edition 4.0) sets about 0.64 to 0.68 kW/RT depending on chilled water temperature. Re-check before quoting. Also: the [S15] link returned 404 on 2 Oct 2026, and the heat balance rule is confirmed in the BCA Periodic Energy Audit code Edition 4.0, section 4.2.9.
5. "Stage chillers on load and lift, never on the clock." Why: a schedule ignores weather and occupancy [S20]. Guardrail: staging logic changes need chief engineer sign-off.
6. "Variable-speed chillers like company. Fixed-speed chillers like to work hard." Why: variable-speed machines are most efficient with more units at low load [S20]. Guardrail: check the chiller type before applying either rule.
7. "Trust kW/RT only when the heat balance closes." Why: Green Mark asks for instruments within 5%, and 80% of heat balance readings within plus or minus 5% over a week [S15]. SS 591 sets the measurement practice [S16]. Guardrail: if it fails, flag the data and stop optimising.
8. "A half-degree sensor error on a five-degree delta-T is a ten percent lie." Why: load is flow times delta-T [S16]. Guardrail: never auto-recalibrate. Raise a calibration job.
9. "Reset temperature before you reset pressure." Why: Taylor's sequences rank temperature reset ahead of differential pressure reset [S20]. Guardrail: stay inside approved setpoint bands.
10. "Hot call? Walk the floor before you touch the plant." Why: most hot calls are local: a stuck valve, a failed VAV box, a clogged filter. Guardrail: never change plant setpoints for one complaint without floor data. Source: experience. Mock with LBNL AHU sets [S26].
11. "Do not overcool to buy silence." Why: Green Mark for Healthier Workplaces asks for 23 deg C and above, and SGBC's Go 25 campaign pushes 25 deg C [S17]. Guardrail: setpoints below 23 deg C need human approval.
12. "Towers only get you close to wet bulb, and wet bulb here is high." Why: colder condenser water cuts lift, but fans cost energy and chillers need minimum lift [S20]. Guardrail: never go below the maker's minimum condenser water temperature.
13. "After-hours, never run a big chiller for one floor." Why: very low load is inefficient and risks surge. Use the small chiller and group requests. Charges run roughly S$40 to S$90 per hour [S23]. Guardrail: only a confirmed booking starts plant, and billing follows the lease.
14. "Never starve the evaporator, and count the starts." Why: below minimum flow, tubes can freeze. Short cycling wears motors. Guardrail: the AI never writes to safety interlocks, minimum flow settings or anti-recycle timers. Source: experience.

## Demo incident

**Mock asset.** "Harbour Tower", 30-storey Grade A office. Three 800 RT variable-speed chillers plus one 300 RT chiller. All figures are mock.

**Trigger.** Thursday 14:40. A law firm on Level 21 (west side) logs "too warm", their third complaint in 10 days. They have also booked after-hours cooling tonight, 19:00 to 23:00.

| BMS point | 14 days ago | Now |
|---|---|---|
| Cooling load | 1,150 RT | 1,180 RT |
| Chilled water supply | 6.7 deg C | 8.5 deg C |
| Delta-T | 5.5 deg C | 3.9 deg C |
| Chilled water flow | 176 L/s | 254 L/s |
| Chillers running | 2 | 3 |
| CH-2 condenser approach | 1.2 deg C | 3.1 deg C |
| Plant efficiency | 0.58 kW/RT | 0.66 kW/RT |
| L21 space temp / RH | 24.1 deg C / 58% | 25.9 deg C / 68% |
| AHU-21 valve / supply air | 62% / 13.0 deg C | 100% / 15.8 deg C |

**Hidden cause.** Two weeks ago the reset ceiling was raised from 7.0 to 9.0 deg C "to save energy". Separately, CH-2 tubes are fouling.

**Mock lease clause.** Standard hours: weekdays 08:00 to 18:00, Saturday 08:00 to 13:00. After-hours cooling at S$65 per hour per floor. Three comfort complaints in 30 days trigger a service review.

**Naive chatbot.** "Lower the Level 21 thermostat to 22 deg C. Efficiency is poor, so raise chilled water temperature further. Start a chiller at 19:00." Wrong three ways. The coil has no capacity left. It deepens the delta-T collapse. It runs an 800 RT machine for about 60 RT.

**Correct expert answer.**
1. Energy pill checks the floor first (rule 10). Valve at 100%, warm supply air, filter fine. The coil is starved by warm water. Heat balance is 3.2%, so kW/RT is trusted (rule 7).
2. It links the facts. Warm water collapsed delta-T and flow rose 45%. Two chillers pass about 244 L/s at design, so the third started on flow, not load (rules 2, 3).
3. It recommends rolling the ceiling back to 7.0 deg C with a humidity lockout. Manager approves.
4. CH-2 approach is up 1.9 deg C. It drafts a Saturday tube cleaning work order and suggests CH-2 runs last. Manager approves (rule 1).
5. Tenant pill confirms tonight's booking. It groups Level 21 (about 60 RT) with the 24/7 floor on Level 8 (about 90 RT) on the 300 RT chiller at 50% load (rule 13). Charge: 4 hours at S$65 is S$260 plus GST.
6. Tenant pill drafts a plain reply: cause, fix, 45 minute recovery. The manager sends it.
7. The third complaint triggers the service review. Waiving the S$260 is a commercial call outside both pills. Escalate to leasing.
8. Expected by 15:30: Level 21 at 24.4 deg C and 61% RH, delta-T near 5.0, third chiller off, plant near 0.61 kW/RT. The last 0.03 returns after cleaning.
9. Governed feedback: the veteran proposes "lock out reset when outdoor dew point is above 24 deg C". It ships as pill version 1.4 after chief engineer approval.

## Public data for mocks

- Building Data Genome Project 2: 3,053 meters, 1,636 buildings, hourly, 2016 to 2017, including chilled water meters [S24]. Use for load shapes.
- ASHRAE Great Energy Predictor III on Kaggle: a subset of the same data with weather [S25].
- LBNL FDD data sets: simulated three-chiller plant serving a 12-storey building, 7 fault types plus a fault-free case, 21 CSV files, Brick schema. AHU and VAV sets also exist [S26]. Best fit.
- BCA Building Energy Benchmarking Report and data spreadsheet: real Singapore buildings with EUI [S27]. 2023 median for pure offices: 164 kWh/m2 (search summary).
- Tropical chiller plant paper: Singapore 5,000 RT plant, one-minute data. The data may not be public [S28].
- Keppel Bay Tower anchors: 145 to 115 kWh/m2 per year [S6].

## Unverified

- Read from search summaries only, not the opened page: FY 2025 figures [S9], Keppel South Central details [S10], 0.577 kW/RT [S7], 0.65 kW/RT [S14], the 5% rules [S15], fouling percentages [S22], reset savings [S21], Taylor sequences [S20], after-hours charges [S23], the 164 kWh/m2 median [S27]. Re-open before quoting on a slide.
- SS 553 was revised in 2026 and the comfort range shifted [S17]. New values not seen. SS 591 is paywalled. Only its scope was confirmed [S16].
- From engineering experience, no source: heuristics 10 and 14, the load rule in 13, wet bulb in 12, the fixed-speed half of 6.
- Every number in the demo incident is mock, including plant sizing, the S$65 rate and the lease clause. Flows were calculated from load and delta-T.
- No public source shows Keppel itself citing expert knowledge loss. The link is inferred from the handbook and BCA statistics [S12].
- Not found: a Keppel and Tencent Cloud partnership, or a GenAI programme for Keppel building operations staff.
- The handbook's Real Estate track intro mentions "banking and financial services". Confirm the intended wording with the organisers.
- Scorecard scores are judgement, not measurement.

## Sources

- [S1] https://www.keppel.com/insights/feature-stories/keppels-ai-edge-transforming-asset-management-and-operations-with-intelligence/
- [S2] https://www.keppel.com/insights/feature-stories/driving-value-through-sustainable-urban-renewal/
- [S3] https://www.keppel.com/en/what-we-do/solutions-for-sustainable-urbanisation/
- [S4] https://www.keppel.com/media/keppel-infrastructure-opens-singapores-first-positive-energy-building-under-new-green-mark-scheme-in-changi/
- [S5] https://www.keppel.com/realestate/Special-Features-Library/Keppel-Bay-Tower-a-green-building-of-the-future
- [S6] https://www.iesve.com/discoveries/view/34254/keppel-bay-tower
- [S7] https://file.go.gov.sg/gm20thbp.pdf
- [S8] https://www.keppelreit.com/property-portfolio/
- [S9] https://www.keppel.com/media/keppels-financial-results-for-fy-2025/
- [S10] https://www.keppel.com/media/keppel-south-central-completes-construction-and-welcomes-a-leading-financial-services-group-as-its-first-anchor-tenant/
- [S11] https://www.keppel.com/media/keppel-and-aws-collaborate-on-connectivity-sustainable-infrastructure-and-generative-ai-solutions-globally/
- [S12] https://www1.bca.gov.sg/resources/newsroom/speech-by-mos-tan-kiat-how-at-the-5th-facilities-management-conference-and-buildtech-asia-exhibition-2022/
- [S13] https://www1.bca.gov.sg/resources/newsroom/new-technology-roadmap-and-guide-to-smart-fm-launched-in-support-of-transformation-efforts-for-the-facilities-management-sector/
- [S14] https://policy.asiapacificenergy.org/sites/default/files/GM_Existing_Building_Certification_Standard.pdf
- [S15] https://www1.bca.gov.sg/docs/default-source/docs-corp-buildsg/sustainability/20210909_energy-technical-guide_r1.pdf
- [S16] https://www.singaporestandardseshop.sg/Product/SSPdtDetail/98bc1ad5-8f52-431c-86c2-ffaa9272b77f
- [S17] https://snowflakeaircon.sg/guides/ss553-explained and https://www.sgbc.sg/beyond-the-setpoint-go-25/
- [S18] https://www.semanticscholar.org/paper/Degrading-Chilled-Water-Plant-Delta-T-:-Causes-and-Taylor/5581aef1ff22e7273dfdda0ec3ce834c9e913bc9
- [S19] https://www.sciencedirect.com/science/article/pii/S1359431123014941
- [S20] https://www.csemag.com/understanding-chilled-water-plant-performance/
- [S21] https://buildingiq.com/blog/hvac-savings-tip-chilled-water-supply-temperature-reset/
- [S22] https://www.ecomaxglobal.com/the-thin-layer-of-fouling-that-quietly-raises-chiller-energy-consumption/
- [S23] https://www.corporatelocations.com.sg/faqs.php and https://officefinder.com.sg/resources/the-singapore-office-rental-guide-for-new-tenants-2/
- [S24] https://github.com/buds-lab/building-data-genome-project-2
- [S25] https://www.kaggle.com/c/ashrae-energy-prediction
- [S26] https://faultdetection.lbl.gov/dataset/simulated-chiller-plant/
- [S27] https://www1.bca.gov.sg/sustainability/legislation-on-environmental-sustainability-for-buildings/existing-buildings/building-energy-benchmarking-report/
- [S28] https://arxiv.org/pdf/2502.15780
