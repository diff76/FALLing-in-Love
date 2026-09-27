-- 0005 (2026-09-28): one-tap access links. An admin mints a link for a staff account; opening
-- it signs that account in without a password (for volunteers who struggle with login on the
-- day). Only the SHA-256 of the token is stored; links expire and can be revoked.
create table if not exists public.access_links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique,
  label text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  use_count int not null default 0
);
create index if not exists access_links_profile_idx on public.access_links (profile_id);
alter table public.access_links enable row level security;
-- The ops server reads/writes these with the service role; admins may also read them directly.
drop policy if exists "admin reads access links" on public.access_links;
create policy "admin reads access links" on public.access_links for select to authenticated using (public.has_role('admin'));
grant all on public.access_links to service_role;
grant select on public.access_links to authenticated;
