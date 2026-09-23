/**
 * Chapel seating (from the posted seat chart, 2026-09-24).
 *
 *  1F rows 1–14, four blocks: 1–6 | 7–12 | 13–18 | 19–24.
 *     Row 1's right block is two wheelchair bays instead of seats 19–24.
 *     Row 14 has only the two outer blocks (1–6 and 19–24).
 *  2F rows c1–c7, three blocks: 1–10 | 11–20 | 21–30.
 *     c4, c5 run 3–28; c6 runs 2–29; c1–c3 and c7 are full.
 *
 * Seats are NOT assigned at reservation time any more — only at check-in, so no-shows
 * never hold seats. `suggestSeats` is the auto-allocation staff can override by hand.
 */
export type Seat = {
  id: string;            // "3-14" (1F row 3 seat 14) · "c2-11" (2F) · "1-W1" (wheelchair bay)
  floor: 1 | 2;
  row: string;           // "3" | "c2"
  rowIndex: number;      // 1-based within the floor
  num: number;           // seat number within the row (wheelchair bays: 0)
  block: number;         // 1F: 1..4 · 2F: 1..3
  wheelchair: boolean;
};

export function buildSeatLayout(): Seat[] {
  const seats: Seat[] = [];
  for (let r = 1; r <= 14; r++) {
    for (let n = 1; n <= 24; n++) {
      const block = Math.floor((n - 1) / 6) + 1;
      if (r === 14 && (block === 2 || block === 3)) continue;
      if (r === 1 && block === 4) continue;
      seats.push({ id: `${r}-${n}`, floor: 1, row: String(r), rowIndex: r, num: n, block, wheelchair: false });
    }
    if (r === 1) {
      seats.push({ id: "1-W1", floor: 1, row: "1", rowIndex: 1, num: 0, block: 4, wheelchair: true });
      seats.push({ id: "1-W2", floor: 1, row: "1", rowIndex: 1, num: 0, block: 4, wheelchair: true });
    }
  }
  const ranges: Record<number, [number, number]> = { 1: [1, 30], 2: [1, 30], 3: [1, 30], 4: [3, 28], 5: [3, 28], 6: [2, 29], 7: [1, 30] };
  for (let r = 1; r <= 7; r++) {
    const [lo, hi] = ranges[r];
    for (let n = lo; n <= hi; n++) {
      seats.push({ id: `c${r}-${n}`, floor: 2, row: `c${r}`, rowIndex: r, num: n, block: Math.floor((n - 1) / 10) + 1, wheelchair: false });
    }
  }
  return seats;
}

/** Districts / departments that must sit on the ground floor, on the easy-exit edges. */
export const PRIORITY_DISTRICTS = new Set(["11", "21", "JB", "ED"]);

export function needsPriorityFloor(input: { districtCode?: string | null; mobilitySupport?: boolean }): boolean {
  return !!input.mobilitySupport || (!!input.districtCode && PRIORITY_DISTRICTS.has(input.districtCode));
}

/**
 * Unit = (floor, row, block). Order in which units are tried:
 *  - priority parties: 1F outer blocks, front row first (row 1 → 14); then 1F inner blocks
 *    front-first; never 2F while any 1F seat is free.
 *  - everyone else: 1F inner blocks front-first; then 1F outer blocks BACK-first (leaving the
 *    front edges for priority parties as long as possible); then 2F, centre block first.
 * Within an outer block the seats run from the aisle inward (1→6 and 24→19), so a party
 * gets the easiest exit; elsewhere seats run left → right.
 */
export function unitOrder(priority: boolean): { floor: 1 | 2; rowIndex: number; block: number }[] {
  const units: { floor: 1 | 2; rowIndex: number; block: number }[] = [];
  const inner1F = () => { for (let r = 1; r <= 13; r++) for (const b of [2, 3]) units.push({ floor: 1, rowIndex: r, block: b }); };
  const outer1F = (backFirst: boolean) => {
    const rows = Array.from({ length: 14 }, (_, i) => i + 1); if (backFirst) rows.reverse();
    for (const r of rows) for (const b of [1, 4]) units.push({ floor: 1, rowIndex: r, block: b });
  };
  if (priority) { outer1F(false); inner1F(); } else { inner1F(); outer1F(true); }
  for (let r = 1; r <= 7; r++) for (const b of [2, 1, 3]) units.push({ floor: 2, rowIndex: r, block: b });
  return units;
}

