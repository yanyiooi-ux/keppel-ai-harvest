# Five Keppel-style scenarios, for people new to the industry

Version 2, 2 Oct 2026. These are made-up stories, not real Keppel incidents. They show the KIND of know-how Keppel's brief is about. Version 1 was checked by three independent reviewers (a building engineer, a Keppel and Singapore fact-checker, and a newcomer). Their corrections are applied below. Sources are listed at the end. Points marked "general practice" are common industry knowledge that we have not tied to one source.

## Quick words first

- **Chiller:** a big machine that makes cold water for a building's air-con. Big buildings have several. Some buildings get cold water piped in from a shared plant instead.
- **How the cold water is used:** pipes carry it to every floor. Fans blow air over cold coils. That cools the air and pulls water out of it, like a cold can that gets wet on the outside.
- **Condenser:** the other side of the chiller, where it dumps the heat it collected. It is full of tubes.
- **Asset:** a building Keppel owns or runs, like an office tower, a warehouse or a data centre.
- **Data centre:** a building full of computers (servers) that run apps and websites for other companies. The servers make a lot of heat, so cooling must never stop. The big rooms full of servers are called data halls.
- **Tenant:** a company that rents space in the building.
- **Lease:** the rental contract. When it ends, the tenant signs again (a renewal) or moves out.
- **After-hours air-con:** air-con normally runs only in office hours. Tenants who stay late pay extra per hour to keep it on.
- **Green Mark and BCA:** Green Mark is Singapore's green building rating. It is run by the BCA (Building and Construction Authority), which also runs the required energy audits for building cooling.
- **Pill area:** one of the six topics Keppel's hackathon brief lists for an "Intelligence Pill". These are the brief's labels, not Keppel's department names.

---

