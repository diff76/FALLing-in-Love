/**
 * A large spinning LP, zoomed in and cropped by its container (CSS only: grooves are a
 * repeating radial gradient, the light sheen stays still while the disc turns at 33⅓ rpm).
 * Round grooves look the same at every angle, so the turning is carried by the label
 * (site lockup) and a faint uneven shimmer pressed into the vinyl.
 * Spins only while `spinning`; reduced-motion users get a still record.
 */
export function Vinyl({ spinning = true, className = "" }: { spinning?: boolean; className?: string }) {
  return (
    <div className={`vinyl ${spinning ? "spinning" : ""} ${className}`} aria-hidden="true">
      <div className="disc">
        <i className="shimmer" />
        <div className="label">
          <span className="labelTop"><span className="fall">FALL</span>ing <em>in</em> Love</span>
          <span className="labelMid">THE ONE MORE SONG</span>
          <span className="labelBot">SIDE A · 33⅓</span>
          <i className="hole" />
        </div>
      </div>
      <div className="sheen" />
    </div>
  );
}
