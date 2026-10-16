-- 0013 (2026-10-16): thank-you letters after the event.
--  * letters: what each district pastor wrote. Two per district —
--      'one' for VIP · 인도자 · 미래셀, 'two' for members who signed up alone (일반 성도).
--    The web page /letter/<district>-<audience> shows the matching one; an empty letter is not shown.
--  * letter_editors: one link per district pastor (/letter/write/<token>). Only the SHA-256 of the token is stored;
--    the link can change that district's two letters and nothing else. Revoke by setting revoked_at.
--  Only the server (service role) reads or writes these: the web page and the pastor's link check the token
--  on the server, and the ops admin tab checks the admin role first.
-- Run once in the SQL Editor.

create table if not exists public.letters (
  district_code text not null,
  kind text not null check (kind in ('one', 'two')),
  body text not null default '',
  signer text not null default '',
  updated_at timestamptz not null default now(),
  updated_via text,                       -- 'pastor' (the pastor's link) or 'admin' (ops)
  primary key (district_code, kind)
);

create table if not exists public.letter_editors (
  id uuid primary key default gen_random_uuid(),
  district_code text not null,
  token_hash text not null unique,
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists letter_editors_district_idx on public.letter_editors (district_code);

alter table public.letters enable row level security;
alter table public.letter_editors enable row level security;
revoke all on public.letters, public.letter_editors from anon, authenticated;

-- check: both tables exist (expect 2 rows)
select table_name from information_schema.tables where table_schema = 'public' and table_name in ('letters', 'letter_editors');
