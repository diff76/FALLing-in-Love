# Supabase

1. Install the CLI (`brew install supabase/tap/supabase`) and link the project: `supabase link --project-ref <ref>`.
2. Apply the schema: `supabase db push` (or paste `migrations/0001_init.sql` into the SQL editor).
3. Seed: run `seed.sql` (provisional shuttle times and districts).
4. Create staff accounts in Auth (Auto Confirm), then run `setup-roles.sql` (privilege fix + profiles + roles by e-mail). Edit the e-mail list in section 3 for your team.
   From 2026-09-27 the ops app has **관리자 → 계정 관리** (create / rename / roles / password / delete) — it needs `SUPABASE_SECRET_KEY` on the ops deployment; `setup-roles.sql` is only for the very first admin.
5. Copy the project URL, publishable key and secret key into `.env.local` for both apps.

Data retention: personal data (names, phones, notes) is deleted within 30 days after 2026-10-11.

## 0004 — seats at check-in, worship-only, import, parking (2026-09-24)
Run `migrations/0004_seats_checkin_parking.sql` in the Supabase SQL editor (after 0001–0003). It seeds the chapel chart (`seats`), replaces `seat_assignments` with per-seat rows, moves seat assignment from reservation time to `perform_checkin` / `reassign_seats`, adds `attendance` / `worship_service` / `worship_site` / `source` to reservations with a (name, phone) dedupe index, confirms the shuttle runs (10:00–15:00 every 50 min; return 16:15, 17:00), and adds the parking desk (`parking_state`, `vip_arrivals`, `parking_board`, `parking_adjust`, `vip_mark`) and the admin import RPCs (`admin_create_reservation`, `find_duplicates`).
