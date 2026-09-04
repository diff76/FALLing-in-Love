import assert from "node:assert/strict";
import test from "node:test";
import { assignSeat, clampArrivedCount, resolveCheckinOutcome, seatLabel } from "@fil/domain";

test("seat allocation fills the emptiest block and keeps a party contiguous", () => {
  const first = assignSeat(3, { A: 1, B: 1, C: 1 });
  assert.equal(first.assignment.label, "채플 A블록 1–3");
  const second = assignSeat(1, first.cursors);
  assert.equal(second.assignment.block, "B");
  assert.equal(seatLabel("C", 5, 5), "채플 C블록 5");
});

test("re-scanning a checked-in party never counts twice", () => {
  const existing = { id: "c1", arrivedCount: 2, stationName: "채플 웰컴센터", checkedInAt: "2026-10-11T03:10:00Z" };
  const req = { reservationId: "r1", stationCode: "landing", arrivedCount: 3, method: "qr" as const, distributions: {} };
  assert.equal(resolveCheckinOutcome(existing, req).kind, "already");
  assert.equal(resolveCheckinOutcome(null, req).kind, "new");
  assert.equal(clampArrivedCount(9, 3), 5);
  assert.equal(clampArrivedCount(-2, 3), 0);
});
