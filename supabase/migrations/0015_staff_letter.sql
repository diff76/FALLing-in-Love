-- 0015 (2026-10-17): a thank-you letter for the STAFF.
--  Admins write one letter for everyone who served (not per district): it is stored as district_code 'ALL',
--  kind 'staff', and opens at /letter/staff. For this letter `signer` holds the whole signature line
--  (e.g. "2026 온출전 준비위원회 올림"). Its photos sit in the "oms" bucket under letters/ALL/staff/.
-- Run once in the SQL Editor. (Supabase warns about "drop": it only swaps the allowed-kinds rule; no letter is touched.)

alter table public.letters drop constraint if exists letters_kind_check;
alter table public.letters add constraint letters_kind_check check (kind in ('vip', 'leader', 'mirae', 'member', 'staff'));

-- check: the rule now lists staff
select pg_get_constraintdef(oid) from pg_constraint where conname = 'letters_kind_check';
