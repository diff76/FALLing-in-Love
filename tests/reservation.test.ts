import assert from "node:assert/strict";
import test from "node:test";
import { makeReservationCode, normalizePhone, partySize, phoneLast4, reservationInputSchema } from "@fil/domain";

const valid = {
  kind: "host", applicantName: "김은혜", phone: "010-2841-7730", districtCode: "11",
  members: [{ name: "정민호", relation: "직장 동료", ageGroup: "40대" }],
  transport: "shuttle", outboundRun: "12:00", privacyConsent: true, contactConsent: true,
};

test("valid host reservation parses and normalises the phone", () => {
  const r = reservationInputSchema.safeParse(valid);
  assert.ok(r.success);
  assert.equal(r.data.phone, "01028417730");
  assert.equal(partySize(r.data), 2);
});

test("host must pick a district; self-registered guest must name the inviter", () => {
  const host = reservationInputSchema.safeParse({ ...valid, districtCode: "" });
  assert.ok(!host.success && host.error.issues.some((i) => i.path[0] === "districtCode"));
  const guest = reservationInputSchema.safeParse({ ...valid, kind: "guest_self", districtCode: "", inviterName: "", members: [] });
  assert.ok(!guest.success && guest.error.issues.some((i) => i.path[0] === "inviterName"));
});

test("privacy consent is mandatory and shuttle riders must choose a run", () => {
  assert.ok(!reservationInputSchema.safeParse({ ...valid, privacyConsent: false }).success);
  assert.ok(!reservationInputSchema.safeParse({ ...valid, outboundRun: "" }).success);
  assert.ok(reservationInputSchema.safeParse({ ...valid, transport: "car", outboundRun: "" }).success);
});

test("party size is capped at host + 4", () => {
  const five = Array.from({ length: 5 }, (_, i) => ({ name: `게스트${i}` }));
  assert.ok(!reservationInputSchema.safeParse({ ...valid, members: five }).success);
});

test("phone helpers and reservation code", () => {
  assert.equal(normalizePhone("010 2841 7730"), "01028417730");
  assert.equal(phoneLast4("010-2841-7730"), "7730");
  assert.equal(makeReservationCode("2026-10-11", "11", 101), "261011-11-101");
  assert.equal(makeReservationCode("2026-10-11", undefined, 7), "261011-00-007");
});
