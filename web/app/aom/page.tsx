import { loadPill } from "@/lib/pill";
import { loadTickets, computeRepeatFlag } from "@/lib/rule-engine";
import { AomClient } from "./AomClient";

export const dynamic = "force-dynamic";

export default function AomPage() {
  const pill = loadPill("ts-cc", "1.0");
  const allTickets = loadTickets();
  const ticket2318 = allTickets.find((t) => t.id === "2318")!;
  const demoNow = new Date("2026-10-06T09:30:00+08:00");
  const repeat = computeRepeatFlag(allTickets, ticket2318, demoNow);

  // Build the decision cards from the pill rules and mock data
  const cards = [
    {
      id: "card-repeat",
      title: "Repeat comfort complaint: 5th from Level 23",
      detail: `${repeat.count} comfort complaints from ${ticket2318.tenant} on Floor ${ticket2318.floor} in 21 days. Opposite fixes on the floor (setpoint up then down). The pill has switched from quick fix to find the cause. The FM chief engineer has been called. Who pays: locked until the cause is written down.`,
      ruleIds: ["TS-CC-09", "TS-CC-24"],
      colour: "amber" as const,
      who: "FM chief engineer recommends. AOM decides on money and the tenant conversation.",
    },
    {
      id: "card-colder-floor",
      title: "Tenant asks to run the floor colder",
      detail: "Northwind Advisory's office manager asked the helpdesk to set the boardroom to 22 deg C. This is a commercial request, not a technical fix. The AOM must check the lease and the tenant handbook before any change.",
      ruleIds: ["TS-CC-25", "TS-CC-02"],
      colour: "amber" as const,
      who: "AOM within their limit, the asset manager above it.",
    },
    {
      id: "card-west-capacity",
      title: "West zone at capacity: damper fully open for hours",
      detail: "The trend shows the west boardroom VAV damper at 100% open from 2 to 5pm on 9 of 14 days. The room stays at 26 deg C. This is a likely capacity limit. The pill stopped setpoint advice and escalated to the FM chief engineer.",
      ruleIds: ["TS-CC-26"],
      colour: "red" as const,
      who: "FM chief engineer. Plant work goes to the plant team or a certified chiller technician.",
    },
    {
      id: "card-leasing",
      title: "Leasing heads-up: lease ends in 10 months",
      detail: "Northwind Advisory's lease ends in 10 months. Repeat comfort complaints are a quiet risk at renewal. The building manager should be aware. No action needed now, but the pattern costs the relationship.",
      ruleIds: ["TS-CC-23"],
      colour: "amber" as const,
      who: "Building manager. No cost or fault decision yet.",
    },
    {
      id: "card-updates",
      title: "Pill updates",
      detail: "No updates. The pill is at v1.0 (approved). No new evidence, no chief engineer correction, and the 80 percent counter has not triggered. When a correction comes in, it becomes a draft v1.1 and golden tests run before it goes live.",
      ruleIds: [],
      colour: "green" as const,
      who: "HQ pill owner signs any new version.",
    },
  ];

  return <AomClient cards={cards} rules={pill.rules} pillVersion={pill.version} />;
}
