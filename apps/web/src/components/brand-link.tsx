import Link from "next/link";

/** The title lockup as a home link — same look as the world's top-left brand (FALL bold, "in" italic). */
export function BrandLink() {
  return (
    <Link href="/" className="brandLink" aria-label="FALLing in Love 홈으로">
      <span className="fall">FALL</span>ing <em>in</em> Love
    </Link>
  );
}
