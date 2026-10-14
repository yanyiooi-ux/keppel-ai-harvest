/**
 * The Neon Quest rail: how far a job has come, in the look's own shape.
 *
 * It only draws what it is handed. The step list and each step's state are
 * worked out by the engine, never here, so the rail can never claim a step is
 * done when the memory says otherwise.
 */

export type RailState = "done" | "now" | "lock";

export interface RailNode {
  name: string;
  state: RailState;
  /** The word under the node, for example "DONE" or "NEEDS YES". */
  word: string;
}

export function QuestRail({ title, nodes }: { title: string; nodes: RailNode[] }) {
  if (nodes.length === 0) return null;

  const cleared = nodes.filter((n) => n.state === "done").length;

  return (
    <section className="rail" aria-label={`${title} progress`}>
      <div className="rail-top">
        <span>{title}</span>
        <span className="xp">
          {cleared} of {nodes.length} cleared
        </span>
      </div>
      <ol>
        {nodes.map((node) => (
          <li key={node.name} className={node.state}>
            <div className="hex">
              <div className="in" />
            </div>
            <span className="nm">{node.name}</span>
            <span className="st">{node.word}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
