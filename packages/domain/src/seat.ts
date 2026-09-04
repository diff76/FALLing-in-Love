/**
 * Seat allocation boundary. The authoritative implementation is the `assign_seat`
 * SQL function (runs inside the reservation transaction). This TypeScript mirror
 * exists so the rule is testable and previewable, and so the algorithm can be
 * swapped without touching reservation creation.
 */
export type SeatCursors = Record<string, number>;
export type SeatAssignment = { block: string; from: number; to: number; label: string };

export function seatLabel(block: string, from: number, to: number): string {
  return `채플 ${block}블록 ${from}${to > from ? `–${to}` : ""}`;
}

/** Fill the block with the lowest cursor first, so blocks stay balanced. */
export function assignSeat(partySize: number, cursors: SeatCursors): { assignment: SeatAssignment; cursors: SeatCursors } {
  const blocks = Object.keys(cursors).sort();
  if (!blocks.length) throw new Error("no seat blocks configured");
  const block = blocks.reduce((best, b) => (cursors[b] < cursors[best] ? b : best), blocks[0]);
  const from = cursors[block];
  const to = from + partySize - 1;
  return { assignment: { block, from, to, label: seatLabel(block, from, to) }, cursors: { ...cursors, [block]: to + 1 } };
}
