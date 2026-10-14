/**
 * One card in a chat (S21): colour word, title, body, receipt line.
 *
 * The colour word is always printed, so colour is never the only signal. The
 * text comes from the pill, the data and the engine; this file only arranges
 * it and never writes card wording of its own.
 */

import type { CardColour } from "../../../lib/seat-view";

export type { CardColour };

export interface ChatCardProps {
  /** The word next to the colour, for example "Do it" or "Stop". */
  colourWord?: string;
  colour?: CardColour;
  /** What the card means, in the engine's own words. */
  meaning?: string;
  from?: string;
  title?: string;
  body?: string;
  receipt?: string;
  needs?: string;
  action?: { label: string; onPress?: () => void };
  children?: React.ReactNode;
}

export function ChatCard({
  colourWord,
  colour = "none",
  meaning,
  from,
  title,
  body,
  receipt,
  needs,
  action,
  children,
}: ChatCardProps) {
  const className = colour === "none" ? "card" : `card is-${colour}`;

  return (
    <article className={className}>
      {from ? <div className="card-from">{from}</div> : null}

      {colourWord ? (
        <div className="card-statusrow">
          <span className={`badge ${colour}`}>{colourWord}</span>
          {meaning ? <span className="card-mean">{meaning}</span> : null}
        </div>
      ) : null}

      {title ? <p className="card-title">{title}</p> : null}
      {body ? <p>{body}</p> : null}
      {children}

      {needs ? (
        <div className="needs">
          Needs a yes from: <span>{needs}</span>
        </div>
      ) : null}

      {action ? (
        <button className="main-action" onClick={action.onPress}>
          {action.label}
        </button>
      ) : null}

      {receipt ? <p className="receipt">{receipt}</p> : null}
    </article>
  );
}
