# Data model (approved 2026-09-03, `supabase/migrations/0001_init.sql`)

| Table | Purpose |
|---|---|
| `profiles`, `staff_roles` | operations identities; roles `staff`/`desk`/`admin` are rows, not JWT claims |
| `event_config`, `stations`, `shuttle_runs`, `hospitality_items`, `seat_cursors` | event configuration (seeded) |
| `reservations`, `reservation_members` | applicant + companions; dietary/mobility columns live on the reservation |
| `passes` | one per reservation; stores only `token_hash` (SHA-256 of the QR token) |
| `seat_assignments` | written by `assign_seat()`; replaceable rule |
| `checkins`, `hospitality_distributions` | attendance (one active row per reservation, partial unique index) and items handed over |

## RPCs
- `create_reservation(payload, token_hash)` — server only (secret key). Validates nothing itself: the Route Handler validates.
- `lookup_pass(token_hash)` — server only; minimal fields for the guest's pass page.
- `find_reservations(q)`, `get_reservation_summary(id)`, `lookup_reservation_by_pass(token_hash)` — staff/desk/admin.
- `perform_checkin(reservation, station, count, method, distributions)` — staff/admin; idempotent.
- `ops_stats()` — desk/admin aggregates; no personal rows.
- `my_roles()`, `has_role(...)`.

## Access
- anon: nothing. authenticated without a role: nothing.
- staff: RPCs only. desk/admin: select on reservations, members, seats, checkins. admin: config, runs, roles, reservation edits, void.
- Realtime publication: `checkins` only.

## Retention
Names, phones and notes are deleted within 30 days after 2026-10-11 (documented in the form and `supabase/README.md`).
