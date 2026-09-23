-- 0004 (2026-09-24): seats are assigned at CHECK-IN on the real chapel chart (no-shows never
-- hold a seat); worship-only attendance; dedupe; Excel import; parking desk; confirmed shuttle.

-- ---------- reservations: attendance mode, dedupe, source ----------
alter table public.reservations
  add column if not exists attendance text not null default 'main' check (attendance in ('main', 'worship')),
  add column if not exists worship_service smallint check (worship_service between 1 and 3),
  add column if not exists worship_site text check (worship_site in ('changdong', 'hanshin')),
  add column if not exists source text not null default 'web' check (source in ('web', 'import'));
-- one active reservation per (name, phone): stops double web sign-ups and import duplicates
create unique index if not exists reservations_dedupe_idx
  on public.reservations (applicant_name, phone) where status = 'active';

-- ---------- the chapel chart ----------
create table if not exists public.seats (
  id text primary key,                 -- '3-14' · 'c2-11' · '1-W1'
  floor smallint not null check (floor in (1, 2)),
  row_label text not null,
  row_index smallint not null,
  num smallint not null,               -- 0 for wheelchair bays
  block smallint not null,
  wheelchair boolean not null default false
);
do $$
declare r int; n int; b int;
begin
  if (select count(*) from public.seats) > 0 then return; end if;
  for r in 1..14 loop
    for n in 1..24 loop
      b := (n - 1) / 6 + 1;
      if r = 14 and b in (2, 3) then continue; end if;
      if r = 1 and b = 4 then continue; end if;
      insert into public.seats (id, floor, row_label, row_index, num, block) values (r || '-' || n, 1, r::text, r, n, b);
    end loop;
    if r = 1 then
      insert into public.seats (id, floor, row_label, row_index, num, block, wheelchair) values ('1-W1', 1, '1', 1, 0, 4, true), ('1-W2', 1, '1', 1, 0, 4, true);
    end if;
  end loop;
  for r in 1..7 loop
    for n in 1..30 loop
      if r in (4, 5) and (n < 3 or n > 28) then continue; end if;
      if r = 6 and (n < 2 or n > 29) then continue; end if;
      insert into public.seats (id, floor, row_label, row_index, num, block) values ('c' || r || '-' || n, 2, 'c' || r, r, n, (n - 1) / 10 + 1);
    end loop;
  end loop;
end $$;

-- per-seat assignments replace the old block/range table
drop table if exists public.seat_assignments;
drop table if exists public.seat_cursors;
drop function if exists public.assign_seat(uuid, int);
drop function if exists public.seat_label(text, int, int);
create table public.seat_assignments (
  seat_id text primary key references public.seats (id),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles (id),
  manual boolean not null default false
);
create index seat_assignments_reservation_idx on public.seat_assignments (reservation_id);

-- "1층 3열 1–3번 · 2층 c2열 11번"
create or replace function public.seat_label_for(p_reservation_id uuid) returns text
language plpgsql stable as $$
declare v_out text := ''; g record; nums int[]; spans text[]; i int; j int; part text;
begin
  for g in
    select s.floor, s.row_label, s.row_index,
           array_agg(s.num order by s.num) filter (where not s.wheelchair) as nums,
           count(*) filter (where s.wheelchair) as wc
    from public.seat_assignments a join public.seats s on s.id = a.seat_id
    where a.reservation_id = p_reservation_id
    group by s.floor, s.row_label, s.row_index order by s.floor, s.row_index
  loop
    spans := '{}'; nums := coalesce(g.nums, '{}');
    i := 1;
    while i <= coalesce(array_length(nums, 1), 0) loop
      j := i;
      while j + 1 <= array_length(nums, 1) and nums[j + 1] = nums[j] + 1 loop j := j + 1; end loop;
      spans := spans || (case when j > i then nums[i] || '–' || nums[j] else nums[i]::text end);
      i := j + 1;
    end loop;
    part := g.floor || '층 ' || g.row_label || '열 ' ||
            concat_ws(' ', case when array_length(spans, 1) > 0 then array_to_string(spans, ',') || '번' end,
                           case when g.wc > 0 then '휠체어석' || case when g.wc > 1 then ' ' || g.wc else '' end end);
    v_out := v_out || case when v_out = '' then '' else ' · ' end || part;
  end loop;
  return nullif(v_out, '');
