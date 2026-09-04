import type { CheckinMethod } from "./types";

export type ExistingCheckin = {
  id: string;
  arrivedCount: number;
  stationName: string;
  checkedInAt: string;
};

export type CheckinRequest = {
  reservationId: string;
  stationCode: string;
  arrivedCount: number;
  method: CheckinMethod;
  distributions: Record<string, number>;
};

export type CheckinOutcome =
  | { kind: "already"; existing: ExistingCheckin }
  | { kind: "new"; request: CheckinRequest };

/**
 * Staff check-in is the only attendance write. Re-scanning an already checked-in
 * party is an "usher to the seat" moment: nothing is counted twice and the welcome
 * display does not fire again. The SQL RPC enforces the same rule; this mirror keeps
 * the rule explicit and unit-testable on the client.
 */
export function resolveCheckinOutcome(existing: ExistingCheckin | null, request: CheckinRequest): CheckinOutcome {
  if (existing) return { kind: "already", existing };
  if (request.arrivedCount < 0) throw new Error("arrivedCount must be >= 0");
  return { kind: "new", request };
}

export function clampArrivedCount(count: number, partySize: number): number {
  return Math.max(0, Math.min(partySize + 2, Math.round(count)));
}
