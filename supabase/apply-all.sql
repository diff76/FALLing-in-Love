-- FALLing in Love: schema + grants + dietary rollup + seed (fresh projects only)
-- FALLing in Love — initial schema (approved 2026-09-03)
-- Principles: anon has no table access; public writes go through server-validated RPCs;
-- staff/desk/admin are table-based roles enforced by RLS; check-in is the only attendance write.

create extension if not exists pgcrypto;

-- ---------- enums ----------
create type public.staff_role as enum ('staff', 'desk', 'admin');
create type public.reservation_kind as enum ('host', 'guest_self');
create type public.transport_kind as enum ('shuttle', 'car', 'other');
create type public.reservation_status as enum ('active', 'cancelled');
create type public.checkin_method as enum ('qr', 'manual');
create type public.shuttle_direction as enum ('outbound', 'return');

-- ---------- identity ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
create table public.staff_roles (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.staff_role not null,
  primary key (profile_id, role)
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.has_role(variadic wanted public.staff_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff_roles r
    where r.profile_id = auth.uid() and r.role = any (wanted)
  );
$$;

create or replace function public.my_roles() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(role::text order by role), '{}') from public.staff_roles where profile_id = auth.uid();
$$;

-- ---------- event configuration ----------
create table public.event_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
create table public.stations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null
);
create table public.shuttle_runs (
  id uuid primary key default gen_random_uuid(),
  direction public.shuttle_direction not null,
  departs_at time not null,
  label text not null,
  capacity int,
  active boolean not null default true,
  unique (direction, departs_at)
);
create table public.hospitality_items (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  initial_stock int not null default 0,
  adjustment int not null default 0
);
create table public.seat_cursors (
  block text primary key,
  next_seat int not null default 1
);

-- ---------- reservations ----------
create sequence public.reservation_code_seq start 101;

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind public.reservation_kind not null,
  applicant_name text not null,
  phone text not null,
  phone_last4 text generated always as (right(regexp_replace(phone, '\D', '', 'g'), 4)) stored,
  district_code text,
  inviter_name text,
  age_group text,
  party_size int not null check (party_size between 1 and 12),
  transport public.transport_kind not null,
  outbound_run_id uuid references public.shuttle_runs (id),
  return_run_id uuid references public.shuttle_runs (id),
  vehicle_plate text,
  mobility_support boolean not null default false,
  mobility_note text,
  dietary_note text,
  privacy_consent boolean not null,
  contact_consent boolean not null default false,
  status public.reservation_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reservations_name_idx on public.reservations (applicant_name);
create index reservations_last4_idx on public.reservations (phone_last4);

create table public.reservation_members (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  position int not null,
  name text not null,
  relation text,
  age_group text,
  dietary_note text,
  unique (reservation_id, position)
);

create table public.passes (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references public.reservations (id) on delete cascade,
  token_hash text not null unique,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table public.seat_assignments (
  reservation_id uuid primary key references public.reservations (id) on delete cascade,
  block text not null,
  seat_from int not null,
  seat_to int not null,
  assigned_at timestamptz not null default now()
);

-- ---------- attendance ----------
create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  station_id uuid not null references public.stations (id),
  staff_id uuid references public.profiles (id),
  arrived_count int not null check (arrived_count >= 0),
  method public.checkin_method not null,
  checked_in_at timestamptz not null default now(),
  voided_at timestamptz,
  note text
);
-- one ACTIVE check-in per reservation: duplicates are impossible, voiding is explicit
create unique index checkins_one_active_idx on public.checkins (reservation_id) where voided_at is null;

create table public.hospitality_distributions (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references public.checkins (id) on delete cascade,
  item_id uuid not null references public.hospitality_items (id),
  qty int not null check (qty >= 0),
  unique (checkin_id, item_id)
);

-- ---------- helpers ----------
create or replace function public.seat_label(p_block text, p_from int, p_to int) returns text
language sql immutable as $$
  select '채플 ' || p_block || '블록 ' || p_from || case when p_to > p_from then '–' || p_to else '' end;
$$;

-- Replaceable allocation rule: fill the block with the lowest cursor (keeps blocks balanced).
create or replace function public.assign_seat(p_reservation_id uuid, p_party_size int) returns text
language plpgsql security definer set search_path = public as $$
declare v_block text; v_from int; v_to int;
begin
  select block, next_seat into v_block, v_from
  from public.seat_cursors order by next_seat, block limit 1 for update;
  if v_block is null then raise exception 'no seat blocks configured'; end if;
  v_to := v_from + p_party_size - 1;
  update public.seat_cursors set next_seat = v_to + 1 where block = v_block;
  insert into public.seat_assignments (reservation_id, block, seat_from, seat_to)
  values (p_reservation_id, v_block, v_from, v_to)
  on conflict (reservation_id) do update set block = excluded.block, seat_from = excluded.seat_from, seat_to = excluded.seat_to, assigned_at = now();
  return public.seat_label(v_block, v_from, v_to);