end $$;

-- ---------- confirmed shuttle ----------
update public.shuttle_runs set active = false;
insert into public.shuttle_runs (direction, departs_at, label, active) values
  ('outbound', '10:00', '10:00', true), ('outbound', '10:50', '10:50', true), ('outbound', '11:40', '11:40', true),
  ('outbound', '12:30', '12:30', true), ('outbound', '13:20', '13:20', true), ('outbound', '14:10', '14:10', true),
  ('outbound', '15:00', '15:00', true), ('return', '16:15', '16:15', true), ('return', '17:00', '17:00', true)
on conflict (direction, departs_at) do update set active = true, label = excluded.label;

-- ---------- reservation creation (no seat; dedupe; attendance) ----------
create or replace function public.create_reservation(payload jsonb, token_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_code text; v_seq bigint; v_party int; v_out uuid; v_ret uuid; m jsonb; i int := 0;
  v_event_date date := coalesce((select (value ->> 0)::date from public.event_config where key = 'event_date'), current_date);
begin
  v_party := 1 + coalesce(jsonb_array_length(payload -> 'members'), 0);
  if exists (select 1 from public.reservations where status = 'active' and applicant_name = payload ->> 'applicantName' and phone = payload ->> 'phone') then
    raise exception 'duplicate' using errcode = 'P0002';
  end if;
  v_seq := nextval('public.reservation_code_seq');
  v_code := to_char(v_event_date, 'YYMMDD') || '-' || coalesce(nullif(payload ->> 'districtCode', ''), '00') || '-' || lpad((v_seq % 1000)::text, 3, '0');
  select id into v_out from public.shuttle_runs where direction = 'outbound' and label = payload ->> 'outboundRun' and active;
  select id into v_ret from public.shuttle_runs where direction = 'return' and label = payload ->> 'returnRun' and active;

  insert into public.reservations (
    code, kind, applicant_name, phone, district_code, inviter_name, age_group, party_size, transport,
    outbound_run_id, return_run_id, vehicle_plate, mobility_support, mobility_note, dietary_note,
    privacy_consent, contact_consent, attendance, worship_service, worship_site, source)
  values (
    v_code, (payload ->> 'kind')::public.reservation_kind, payload ->> 'applicantName', payload ->> 'phone',
    nullif(payload ->> 'districtCode', ''), nullif(payload ->> 'inviterName', ''), nullif(payload ->> 'ageGroup', ''), v_party,
    (payload ->> 'transport')::public.transport_kind, v_out, v_ret, nullif(payload ->> 'vehiclePlate', ''),
    coalesce((payload ->> 'mobilitySupport')::boolean, false), nullif(payload ->> 'mobilityNote', ''), nullif(payload ->> 'dietaryNote', ''),
    coalesce((payload ->> 'privacyConsent')::boolean, false), coalesce((payload ->> 'contactConsent')::boolean, false),
    coalesce(nullif(payload ->> 'attendance', ''), 'main'), nullif(payload ->> 'worshipService', '')::smallint,
    nullif(payload ->> 'worshipSite', ''), coalesce(nullif(payload ->> 'source', ''), 'web'))
  returning id into v_id;

  for m in select * from jsonb_array_elements(coalesce(payload -> 'members', '[]'::jsonb)) loop
    i := i + 1;
    insert into public.reservation_members (reservation_id, position, name, relation, age_group, dietary_note)
    values (v_id, i, m ->> 'name', nullif(m ->> 'relation', ''), nullif(m ->> 'ageGroup', ''), nullif(m ->> 'dietaryNote', ''));
  end loop;

  insert into public.passes (reservation_id, token_hash) values (v_id, token_hash);
  return jsonb_build_object('reservation_id', v_id, 'code', v_code, 'party_size', v_party);
end $$;

-- Excel / hand-written sign-ups: an admin creates reservations through the same path.
create or replace function public.admin_create_reservation(payload jsonb, token_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role('admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  return public.create_reservation(payload || jsonb_build_object('source', 'import'), token_hash);
end $$;

-- Which of the given {name, phone} pairs already exist (import preview)
create or replace function public.find_duplicates(p_rows jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role('admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('name', x.name, 'phone', x.phone, 'code', r.code))
    from jsonb_to_recordset(p_rows) as x(name text, phone text)
    join public.reservations r on r.status = 'active' and r.applicant_name = x.name and r.phone = x.phone), '[]'::jsonb);
end $$;

-- ---------- read models ----------
create or replace function public.lookup_pass(p_token_hash text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'code', r.code, 'applicant_name', r.applicant_name, 'kind', r.kind, 'inviter_name', r.inviter_name,
    'district_label', case when r.district_code is null then null else public.district_label(r.district_code) end,
    'party_size', r.party_size, 'guest_count', r.party_size - 1,
    'seat_label', public.seat_label_for(r.id),
    'transport', r.transport,
    'outbound_label', (select label from public.shuttle_runs where id = r.outbound_run_id),
    'return_label', (select label from public.shuttle_runs where id = r.return_run_id),
    'mobility_support', r.mobility_support, 'has_dietary_note', public.dietary_rollup(r.id, r.dietary_note) is not null,
    'vehicle_plate', r.vehicle_plate, 'issued_at', p.issued_at,
    'attendance', r.attendance, 'worship_service', r.worship_service, 'worship_site', r.worship_site,
    'checked_in', exists (select 1 from public.checkins c where c.reservation_id = r.id and c.voided_at is null))
  from public.passes p join public.reservations r on r.id = p.reservation_id
  where p.token_hash = p_token_hash and p.revoked_at is null and r.status = 'active';
$$;

create or replace function public.reservation_summary_json(r public.reservations) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', r.id, 'code', r.code, 'applicant_name', r.applicant_name, 'kind', r.kind,
    'district_code', r.district_code,
    'district_label', case when r.district_code is null then null else public.district_label(r.district_code) end,
    'party_size', r.party_size, 'guest_count', r.party_size - 1,
    'seat_label', public.seat_label_for(r.id),
    'seat_ids', (select coalesce(jsonb_agg(a.seat_id order by a.seat_id), '[]'::jsonb) from public.seat_assignments a where a.reservation_id = r.id),
    'transport', r.transport,
    'outbound_label', (select label from public.shuttle_runs where id = r.outbound_run_id),
    'return_label', (select label from public.shuttle_runs where id = r.return_run_id),
    'mobility_support', r.mobility_support, 'mobility_note', r.mobility_note,
    'dietary_note', public.dietary_rollup(r.id, r.dietary_note),
    'vehicle_plate', r.vehicle_plate,
    'attendance', r.attendance, 'worship_service', r.worship_service, 'worship_site', r.worship_site, 'source', r.source,
    'checkin', (select jsonb_build_object('id', c.id, 'arrived_count', c.arrived_count, 'station_name', st.name, 'checked_in_at', c.checked_in_at)
                from public.checkins c join public.stations st on st.id = c.station_id
                where c.reservation_id = r.id and c.voided_at is null));
$$;

-- Whole chart with who sits where (staff see codes and names: they usher people).
create or replace function public.seat_map() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role('staff', 'desk', 'admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', s.id, 'floor', s.floor, 'row', s.row_label, 'rowIndex', s.row_index, 'num', s.num,
                                        'block', s.block, 'wheelchair', s.wheelchair,
                                        'reservation_id', a.reservation_id, 'code', r.code, 'name', r.applicant_name)
                     order by s.floor, s.row_index, s.num)
    from public.seats s left join public.seat_assignments a on a.seat_id = s.id left join public.reservations r on r.id = a.reservation_id), '[]'::jsonb);
