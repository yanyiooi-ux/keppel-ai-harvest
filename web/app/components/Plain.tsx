import { Fragment } from "react";
import { ruleBookWords, splitCodes } from "../../lib/plain-words";

/**
 * Plain words first, the code after (D1). A render-time layer only: the text
 * handed in is the engine's, word for word, and the code is never removed. It
 * stays on screen as a small grey tag, so a judge can still trace it.
 */

/** The small grey tag that keeps a code on screen. */
export function CodeTag({ code }: { code: string }) {
  return <span className="code-tag">{code}</span>;
}

/** A plain label followed by its code tag, for a label the screen builds itself. */
export function Coded({ word, code }: { word: string; code: string }) {
  return (
    <>
      {word} <CodeTag code={code} />
    </>
  );
}

/**
 * A sentence with each code in it shown as its plain words, then the code as a
 * grey tag. The pill's other names read as the rule book (D2 review). A
 * sentence with neither comes back as the very same text.
 */
export function Plain({ text: said }: { text?: string | null }) {
  if (!said) return null;
  const text = ruleBookWords(said);
  const parts = splitCodes(text);
  if (parts.every((p) => p.kind === "text")) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) =>
        part.kind === "text" ? (
          <Fragment key={i}>{part.text}</Fragment>
        ) : (
          <span key={i} className="plain-code">
            <span className="plain-word">{part.codeKind === "rule" ? `“${part.word}”` : part.word}</span>{" "}
            <CodeTag code={part.code} />
          </span>
        )
      )}
    </>
  );
}
