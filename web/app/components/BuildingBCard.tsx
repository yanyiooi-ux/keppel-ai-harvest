import { leadsForJob } from "../../lib/leads";
import { loadAndCheckPill } from "../../lib/pill";
import { safetyList, safetyCardForStop } from "../../lib/safety";
import * as memory from "../../lib/memory";

/**
 * Building B (S21). Not a seat: it is the proof that the same brain is running
 * somewhere else. It shows its own live version and ticket 2401's first three
 * live leads, ranked by the same rank.ts the technician seat uses, so a judge
 * can see one pill serving two buildings.
 *
 * No buttons except Safety for its own stops. Safety is a plain details block,
 * so it opens without any JavaScript.
 */
export function BuildingBCard() {
  const state = memory.read();
  const job = state.jobs.find((j) => j.id === "2401");
  if (!job) return null;

  const version = state.liveVersionByBuilding[job.building] ?? "1.0";
  const leads = leadsForJob(state, job, "technician").leads.slice(0, 3);
  const pill = loadAndCheckPill("ts-cc", version);
  const openHere = state.openRedStops.filter(
    (s) => s.clearedAt === null && s.building === job.building
  );

  return (
    <article className="card building-b">
      <div className="card-from">Another building, same brain</div>
      <p className="card-title">Building B, Level 12 (made up)</p>
      <p>
        Live version v{version}. Ticket {job.id}, {job.tenant}: {job.complaint},{" "}
        {job.intake.when}.
      </p>

      <ol className="lead-list">
        {leads.map((lead) => (
          <li key={lead.causeId}>
            <span className="lead-name">{lead.label}</span>
            <span className="lead-tier hud">{lead.tier.replace(/-/g, " ")}</span>
            <span className="lead-reason">{lead.reason}</span>
          </li>
        ))}
      </ol>

      <details className="safety-details">
        <summary className="safety-btn">Safety</summary>
        {openHere.length > 0 ? (
          <p className="open-stop">
            Open here now: {openHere.map((s) => s.stopId).join(", ")}
          </p>
        ) : (
          <p className="card-mean">No red stop open in Building B.</p>
        )}
        <ul className="stop-list">
          {safetyList(pill).map((stop) => {
            const card = safetyCardForStop(stop, version);
            return (
              <li key={card.id}>
                <b>{card.id}</b> {card.trigger}
              </li>
            );
          })}
        </ul>
      </details>

      <p className="receipt">
        Ranked by the same engine as the technician seat, at the demo clock. AI calls: 0
      </p>
    </article>
  );
}
