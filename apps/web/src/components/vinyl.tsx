/**
 * A large spinning LP, zoomed in and cropped by its container (CSS only: grooves are a
 * repeating radial gradient, the light sheen stays still while the disc turns at 33⅓ rpm).
 * Spins only while `spinning`; reduced-motion users get a still record.
 */
export function Vinyl({ spinning = true, className = "" }: { spinning?: boolean; className?: string }) {
  return (
    <div className={`vinyl ${spinning ? "spinning" : ""} ${className}`} aria-hidden="true">
      <div className="disc">
        <div className="label">
          <span className="labelTop">FALLing in Love</span>
          <span className="labelMid">THE ONE MORE SONG</span>
          <span className="labelBot">SIDE A · 33⅓</span>
          <i className="hole" />
        </div>
      </div>
      <div className="sheen" />
    </div>
  );
}
