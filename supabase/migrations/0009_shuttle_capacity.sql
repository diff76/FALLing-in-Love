-- 0009 (2026-10-04): every shuttle run is one 25-seat bus, outbound (창동 → 한신, every 30 min) and return.
--  * capacity 25 on every run that has none yet (admins change it per run in ops)
--  * create_reservation(): a web sign-up is refused when its outbound or return bus has too few seats
--    left (the run row is locked, so two people can never both take the last seats). Imports by an
--    admin (source = 'import') are not blocked — staff may knowingly add a seat on the day.
--  (The form's "남은 N석" comes from the web server, which counts with its own server key.)
-- Run once in the SQL Editor.

update public.shuttle_runs set capacity = 25 where capacity is null;

create or replace function public.create_reservation(payload jsonb, token_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_code text; v_seq bigint; v_party int; v_out uuid; v_ret uuid; m jsonb; i int := 0;
  v_cap int; v_booked int; v_web boolean := coalesce(nullif(payload ->> 'source', ''), 'web') <> 'import';
  v_event_date date := coalesce((select (value ->> 0)::date from public.event_config where key = 'event_date'), current_date);
begin
  v_party := 1 + coalesce(jsonb_array_length(payload -> 'members'), 0);
  if exists (select 1 from public.reservations where status = 'active' and applicant_name = payload ->> 'applicantName' and phone = payload ->> 'phone') then
    raise exception 'duplicate' using errcode = 'P0002';
  end if;
  select id into v_out from public.shuttle_runs where direction = 'outbound' and label = payload ->> 'outboundRun' and active;
  select id into v_ret from public.shuttle_runs where direction = 'return' and label = payload ->> 'returnRun' and active;

  -- seats: lock the bus rows (outbound first, then return — always the same order), then count
  if v_web and v_out is not null then
    select coalesce(capacity, 25) into v_cap from public.shuttle_runs where id = v_out for update;
    select coalesce(sum(party_size), 0) into v_booked from public.reservations where status = 'active' and outbound_run_id = v_out;
    if v_booked + v_party > v_cap then
      raise exception 'outbound_full:%', greatest(v_cap - v_booked, 0) using errcode = 'P0005';
    end if;
  end if;
  if v_web and v_ret is not null then
    select coalesce(capacity, 25) into v_cap from public.shuttle_runs where id = v_ret for update;
    select coalesce(sum(party_size), 0) into v_booked from public.reservations where status = 'active' and return_run_id = v_ret;
    if v_booked + v_party > v_cap then
      raise exception 'return_full:%', greatest(v_cap - v_booked, 0) using errcode = 'P0006';
    end if;
  end if;

  v_seq := nextval('public.reservation_code_seq');
  v_code := to_char(v_event_date, 'YYMMDD') || '-' || coalesce(nullif(payload ->> 'districtCode', ''), '00') || '-' || lpad((v_seq % 1000)::text, 3, '0');

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

-- check: 11 outbound + 4 return runs, all with 25 seats
select direction, count(*) as runs, min(capacity) as min_seats, max(capacity) as max_seats from public.shuttle_runs where active group by direction;