export function seatSortWithinUnit(a: Seat, b: Seat): number {
  if (a.floor === 1 && a.block === 4) return b.num - a.num;   // 24 → 19: aisle first
  return a.num - b.num;
}

/**
 * Pick `count` free seats for one party: the first unit (in `unitOrder`) with a run of
 * `count` consecutive free seats wins; failing that, the largest free run in the earliest
 * unit, then the remainder from the following units (a split party stays as close as the
 * room allows). Wheelchair bays are never auto-assigned.
 */
export function suggestSeats(seats: Seat[], taken: Set<string>, count: number, priority: boolean): string[] {
  if (count <= 0) return [];
  const byUnit = new Map<string, Seat[]>();
  for (const s of seats) {
    if (s.wheelchair || taken.has(s.id)) continue;
    const k = `${s.floor}:${s.rowIndex}:${s.block}`;
    (byUnit.get(k) ?? byUnit.set(k, []).get(k)!).push(s);
  }
  const order = unitOrder(priority);
  const runsOf = (list: Seat[]) => {
    const sorted = [...list].sort(seatSortWithinUnit);
    const runs: Seat[][] = []; let cur: Seat[] = [];
    for (const s of sorted) {
      if (cur.length && Math.abs(s.num - cur[cur.length - 1].num) !== 1) { runs.push(cur); cur = []; }
      cur.push(s);
    }
    if (cur.length) runs.push(cur);
    return runs;
  };
  // 1) whole party together
  for (const u of order) {
    const list = byUnit.get(`${u.floor}:${u.rowIndex}:${u.block}`); if (!list) continue;
    const run = runsOf(list).find((r) => r.length >= count);
    if (run) return run.slice(0, count).map((s) => s.id);
  }
  // 2) split: largest run first, then keep walking the order
  const picked: string[] = [];
  for (const u of order) {
    const list = byUnit.get(`${u.floor}:${u.rowIndex}:${u.block}`); if (!list) continue;
    for (const run of runsOf(list).sort((a, b) => b.length - a.length)) {
      for (const s of run) { if (picked.length >= count) return picked; if (!picked.includes(s.id)) picked.push(s.id); }
    }
  }
  return picked;   // fewer than `count` only when the room is full
}

/** "1층 3열 1–3번 · 2층 c2열 11번" — one label for a party's seats. */
export function seatLabelFor(seatIds: string[], seats?: Seat[]): string {
  if (!seatIds.length) return "";
  const lookup = seats ? new Map(seats.map((s) => [s.id, s])) : null;
  const parse = (id: string): { floor: number; row: string; num: number; wc: boolean } => {
    const s = lookup?.get(id);
    if (s) return { floor: s.floor, row: s.row, num: s.num, wc: s.wheelchair };
    const m = /^(c?\d+)-(W?\d+)$/.exec(id);
    return { floor: m && m[1].startsWith("c") ? 2 : 1, row: m ? m[1] : id, num: m && !m[2].startsWith("W") ? Number(m[2]) : 0, wc: !!m && m[2].startsWith("W") };
  };
  const groups = new Map<string, { floor: number; row: string; nums: number[]; wc: number }>();
  for (const id of seatIds) {
    const p = parse(id); const k = `${p.floor}:${p.row}`;
    const g = groups.get(k) ?? { floor: p.floor, row: p.row, nums: [], wc: 0 };
    if (p.wc) g.wc++; else g.nums.push(p.num);
    groups.set(k, g);
  }
  const parts: string[] = [];
  for (const g of [...groups.values()].sort((a, b) => a.floor - b.floor || a.row.localeCompare(b.row, undefined, { numeric: true }))) {
    const nums = [...new Set(g.nums)].sort((a, b) => a - b);
    const spans: string[] = [];
    for (let i = 0; i < nums.length; ) {
      let j = i; while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
      spans.push(j > i ? `${nums[i]}–${nums[j]}` : String(nums[i])); i = j + 1;
    }
    const rowName = g.floor === 2 ? `${g.row}열` : `${g.row}열`;
    const body = [spans.length ? `${spans.join(",")}번` : "", g.wc ? `휠체어석${g.wc > 1 ? ` ${g.wc}` : ""}` : ""].filter(Boolean).join(" ");
    parts.push(`${g.floor}층 ${rowName} ${body}`);
  }
  return parts.join(" · ");
}