end $$;

create or replace function public.district_label(p_code text) returns text
language sql stable as $$
  select coalesce((select value ->> p_code from public.event_config where key = 'districts'), '교구 확인 필요');
$$;

-- ---------- public write path (called by the server with the secret key after validation) ----------
create or replace function public.create_reservation(payload jsonb, token_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_code text; v_seq bigint; v_party int; v_seat text; v_out uuid; v_ret uuid; m jsonb; i int := 0;
  v_event_date date := coalesce((select (value ->> 0)::date from public.event_config where key = 'event_date'), current_date);
begin
  v_party := 1 + coalesce(jsonb_array_length(payload -> 'members'), 0);
  v_seq := nextval('public.reservation_code_seq');
  v_code := to_char(v_event_date, 'YYMMDD') || '-' || coalesce(nullif(payload ->> 'districtCode', ''), '00') || '-' || lpad((v_seq % 1000)::text, 3, '0');
  select id into v_out from public.shuttle_runs where direction = 'outbound' and label = payload ->> 'outboundRun' and active;
  select id into v_ret from public.shuttle_runs where direction = 'return' and label = payload ->> 'returnRun' and active;

  insert into public.reservations (
    code, kind, applicant_name, phone, district_code, inviter_name, age_group, party_size, transport,
    outbound_run_id, return_run_id, vehicle_plate, mobility_support, mobility_note, dietary_note,
    privacy_consent, contact_consent)
  values (
    v_code, (payload ->> 'kind')::public.reservation_kind, payload ->> 'applicantName', payload ->> 'phone',
    nullif(payload ->> 'districtCode', ''), nullif(payload ->> 'inviterName', ''), nullif(payload ->> 'ageGroup', ''), v_party,
    (payload ->> 'transport')::public.transport_kind, v_out, v_ret, nullif(payload ->> 'vehiclePlate', ''),
    coalesce((payload ->> 'mobilitySupport')::boolean, false), nullif(payload ->> 'mobilityNote', ''), nullif(payload ->> 'dietaryNote', ''),
    coalesce((payload ->> 'privacyConsent')::boolean, false), coalesce((payload ->> 'contactConsent')::boolean, false))
  returning id into v_id;

  for m in select * from jsonb_array_elements(coalesce(payload -> 'members', '[]'::jsonb)) loop
    i := i + 1;
    insert into public.reservation_members (reservation_id, position, name, relation, age_group, dietary_note)
    values (v_id, i, m ->> 'name', nullif(m ->> 'relation', ''), nullif(m ->> 'ageGroup', ''), nullif(m ->> 'dietaryNote', ''));
  end loop;

  v_seat := public.assign_seat(v_id, v_party);
  insert into public.passes (reservation_id, token_hash) values (v_id, token_hash);
  return jsonb_build_object('reservation_id', v_id, 'code', v_code, 'seat_label', v_seat);
end $$;

-- Minimal, non-sensitive view of one reservation for the guest's own pass page.
create or replace function public.lookup_pass(p_token_hash text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'code', r.code, 'applicant_name', r.applicant_name, 'kind', r.kind, 'inviter_name', r.inviter_name,
    'district_label', case when r.district_code is null then null else public.district_label(r.district_code) end,
    'party_size', r.party_size, 'guest_count', r.party_size - 1,
    'seat_label', (select public.seat_label(s.block, s.seat_from, s.seat_to) from public.seat_assignments s where s.reservation_id = r.id),
    'transport', r.transport,
    'outbound_label', (select label from public.shuttle_runs where id = r.outbound_run_id),
    'return_label', (select label from public.shuttle_runs where id = r.return_run_id),
    'mobility_support', r.mobility_support, 'has_dietary_note', r.dietary_note is not null,
    'vehicle_plate', r.vehicle_plate, 'issued_at', p.issued_at)
  from public.passes p join public.reservations r on r.id = p.reservation_id
  where p.token_hash = p_token_hash and p.revoked_at is null and r.status = 'active';
$$;

-- ---------- operations read models ----------
create or replace function public.reservation_summary_json(r public.reservations) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', r.id, 'code', r.code, 'applicant_name', r.applicant_name,
    'district_label', case when r.district_code is null then null else public.district_label(r.district_code) end,
    'party_size', r.party_size, 'guest_count', r.party_size - 1,
    'seat_label', (select public.seat_label(s.block, s.seat_from, s.seat_to) from public.seat_assignments s where s.reservation_id = r.id),
    'transport', r.transport,
    'outbound_label', (select label from public.shuttle_runs where id = r.outbound_run_id),
    'return_label', (select label from public.shuttle_runs where id = r.return_run_id),
    'mobility_support', r.mobility_support, 'mobility_note', r.mobility_note, 'dietary_note', r.dietary_note,
    'vehicle_plate', r.vehicle_plate,
    'checkin', (select jsonb_build_object('id', c.id, 'arrived_count', c.arrived_count, 'station_name', st.name, 'checked_in_at', c.checked_in_at)
                from public.checkins c join public.stations st on st.id = c.station_id
                where c.reservation_id = r.id and c.voided_at is null));
