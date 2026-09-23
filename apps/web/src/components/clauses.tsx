import { Fragment, type ReactNode } from "react";

/**
 * Wrap-safe prose. Splits a string into sentence units and, within them, comma-clauses, each an
 * inline-block — so a line breaks at a comma or a sentence end and never inside a phrase
 * (the "…없습니 / 다." problem on narrow phones). A clause longer than the line still wraps
 * inside itself at word boundaries (word-break: keep-all keeps Korean words whole).
 * `sentences` puts every sentence on its own line.
 */
export function Clauses({ text, sentences = false }: { text: string; sentences?: boolean }): ReactNode {
  const parts = text.split(/(?<=[.!?…])\s+/).filter(Boolean);
  return parts.map((sentence, i) => {
    const clauses = sentence.split(/(?<=[,、，])\s+/).filter(Boolean);
    return (
      <Fragment key={i}>
        {i ? (sentences ? <br /> : " ") : null}
        {clauses.map((c, j) => (
          <Fragment key={j}>{j ? " " : null}<span className="clause">{c}</span></Fragment>
        ))}
      </Fragment>
    );
  });
}