## 1. The hot afternoon
**Where:** office tower. **Pill area (from Keppel's brief):** Energy Optimisation.

- **What happens:** On a hot afternoon, a tenant on a high floor facing west says it is too warm, for the third time. That side gets the afternoon sun, so it feels any problem first.
- **What the veteran knows:** First they check the floor. Nothing is broken: no stuck valve, no dirty filter. The air-con valve there is already wide open, and the air coming out is not cold enough. So the problem is the water, not the floor. Then they ask: did anyone change the cold water setting lately? Yes. Two weeks ago someone set it a little warmer to save power.
- **Why that backfires:** In Singapore the air is humid almost every day. On hot, busy afternoons, warmer water cannot pull enough wetness out of the air, so the room feels sticky and warm. Each floor opens its valve wider, more water must flow, the pumps work harder, and in many buildings an extra chiller switches on. Power use goes up, not down.
- **The fix:** Put the setting back. Only allow the warmer setting when the building is quiet and the indoor air is not sticky.
- **What a new person does:** Turns that floor's thermostat colder. The machines work even harder, and the air is still sticky.
- **What it costs:** The tenant stays hot and the power bill goes up. When the lease ends, the tenant remembers.
- **Why it is not in a manual:** The building's manual says warmer water saves energy. The catch, that pumps and wet air can eat the saving, sits in expert papers most staff never read.

## 2. The chiller that is slowly getting sick
**Where:** office tower. **Pill area:** Technical Services.

- **What happens:** No alarms are going off. Every reading on the screen looks normal.
- **What the veteran knows:** One reading, called the "condenser approach", is creeping up week by week, say from about 1 degree to 3 degrees. It shows how easily the chiller can dump its heat. A slow creep usually means the tubes on the heat-dumping side are getting dirty. The veteran compares readings from equally busy days, and rules out air leaking into the machine or a faulty sensor, which can look the same.
- **Why it matters:** A layer of scale about half a millimetre thick can make that chiller use up to about 20 percent more power. Each extra degree of approach costs a few percent. (The 20 percent is a top-end example from a cleaning-kit seller's page that quotes industry guides.)
- **The fix:** Book a cleaning on a quiet weekend. The chiller must be switched off to clean it.
- **What a new person does:** Waits for an alarm.
- **What it costs:** Wasted power for months. In the hottest week the dirty chiller may not keep up, so floors get warm.
- **Why it is not in a manual:** Most building alarms only go off when a number crosses a fixed line. A slow creep stays quiet for months. Some newer tools watch trends, but many buildings still rely on a person noticing.

## 3. The number that lies
**Where:** any building. **Pill area:** Sustainability.

- **What happens:** The building's energy audit is due. The chiller efficiency number (how much power the plant uses to make its cooling) looks great. It is better than last year, even though nothing was upgraded.
- **What the veteran knows:** Sensors slowly go wrong, like a bathroom scale that starts reading light. If one water temperature sensor is off by half a degree, the efficiency number can be about 10 percent off. So before trusting it, they do a "heat balance" check. The heat the plant pulls out of the building, plus the power it uses, should equal the heat it throws out at the cooling towers. BCA's rules ask that, over one week, at least 80 percent of readings add up to within 5 percent. They also test the main sensors against a freshly checked one.
- **What a new person does:** Reports the good-looking number straight from the sensors.
- **What it costs:** The heat check fails and the report goes back. The sensors must be fixed and a new week of data collected. Worse, the team may have made decisions from a wrong number for months.
- **What is written down, and what is not:** The rule to cross-check is written down. Knowing which sensors in YOUR building tend to go wrong, and how to spot it fast, comes from years with that building.

## 4. Cooling trouble at the data centre
**Where:** data centre. **Pill area:** Asset Operations.

- **What happens:** At 2am, only a junior engineer is on site. In one data hall, the cooling cannot keep up, and the room gets warmer every few minutes.
- **What the veteran knows:** The written emergency steps are right, and the veteran follows them too. What the veteran adds is this site's weak spots. Which backup units start on their own, and which need a hand. Which alarm points to the real cause when ten go off at once. Which valve or pump on this site tends to stick.
- **What a new person does:** Follows the written steps, but loses minutes chasing the loudest alarm, which is not the real cause.
- **What it costs:** Data centre contracts usually promise two things: power that almost never goes off, and air into the servers kept inside an agreed temperature range. If the operator misses, it pays the customer money back. (General practice.)
- **Keppel link:** Keppel's data centre arm has an AI tool called Athena, which Keppel calls a "black swan detector". (A black swan is a rare surprise that does big damage.) It listens for odd sounds and shaking in machines, to warn of rare breakdowns like cooling failures before they happen. In late 2025 it ran at one site, with more planned. Athena gives the early warning. This story is about what to do when a failure happens anyway.
- **Why it is not in a manual:** The written steps cover the general case. They do not hold every weak spot of this one site.

## 5. The tenant who is quietly planning to leave
**Where:** office tower. **Pill area:** Leasing, and Tenant Experience.

- **What happens:** A big tenant's lease ends in about 18 months. Office leases in Singapore normally run about 3 years. Big tenants start looking around early, because moving takes a long time.
- **What the veteran leasing manager knows:** They join clues from different places. The helpdesk shows three heat complaints. The air-con bookings show the tenant often pays extra to keep the air-con on after hours, often about S$40 to S$80 an hour, so they work late and the bills add up. Last year the tenant asked to give back part of their floor, so their team is shrinking.
- **The fix:** First, get the engineers to fix the heat problem. Then offer a smaller space and a better after-hours air-con deal, before a rival building calls.
- **What a new person does:** Sends the standard renewal letter with the new rent.
- **What it costs:** The tenant leaves, and the floor sits empty for months.
- **Why it is not in a manual:** The clues sit with different teams: the helpdesk, the air-con bookings and the leasing file. Only the veteran joins them up.

---

## The pattern in all five

1. **The key part is not in any manual.** The manual gives the general rule. The part that fits THIS building lives in one person's head.
2. **The new person is not stupid, just new.** They follow the obvious rule.
3. **The cost shows up later:** money, unhappy tenants, failed checks, or downtime.
4. **Some problems cross teams.** Story 5 needs helpdesk, air-con and leasing knowledge together. That is why Keppel's brief asks for AI helpers that can "coordinate across domains", which means work together when a problem touches more than one team.

This is the kind of know-how Keppel's brief asks teams to capture and reuse across a portfolio of buildings, with people in control.

---

## Sources and checks

> **To confirm before the repo goes public:** say whether these three reviewers were people or AI review passes
> playing those roles. If AI, write that here, so no judge reads "building engineer" as a real engineer's sign-off.

Checked on 2 Oct 2026 by three independent reviewers. 67 corrections were raised (16 engineer, 17 facts, 34 newcomer). All were applied except where two reviewers disagreed. In those cases we kept the engineer's version (for example, "only use warmer water when the building is quiet and the air is not sticky", instead of "only on dry days", because Singapore is humid almost every day).

- Keppel Athena, "black swan detector", one site in late 2025: https://www.keppel.com/insights/feature-stories/keppels-ai-edge-transforming-asset-management-and-operations-with-intelligence/ (read in full 2 Oct 2026)
- Heat balance, 80 percent of readings within 5 percent over one week: BCA Code on Periodic Energy Audit of Building Cooling Systems, Edition 4.0, section 4.2.9, https://isomer-user-content.by.gov.sg/338/93776aa6-d6d0-441a-a0e6-4bf64cb5106c/periodic-energy-audits-code_edition-4-0s.pdf (read 2 Oct 2026). The old link in research 02 ([S15]) is dead.
- Fouling, up to about 20 percent for about 0.6 mm: https://www.ecomaxglobal.com/the-thin-layer-of-fouling-that-quietly-raises-chiller-energy-consumption/ (read 2 Oct 2026; seller page quoting industry guides)
- Singapore humid all year (mean relative humidity about 82 to 84 percent): https://www.weather.gov.sg/climate-climate-of-singapore/ (search summary)
- Leases normally about 3 years, after-hours air-con charged by the hour at about S$40 to S$80: https://www.corporatelocations.com.sg/pdf/TenantsGuide.pdf (read 2 Oct 2026)
- Big tenants plan 18 to 24 months ahead: search summaries only (tenantcs.com, oktra.co.uk). Not confirmed from an opened page.
- Data centre contracts promising power and a temperature range: general practice. One example SLA seen in search summaries only (onecolo.com).
- Half a degree sensor error giving about 10 percent error, floor check first, warmer water backfiring: `research/02-domain-keppel.md` heuristics 3, 8 and 10.

**Found outside this file:** research 02 heuristic 4 says Green Mark for existing buildings "requires 0.65 kW/RT". The fact-checker found that 0.65 is the Platinum level for large plants in Green Mark Existing Buildings v3.0, not the minimum. Do not put that number on a slide without re-checking it.
