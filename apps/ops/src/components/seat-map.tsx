"use client";

import type { SeatMapCell } from "@fil/supabase";

/**
 * The chapel chart, drawn like a cinema seat picker. Grey = taken by another party,
 * gold = this party's proposed / chosen seats, outlined = wheelchair bay. Tapping a free
 * seat (or one of ours) toggles it; `max` caps the selection to the arrived head-count.
 */
export function SeatMap({ cells, selected, ownReservationId, max, onToggle, compact }: {
  cells: SeatMapCell[]; selected: Set<string>; ownReservationId?: string | null; max: number;
  onToggle?: (id: string) => void; compact?: boolean;
}) {
  const byFloor = (floor: 1 | 2) => {
    const rows = new Map<string, SeatMapCell[]>();
    cells.filter((c) => c.floor === floor).forEach((c) => (rows.get(c.row) ?? rows.set(c.row, []).get(c.row)!).push(c));
    return [...rows.entries()].sort((a, b) => a[1][0].rowIndex - b[1][0].rowIndex);
  };
  const blocksOf = (floor: 1 | 2) => (floor === 1 ? [1, 2, 3, 4] : [1, 2, 3]);
  const cols = (floor: 1 | 2) => (floor === 1 ? 6 : 10);
  const first = (floor: 1 | 2, b: number) => (b - 1) * cols(floor) + 1;

  const cell = (c: SeatMapCell) => {
    const mine = !!ownReservationId && c.reservation_id === ownReservationId;
    const taken = !!c.reservation_id && !mine;
    const on = selected.has(c.id);
    const cls = ["seat", c.wheelchair ? "wc" : "", taken ? "taken" : "", on ? "on" : "", mine && !on ? "mine" : ""].filter(Boolean).join(" ");
    const title = taken ? `${c.name ?? ""} ${c.code ?? ""}`.trim() : c.wheelchair ? "휠체어석" : c.id;
    return (
      <button type="button" key={c.id} className={cls} title={title} aria-pressed={on}
        disabled={taken || (!on && selected.size >= max && !onToggle) || !onToggle}
        onClick={() => onToggle?.(c.id)}>
        {c.wheelchair ? "♿" : c.num}
      </button>
    );
  };

  const floorView = (floor: 1 | 2) => (
    <div className="floor" key={floor}>
      <h4>{floor}층</h4>
      {byFloor(floor).map(([row, list]) => (
        <div className="row" key={row}>
          <span className="rowLabel">{row}</span>
          {blocksOf(floor).map((b) => {
            const inBlock = list.filter((c) => c.block === b).sort((x, y) => x.num - y.num);
            const slots: (SeatMapCell | null)[] = [];
            if (floor === 1 && row === "1" && b === 4) {
              inBlock.forEach((c) => slots.push(c));
              while (slots.length < cols(floor)) slots.push(null);
            } else {
              for (let n = first(floor, b); n < first(floor, b) + cols(floor); n++) slots.push(inBlock.find((c) => c.num === n) ?? null);
            }
            return <div className="block" key={b}>{slots.map((c, i) => c ? cell(c) : <i key={`gap-${i}`} className="gap" />)}</div>;
          })}
        </div>
      ))}
    </div>
  );

  return (
    <div className={`seatMap ${compact ? "compact" : ""}`}>
      <div className="stage">무대 · STAGE</div>
      <div className="seatScroll">
        {floorView(1)}
        {floorView(2)}
      </div>
      <div className="legend"><i className="seat" /> 빈자리 <i className="seat on" /> 이 팀 <i className="seat taken" /> 배정됨 <i className="seat wc" /> 휠체어석</div>
    </div>
  );
}