$$;

create or replace function public.find_reservations(p_query text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare q text := trim(p_query);
begin
  if not public.has_role('staff', 'desk', 'admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  if length(q) < 2 then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(public.reservation_summary_json(r) order by r.applicant_name)
    from (select * from public.reservations r
          where r.status = 'active' and (r.applicant_name ilike '%' || q || '%' or r.phone_last4 = q or r.code = q)
          limit 20) r), '[]'::jsonb);
end $$;

create or replace function public.get_reservation_summary(p_reservation_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role('staff', 'desk', 'admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  return (select public.reservation_summary_json(r) from public.reservations r where r.id = p_reservation_id and r.status = 'active');
end $$;

create or replace function public.lookup_reservation_by_pass(p_token_hash text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role('staff', 'desk', 'admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  return (select public.reservation_summary_json(r) from public.passes p join public.reservations r on r.id = p.reservation_id
          where p.token_hash = p_token_hash and p.revoked_at is null and r.status = 'active');
end $$;

-- THE ONE WRITE PATH for attendance. Idempotent: an existing active check-in is returned, never duplicated.
create or replace function public.perform_checkin(
  p_reservation_id uuid, p_station_code text, p_arrived_count int, p_method text, p_distributions jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_station uuid; v_existing public.checkins; v_id uuid; v_name text; v_seat text; k text; v int;
begin
  if not public.has_role('staff', 'admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  select id into v_station from public.stations where code = p_station_code;
  if v_station is null then raise exception 'unknown station %', p_station_code; end if;
  select applicant_name into v_name from public.reservations where id = p_reservation_id and status = 'active';
  if v_name is null then raise exception 'unknown reservation'; end if;
  select public.seat_label(block, seat_from, seat_to) into v_seat from public.seat_assignments where reservation_id = p_reservation_id;

  select * into v_existing from public.checkins where reservation_id = p_reservation_id and voided_at is null;
  if found then
    return jsonb_build_object('already', true, 'checkin_id', v_existing.id, 'arrived_count', v_existing.arrived_count,
      'station_name', (select name from public.stations where id = v_existing.station_id),
      'checked_in_at', v_existing.checked_in_at, 'applicant_name', v_name, 'seat_label', v_seat);
  end if;

  insert into public.checkins (reservation_id, station_id, staff_id, arrived_count, method)
  values (p_reservation_id, v_station, auth.uid(), greatest(p_arrived_count, 0), p_method::public.checkin_method)
  returning id into v_id;

  for k, v in select key, (value)::int from jsonb_each_text(coalesce(p_distributions, '{}'::jsonb)) loop
    if v > 0 then
      insert into public.hospitality_distributions (checkin_id, item_id, qty)
      select v_id, id, v from public.hospitality_items where code = k;
    end if;
  end loop;

  return jsonb_build_object('already', false, 'checkin_id', v_id, 'arrived_count', greatest(p_arrived_count, 0),
    'station_name', (select name from public.stations where id = v_station), 'checked_in_at', now(),
    'applicant_name', v_name, 'seat_label', v_seat);
end $$;

create or replace function public.ops_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role('desk', 'admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  return (
    with r as (select * from public.reservations where status = 'active'),
         c as (select * from public.checkins where voided_at is null)
    select jsonb_build_object(
      'reservations', (select count(*) from r),
      'people', (select coalesce(sum(party_size), 0) from r),
      'guests', (select coalesce(sum(party_size - 1), 0) from r),
      'checked_in_parties', (select count(*) from c),
      'checked_in_people', (select coalesce(sum(arrived_count), 0) from c),
      'contact_consent_people', (select coalesce(sum(party_size), 0) from r where contact_consent),
      'mobility_parties', (select count(*) from r where mobility_support),
      'dietary_parties', (select count(*) from r where dietary_note is not null),
      'by_district', (select coalesce(jsonb_agg(jsonb_build_object('label', d, 'people', p, 'arrived', a) order by p desc), '[]'::jsonb)
        from (select public.district_label(r.district_code) d, sum(r.party_size) p, coalesce(sum(c.arrived_count), 0) a
              from r left join c on c.reservation_id = r.id group by 1) x),
      'by_run', (select coalesce(jsonb_agg(jsonb_build_object('label', coalesce(s.label, '개인 차량'), 'people', x.p) order by s.label nulls last), '[]'::jsonb)
        from (select outbound_run_id, sum(party_size) p from r group by 1) x left join public.shuttle_runs s on s.id = x.outbound_run_id),
      'by_station', (select coalesce(jsonb_agg(jsonb_build_object('name', st.name, 'arrived', coalesce(x.a, 0)) order by st.code), '[]'::jsonb)
        from public.stations st left join (select station_id, sum(arrived_count) a from c group by 1) x on x.station_id = st.id)
    ));
end $$;

-- ---------- row level security ----------
alter table public.profiles enable row level security;
alter table public.staff_roles enable row level security;
alter table public.event_config enable row level security;
alter table public.stations enable row level security;
alter table public.shuttle_runs enable row level security;
alter table public.hospitality_items enable row level security;
alter table public.seat_cursors enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_members enable row level security;
alter table public.passes enable row level security;
alter table public.seat_assignments enable row level security;
alter table public.checkins enable row level security;
alter table public.hospitality_distributions enable row level security;

create policy "own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own roles" on public.staff_roles for select to authenticated using (profile_id = auth.uid());
create policy "admin manages roles" on public.staff_roles for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "ops reads config" on public.event_config for select to authenticated using (public.has_role('staff', 'desk', 'admin'));
create policy "admin writes config" on public.event_config for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
create policy "ops reads stations" on public.stations for select to authenticated using (public.has_role('staff', 'desk', 'admin'));
create policy "ops reads runs" on public.shuttle_runs for select to authenticated using (public.has_role('staff', 'desk', 'admin'));
create policy "admin writes runs" on public.shuttle_runs for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
create policy "ops reads items" on public.hospitality_items for select to authenticated using (public.has_role('staff', 'desk', 'admin'));
create policy "desk adjusts items" on public.hospitality_items for update to authenticated using (public.has_role('desk', 'admin')) with check (public.has_role('desk', 'admin'));

-- staff never select reservations directly (they use the limited RPCs); desk and admin may.
create policy "desk admin read reservations" on public.reservations for select to authenticated using (public.has_role('desk', 'admin'));
create policy "admin edits reservations" on public.reservations for update to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
create policy "desk admin read members" on public.reservation_members for select to authenticated using (public.has_role('desk', 'admin'));
create policy "desk admin read seats" on public.seat_assignments for select to authenticated using (public.has_role('desk', 'admin'));
create policy "ops reads checkins" on public.checkins for select to authenticated using (public.has_role('staff', 'desk', 'admin'));
create policy "admin voids checkins" on public.checkins for update to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
create policy "ops reads distributions" on public.hospitality_distributions for select to authenticated using (public.has_role('desk', 'admin'));
-- passes: no direct access for anyone but the service role.

-- anon gets nothing at all; the public site talks to the server, which uses the secret key.
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon, public;
revoke execute on function public.create_reservation(jsonb, text) from authenticated;
revoke execute on function public.lookup_pass(text) from authenticated;
grant execute on function public.find_reservations(text), public.get_reservation_summary(uuid),
  public.lookup_reservation_by_pass(text), public.perform_checkin(uuid, text, int, text, jsonb),
  public.ops_stats(), public.my_roles(), public.has_role(public.staff_role[]) to authenticated;

-- realtime: only check-ins fan out (desk, display, admin)
alter publication supabase_realtime add table public.checkins;

-- 0002: explicit privileges. 0001 revoked EXECUTE from PUBLIC, which also stripped the
-- service_role and authenticated roles. Postgres privileges are the outer gate; RLS
-- (still enabled everywhere) decides which rows an authenticated user can see.
grant usage on schema public to anon, authenticated, service_role;

-- service_role (server-side secret key): full access, bypasses RLS by design
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- authenticated (ops staff): table access gated by the RLS policies in 0001
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- anon: nothing (the public site only talks to the server)
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;

-- keep the two public write/lookup RPCs server-only
revoke execute on function public.create_reservation(jsonb, text) from authenticated;
revoke execute on function public.lookup_pass(text) from authenticated;

-- same rules for tables created later
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;

-- 0003: companions' dietary notes roll up into the pass badge and the staff summary.
create or replace function public.dietary_rollup(p_reservation_id uuid, p_own text) returns text
language sql stable as $$
  select nullif(concat_ws(' · ',
    p_own,
    (select string_agg(m.name || ': ' || m.dietary_note, ' · ' order by m.position)
     from public.reservation_members m
     where m.reservation_id = p_reservation_id and m.dietary_note is not null and m.dietary_note <> '')), '');
$$;

create or replace function public.lookup_pass(p_token_hash text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'code', r.code, 'applicant_name', r.applicant_name, 'kind', r.kind, 'inviter_name', r.inviter_name,
    'district_label', case when r.district_code is null then null else public.district_label(r.district_code) end,
    'party_size', r.party_size, 'guest_count', r.party_size - 1,
    'seat_label', (select public.seat_label(s.block, s.seat_from, s.seat_to) from public.seat_assignments s where s.reservation_id = r.id),
    'transport', r.transport,
    'outbound_label', (select label from public.shuttle_runs where id = r.outbound_run_id),
    'return_label', (select label from public.shuttle_runs where id = r.return_run_id),
    'mobility_support', r.mobility_support, 'has_dietary_note', public.dietary_rollup(r.id, r.dietary_note) is not null,
    'vehicle_plate', r.vehicle_plate, 'issued_at', p.issued_at)
  from public.passes p join public.reservations r on r.id = p.reservation_id
  where p.token_hash = p_token_hash and p.revoked_at is null and r.status = 'active';
$$;

create or replace function public.reservation_summary_json(r public.reservations) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', r.id, 'code', r.code, 'applicant_name', r.applicant_name,
    'district_label', case when r.district_code is null then null else public.district_label(r.district_code) end,
    'party_size', r.party_size, 'guest_count', r.party_size - 1,
    'seat_label', (select public.seat_label(s.block, s.seat_from, s.seat_to) from public.seat_assignments s where s.reservation_id = r.id),
    'transport', r.transport,
    'outbound_label', (select label from public.shuttle_runs where id = r.outbound_run_id),
    'return_label', (select label from public.shuttle_runs where id = r.return_run_id),
    'mobility_support', r.mobility_support, 'mobility_note', r.mobility_note,
    'dietary_note', public.dietary_rollup(r.id, r.dietary_note),
    'vehicle_plate', r.vehicle_plate,
    'checkin', (select jsonb_build_object('id', c.id, 'arrived_count', c.arrived_count, 'station_name', st.name, 'checked_in_at', c.checked_in_at)
                from public.checkins c join public.stations st on st.id = c.station_id
                where c.reservation_id = r.id and c.voided_at is null));
$$;

grant execute on function public.dietary_rollup(uuid, text) to service_role, authenticated;

-- ---------- seed ----------
-- Provisional seed. Shuttle times are placeholders until the church confirms them.
insert into public.event_config (key, value) values
  ('event_date', '"2026-10-11"'),
  ('districts', '{"11":"11교구","12":"12교구","13":"13교구","14":"14교구","15":"15교구","21":"21교구","22":"22교구","23":"23교구","24":"24교구","25":"25교구","31":"31교구","32":"32교구","33":"33교구","35":"35교구","JB":"장애인부","ED":"교육부"}')
on conflict (key) do update set value = excluded.value, updated_at = now();

insert into public.stations (code, name) values
  ('gate', '창동 THE GATE'), ('landing', '주차장 THE LANDING'), ('chapel', '채플 웰컴센터')
on conflict (code) do nothing;

insert into public.shuttle_runs (direction, departs_at, label) values
  ('outbound', '10:40', '10:40'), ('outbound', '11:10', '11:10'), ('outbound', '11:40', '11:40'),
  ('outbound', '12:00', '12:00'), ('outbound', '12:15', '12:15'), ('outbound', '12:30', '12:30'),
  ('return', '16:10', '16:10'), ('return', '16:40', '16:40')
on conflict (direction, departs_at) do nothing;

insert into public.hospitality_items (code, name, initial_stock) values
  ('brochure', '캠퍼스 맵 브로셔', 150), ('stamp', 'THE TRAIL 스탬프 카드', 150),
  ('drink', '웰컴 드링크 쿠폰', 150), ('pouch', '어메니티 파우치', 60)
on conflict (code) do nothing;

insert into public.seat_cursors (block) values ('A'), ('B'), ('C') on conflict (block) do nothing;
