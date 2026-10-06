-- 0011 (2026-10-06): one sign-up may keep more than one live Pass link.
--  An admin can attach an earlier link (e.g. from a sign-up that was removed and then taken again) to the
--  current sign-up, so the old Pass and the invitations sent from it open again. Every lookup — the Pass
--  page, the scan desks, check-in — already finds a pass by its token, so nothing else changes.
--  "Lost my link → new link" on the web keeps one live link: it renews the newest and revokes the rest.
-- Run once in the SQL Editor.

alter table public.passes drop constraint if exists passes_reservation_id_key;
create index if not exists passes_reservation_id_idx on public.passes (reservation_id);

-- check: no unique constraint on reservation_id is left (expect 0 rows)
select conname from pg_constraint
where conrelid = 'public.passes'::regclass and contype = 'u'
  and conkey = array[(select attnum from pg_attribute where attrelid = 'public.passes'::regclass and attname = 'reservation_id')];
