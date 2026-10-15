/**
 * One card in a chat (S21): colour word, title, body, receipt line.
 *
 * The colour word is always printed, so colour is never the only signal. The
 * text comes from the pill, the data and the engine; this file only arranges
 * it and never writes card wording of its own.
 *
 * Plain words first (D1): a code in the label, title, body, meaning or AI line
 * shows its plain words, then the code as a small grey tag. A red card keeps
 * its own words exactly as the pill has them (S11): only its label, the stop's
 * code, gets a plain name. The receipt line is the grey trace line already and
 * is left as it is.
 */

import type { CardColour } from "../../../lib/seat-view";
import { CodeTag, Plain } from "../Plain";
import { glossFor, receiptWords } from "../../../lib/plain-words";

export type { CardColour };

export interface ChatCardProps {
  /** The word next to the colour, for example "Do it" or "Stop". */
  colourWord?: string;
  colour?: CardColour;
  /** What the card means, in the engine's own words. */
  meaning?: string;
  from?: string;
  /** A code kept on screen as a grey tag after the label (D1), for example "A3" or "S-1". */
  fromCode?: string;
  /** A code kept on screen as a grey tag after the colour word (D1), for example "low-confidence". */
  colourCode?: string;
  title?: string;
  body?: string;
  receipt?: string;
  needs?: string;
  action?: { label: string; onPress?: () => void };
  children?: React.ReactNode;
  /** The extra line the AI adds under the code reason (S14). The body always stays. */
  aiWording?: string;
  /** "replay: saved real AI answer" (S15). */
  aiBanner?: string;
  /** "<status> AI unavailable, using replay" (S0 rule 12). */
  aiNotice?: string;
  /** "AI off" when the switch is Off (S15). */
  aiOff?: string;
  /** A red stop's who_to_call, shown after "Call:" (S11). */
  call?: string;
}

export function ChatCard({
  colourWord,
  colour = "none",
  meaning,
  from,
  fromCode,
  colourCode,
  title,
  body,
  receipt,
  needs,
  action,
  children,
  aiWording,
  aiBanner,
  aiNotice,
  aiOff,
  call,
}: ChatCardProps) {
  const className = colour === "none" ? "card" : `card is-${colour}`;
  // A red stop's words are the pill's, word for word (S11): never through the plain layer.
  const red = colour === "red";
  const words = (text: string) => (red ? text : <Plain text={text} />);
  // Short forms in a red stop's own words get a line that explains them; the words themselves never change.
  const gloss = red ? glossFor([title, body, call].filter(Boolean).join(" ")) : [];

  return (
    <article className={className}>
      {from || fromCode ? (
        <div className="card-from">
          {from ? <Plain text={from} /> : null}
          {fromCode ? (
            <>
              {from ? " " : null}
              <CodeTag code={fromCode} />
            </>
          ) : null}
        </div>
      ) : null}

      {colourWord ? (
        <div className="card-statusrow">
          <span className={`badge ${colour}`}>{colourWord}</span>
          {colourCode ? <CodeTag code={colourCode} /> : null}
          {meaning ? <span className="card-mean">{words(meaning)}</span> : null}
        </div>
      ) : null}

      {title ? <p className="card-title">{words(title)}</p> : null}
      {body ? <p>{words(body)}</p> : null}
      {call ? <p className="card-call">{`Call: ${call}`}</p> : null}
      {gloss.length > 0 ? (
        <p className="gloss">
          {`Short forms: ${gloss.map((g) => `${g.short} means ${g.means}`).join("; ")}.`}
        </p>
      ) : null}
      {aiWording ? (
        <p className="ai-line">
          <span className="ai-tag">AI wording</span>
          <span>
            <Plain text={aiWording} />
          </span>
        </p>
      ) : null}
      {aiBanner ? <p className="ai-banner">{aiBanner}</p> : null}
      {aiNotice ? <p className="ai-notice">{aiNotice}</p> : null}
      {aiOff ? <span className="ai-off">{aiOff}</span> : null}
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

      {/* A saved AI answer on the card: the receipt says it is shown and that no new AI call was made (D1 review). */}
      {receipt ? <p className="receipt">{receiptWords(receipt, aiBanner ? 1 : 0)}</p> : null}
    </article>
  );
}
