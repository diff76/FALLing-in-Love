import assert from "node:assert/strict";
import test from "node:test";
import { buildSeatLayout, clampArrivedCount, needsPriorityFloor, resolveCheckinOutcome, seatLabelFor, suggestSeats } from "@fil/domain";

const seats = buildSeatLayout();

test("the chart matches the posted seat plan", () => {
  const f1 = seats.filter((s) => s.floor === 1), f2 = seats.filter((s) => s.floor === 2);
  assert.equal(f1.filter((s) => !s.wheelchair).length, 13 * 24 - 6 + 12);   // rows 1–13 (row 1 lacks block 4) + row 14 outer blocks
  assert.equal(f1.filter((s) => s.wheelchair).length, 2);
  assert.equal(f2.length, 30 * 4 + 26 * 2 + 28);
  assert.ok(seats.some((s) => s.id === "c4-3") && !seats.some((s) => s.id === "c4-2"));
  assert.ok(!seats.some((s) => s.id === "14-7") && seats.some((s) => s.id === "14-19"));
});

test("a general party sits together in the front centre; a priority party on the front aisle edge", () => {
  const general = suggestSeats(seats, new Set(), 3, false);
  assert.deepEqual(general, ["1-7", "1-8", "1-9"]);
  const priority = suggestSeats(seats, new Set(), 2, true);
  assert.deepEqual(priority, ["1-1", "1-2"]);
  const right = suggestSeats(seats, new Set(["1-1", "1-2", "1-3", "1-4", "1-5", "1-6"]), 2, true);
  assert.deepEqual(right, ["2-1", "2-2"]);   // next front row's edge before the same row's other blocks
  assert.ok(needsPriorityFloor({ districtCode: "21" }) && needsPriorityFloor({ mobilitySupport: true }) && !needsPriorityFloor({ districtCode: "12" }));
});

test("a party that cannot sit together is split as close as possible, never on wheelchair bays", () => {
  const taken = new Set(seats.filter((s) => s.floor === 1 && s.block !== 1).map((s) => s.id));
  const picked = suggestSeats(seats, taken, 8, false);
  assert.equal(picked.length, 8);
  assert.ok(!picked.some((id) => id.includes("W")));
  assert.equal(seatLabelFor(["3-1", "3-2", "3-3"]), "1층 3열 1–3번");
  assert.equal(seatLabelFor(["c2-11", "3-5", "3-6", "1-W1"]), "1층 1열 휠체어석 · 1층 3열 5–6번 · 2층 c2열 11번");
});

test("re-scanning a checked-in party never counts twice", () => {
  const existing = { id: "c1", arrivedCount: 2, stationName: "채플 웰컴센터", checkedInAt: "2026-10-11T03:10:00Z" };
  const req = { reservationId: "r1", stationCode: "landing", arrivedCount: 3, method: "qr" as const, distributions: {} };
  assert.equal(resolveCheckinOutcome(existing, req).kind, "already");
  assert.equal(resolveCheckinOutcome(null, req).kind, "new");
  assert.equal(clampArrivedCount(9, 3), 5);
  assert.equal(clampArrivedCount(-2, 3), 0);
});
