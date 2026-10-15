import { wordLeadsAndCount } from "../../lib/ai-wording";
import { currentAiMode } from "../../lib/ai-mode-cookie";
import { loadAndCheckPill } from "../../lib/pill";
import { safetyList, safetyCardForStop } from "../../lib/safety";
import { buildingBNotices } from "../../lib/hq-desk";
import { BUILDING_B_INTRO, noticeWord, receiptWords, tierWord } from "../../lib/plain-words";
import { CodeTag, Plain } from "./Plain";
import * as memory from "../../lib/memory";
import type { MemoryState } from "../../lib/memory";

/**
 * The notices for Building B's card, the seat alertSeatFor names: the safety
 * alerts S11 routes there, and since C8b the version notices (S16 items 9 and
 * 11: a version went live everywhere, or was rolled back), only the newest of
 * those, the same list the HQ seat's Building B card shows.
 */
export function buildingBAlerts(state: MemoryState) {
  return buildingBNotices(state);
}

/**
 * Building B (S21). Not a seat: it is the proof that the same brain is running
 * somewhere else. It shows its own live version and ticket 2401's first three
 * live leads, ranked by the same rank.ts the technician seat uses, so a judge
 * can see one pill serving two buildings.
 *
 * No buttons except Safety for its own stops. Safety is a plain details block,
 * so it opens without any JavaScript.
 */
export async function BuildingBCard() {
  const state = memory.read();
  const job = state.jobs.find((j) => j.id === "2401");
  if (!job) return null;

  const version = state.liveVersionByBuilding[job.building] ?? "1.0";
  // The leads come from the engine; the AI may only add a line under each
  // code reason (S14, S15), and never changes which leads show or their order.
  // Its model calls are added to the memory's AI call count (S20).
  const worded = await wordLeadsAndCount(state, job, "technician", await currentAiMode());
  const pill = loadAndCheckPill("ts-cc", version);
  const openHere = state.openRedStops.filter(
    (s) => s.clearedAt === null && s.building === job.building
  );
  // S11: Building B has no AOM seat, so its safety alerts land on this card.
  const alerts = buildingBAlerts(state);

  // A saved AI answer under a reason counts as shown, not as a new call (D1 review).
  const savedShown = worded.items.filter(({ wording }) => Boolean(wording.banner)).length;

  return (
    <article className="card building-b">
      <div className="card-from">Another building, same brain</div>
      <p className="card-intro">{BUILDING_B_INTRO}</p>
      <p className="card-title">Building B, Level 12 (made up)</p>
      <p>
        Live version v{version}. Ticket {job.id}, {job.tenant}: {job.complaint},{" "}
        {job.intake.when}.
      </p>

      {alerts.map((alert, i) => (
        <div className="notice" key={`b-alert-${i}`}>
          <b>
            {noticeWord(alert.kind)} <CodeTag code={alert.kind} />
          </b>
          {/* A safety alert carries the stop's own words (S11): word for word, never through the plain layer. */}
          {alert.kind === "alert" ? alert.text : <Plain text={alert.text} />}
        </div>
      ))}

      <ol className="lead-list">
        {worded.items.map(({ lead, wording }) => (
          <li key={lead.causeId}>
            <span className="lead-name">{lead.label}</span>
            <span className="lead-tier">
              <span className="hud">{tierWord(lead.tier)}</span> <CodeTag code={lead.tier} />
            </span>
            <span className="lead-reason">
              <Plain text={lead.reason} />
            </span>
            {wording.value.aiWording ? (
              <span className="ai-line">
                <span className="ai-tag">AI wording</span>
                <span>
                  <Plain text={wording.value.aiWording} />
                </span>
              </span>
            ) : null}
            {wording.banner ? <span className="ai-banner">{wording.banner}</span> : null}
            {wording.notice ? <span className="ai-notice">{wording.notice}</span> : null}
          </li>
        ))}
      </ol>
      {worded.aiOff ? <span className="ai-off">{worded.aiOff}</span> : null}

      <details className="safety-details">
        <summary className="safety-btn">Safety</summary>
        {openHere.length > 0 ? (
          <p className="open-stop">
            <Plain text={`Open here now: ${openHere.map((s) => s.stopId).join(", ")}`} />
          </p>
        ) : (
          <p className="card-mean">No red stop open in Building B.</p>
        )}
        <ul className="stop-list">
          {safetyList(pill).map((stop) => {
            const card = safetyCardForStop(stop, version);
            return (
              <li key={card.id}>
                {card.trigger} <CodeTag code={card.id} />
              </li>
            );
          })}
        </ul>
      </details>

      <p className="receipt">
        {receiptWords(`Ranked by the same engine as the technician seat, at the demo clock. AI calls: ${worded.aiCalls}`, savedShown)}
      </p>
    </article>
  );
}