end $$;

-- Assign (or re-assign) a party's seats. Seats must be free or already this party's.
create or replace function public.reassign_seats(p_reservation_id uuid, p_seat_ids text[], p_manual boolean default true) returns text
language plpgsql security definer set search_path = public as $$
declare v_clash text;
begin
  if not public.has_role('staff', 'admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  perform 1 from public.seats where id = any (p_seat_ids) for update;
  select string_agg(a.seat_id, ', ') into v_clash from public.seat_assignments a
   where a.seat_id = any (p_seat_ids) and a.reservation_id <> p_reservation_id;
  if v_clash is not null then raise exception '이미 배정된 좌석입니다: %', v_clash using errcode = 'P0003'; end if;
  delete from public.seat_assignments where reservation_id = p_reservation_id;
  insert into public.seat_assignments (seat_id, reservation_id, assigned_by, manual)
  select unnest(p_seat_ids), p_reservation_id, auth.uid(), p_manual;
  return public.seat_label_for(p_reservation_id);
end $$;

-- THE ONE WRITE PATH for attendance, now also the moment seats are assigned.
drop function if exists public.perform_checkin(uuid, text, int, text, jsonb);
create or replace function public.perform_checkin(
  p_reservation_id uuid, p_station_code text, p_arrived_count int, p_method text,
  p_distributions jsonb default '{}'::jsonb, p_seat_ids text[] default null, p_manual boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_station uuid; v_existing public.checkins; v_id uuid; v_name text; v_seat text; k text; v int;
begin
  if not public.has_role('staff', 'admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  select id into v_station from public.stations where code = p_station_code;
  if v_station is null then raise exception 'unknown station %', p_station_code; end if;
  select applicant_name into v_name from public.reservations where id = p_reservation_id and status = 'active';
  if v_name is null then raise exception 'unknown reservation'; end if;

  select * into v_existing from public.checkins where reservation_id = p_reservation_id and voided_at is null;
  if found then
    return jsonb_build_object('already', true, 'checkin_id', v_existing.id, 'arrived_count', v_existing.arrived_count,
      'station_name', (select name from public.stations where id = v_existing.station_id),
      'checked_in_at', v_existing.checked_in_at, 'applicant_name', v_name, 'seat_label', public.seat_label_for(p_reservation_id));
  end if;

  if p_seat_ids is not null and array_length(p_seat_ids, 1) > 0 then
    v_seat := public.reassign_seats(p_reservation_id, p_seat_ids, p_manual);
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

-- ---------- parking desk ----------
create table if not exists public.parking_state (
  id smallint primary key default 1 check (id = 1),
  capacity int not null default 80,
  occupied int not null default 0 check (occupied >= 0),
  updated_at timestamptz not null default now()
);
insert into public.parking_state (id) values (1) on conflict (id) do nothing;
create table if not exists public.vip_arrivals (
  reservation_id uuid primary key references public.reservations (id) on delete cascade,
  arrived_at timestamptz not null default now(),
  staff_id uuid references public.profiles (id)
);
alter table public.seats enable row level security;
alter table public.seat_assignments enable row level security;
alter table public.parking_state enable row level security;
alter table public.vip_arrivals enable row level security;
create policy "ops reads seats" on public.seats for select to authenticated using (public.has_role('staff', 'desk', 'admin'));
create policy "ops reads seat assignments" on public.seat_assignments for select to authenticated using (public.has_role('staff', 'desk', 'admin'));
create policy "ops reads parking" on public.parking_state for select to authenticated using (public.has_role('staff', 'desk', 'admin'));
create policy "ops reads vip" on public.vip_arrivals for select to authenticated using (public.has_role('staff', 'desk', 'admin'));

create or replace function public.parking_adjust(p_delta int, p_capacity int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role('staff', 'desk', 'admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.parking_state set occupied = greatest(0, occupied + coalesce(p_delta, 0)),
         capacity = coalesce(p_capacity, capacity), updated_at = now() where id = 1;
  return (select jsonb_build_object('capacity', capacity, 'occupied', occupied, 'free', capacity - occupied) from public.parking_state where id = 1);
end $$;

-- Every party that told us a plate. `vip` = invited guests (or hosts bringing guests).
create or replace function public.parking_board() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role('staff', 'desk', 'admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'state', (select jsonb_build_object('capacity', capacity, 'occupied', occupied, 'free', capacity - occupied) from public.parking_state where id = 1),
    'vehicles', coalesce((
      select jsonb_agg(jsonb_build_object('reservation_id', r.id, 'code', r.code, 'name', r.applicant_name, 'plate', r.vehicle_plate,
                                          'party_size', r.party_size, 'vip', (r.kind = 'guest_self' or r.party_size > 1),
                                          'district_label', case when r.district_code is null then null else public.district_label(r.district_code) end,
                                          'arrived_at', v.arrived_at,
                                          'checked_in', exists (select 1 from public.checkins c where c.reservation_id = r.id and c.voided_at is null))
                       order by (v.arrived_at is null) desc, r.applicant_name)
      from public.reservations r left join public.vip_arrivals v on v.reservation_id = r.id
      where r.status = 'active' and r.vehicle_plate is not null and r.vehicle_plate <> ''), '[]'::jsonb));
end $$;

create or replace function public.vip_mark(p_reservation_id uuid, p_arrived boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role('staff', 'desk', 'admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_arrived then
    insert into public.vip_arrivals (reservation_id, staff_id) values (p_reservation_id, auth.uid()) on conflict (reservation_id) do nothing;
  else
    delete from public.vip_arrivals where reservation_id = p_reservation_id;
  end if;
end $$;

-- ---------- stats: attendance split ----------
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
      'main_people', (select coalesce(sum(party_size), 0) from r where attendance = 'main'),
      'worship_people', (select coalesce(sum(party_size), 0) from r where attendance = 'worship'),
      'checked_in_parties', (select count(*) from c),
      'checked_in_people', (select coalesce(sum(arrived_count), 0) from c),
      'seated_people', (select count(*) from public.seat_assignments),
      'contact_consent_people', (select coalesce(sum(party_size), 0) from r where contact_consent),
      'mobility_parties', (select count(*) from r where mobility_support),
      'dietary_parties', (select count(*) from r where dietary_note is not null),
      'by_district', (select coalesce(jsonb_agg(jsonb_build_object('label', d, 'people', p, 'arrived', a) order by p desc), '[]'::jsonb)
        from (select public.district_label(r.district_code) d, sum(r.party_size) p, coalesce(sum(c.arrived_count), 0) a
              from r left join c on c.reservation_id = r.id group by 1) x),
      'by_run', (select coalesce(jsonb_agg(jsonb_build_object('label', coalesce(s.label, '개인 차량'), 'people', x.p) order by s.label nulls last), '[]'::jsonb)
        from (select outbound_run_id, sum(party_size) p from r group by 1) x left join public.shuttle_runs s on s.id = x.outbound_run_id),
      'by_return', (select coalesce(jsonb_agg(jsonb_build_object('label', s.label, 'people', x.p) order by s.label), '[]'::jsonb)
        from (select return_run_id, sum(party_size) p from r where return_run_id is not null group by 1) x join public.shuttle_runs s on s.id = x.return_run_id),
      'by_worship', (select coalesce(jsonb_agg(jsonb_build_object('service', worship_service, 'site', worship_site, 'people', p) order by worship_site, worship_service), '[]'::jsonb)
        from (select worship_service, worship_site, sum(party_size) p from r where attendance = 'worship' group by 1, 2) x),
      'by_station', (select coalesce(jsonb_agg(jsonb_build_object('name', st.name, 'arrived', coalesce(x.a, 0)) order by st.code), '[]'::jsonb)
        from public.stations st left join (select station_id, sum(arrived_count) a from c group by 1) x on x.station_id = st.id)
    ));
end $$;

-- ---------- privileges & realtime ----------
grant execute on function public.seat_map(), public.reassign_seats(uuid, text[], boolean),
  public.perform_checkin(uuid, text, int, text, jsonb, text[], boolean), public.parking_adjust(int, int),
  public.parking_board(), public.vip_mark(uuid, boolean), public.admin_create_reservation(jsonb, text),
  public.find_duplicates(jsonb), public.seat_label_for(uuid) to authenticated;
grant execute on function public.seat_label_for(uuid), public.create_reservation(jsonb, text), public.lookup_pass(text) to service_role;
revoke execute on function public.create_reservation(jsonb, text) from authenticated;
revoke execute on function public.lookup_pass(text) from authenticated;
alter publication supabase_realtime add table public.parking_state;
alter publication supabase_realtime add table public.vip_arrivals;
alter publication supabase_realtime add table public.seat_assignments;
