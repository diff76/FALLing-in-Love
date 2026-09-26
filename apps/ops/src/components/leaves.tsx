const LEAF = "M12 2C7 4 3 9 3 15c0 3 2 6 5 7 4-2 9-5 12-11C18 6 15 3 12 2z";

/**
 * Seven falling leaves behind the ops screens — the same motif as the public site, kept light:
 * transform/opacity-only keyframes, no blur, fixed layer, hidden for reduced motion.
 */
export function Leaves() {
  return (
    <div className="opsLeaves" aria-hidden="true">
      {Array.from({ length: 7 }, (_, i) => <svg key={i} viewBox="0 0 24 24" className={`l${i}`}><path d={LEAF} /></svg>)}
    </div>
  );
}
