-- 0010 (2026-10-05): change a sign-up after it was made.
--  * update_reservation(): rewrites one active reservation (and its companions) from the same payload the
--    sign-up form sends. The ticket number and the Pass link stay the same.
--    - web edits (p_admin = false): refused once the party has checked in; the shuttle buses are locked and
--      re-counted without this party's own seats, exactly like a new sign-up (errcode P0005 / P0006)
--    - admin edits from ops (p_admin = true): allowed after check-in and may knowingly exceed a bus
--    - the phone number must stay unique among active sign-ups (P0002)
--  Only the server (service role) may call it: the web API checks the Pass link or name + phone first,
--  and ops checks the admin role first.
-- Run once in the SQL Editor.

create or replace function public.update_reservation(p_id uuid, payload jsonb, p_admin boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_old public.reservations; v_party int; v_out uuid; v_ret uuid; v_cap int; v_booked int; m jsonb; i int := 0;
begin
  select * into v_old from public.reservations where id = p_id and status = 'active' for update;
  if v_old.id is null then raise exception 'unknown_reservation' using errcode = 'P0007'; end if;
  if not p_admin and exists (select 1 from public.checkins where reservation_id = p_id and voided_at is null) then
    raise exception 'checked_in' using errcode = 'P0008';
  end if;
  if exists (select 1 from public.reservations where status = 'active' and id <> p_id and phone = payload ->> 'phone') then
    raise exception 'duplicate' using errcode = 'P0002';
  end if;

  v_party := 1 + coalesce(jsonb_array_length(payload -> 'members'), 0);
  select id into v_out from public.shuttle_runs where direction = 'outbound' and label = payload ->> 'outboundRun' and active;
  select id into v_ret from public.shuttle_runs where direction = 'return' and label = payload ->> 'returnRun' and active;

  -- seats on the chosen buses, not counting this party's current booking (same lock order as create_reservation)
  if not p_admin and v_out is not null then
    select coalesce(capacity, 25) into v_cap from public.shuttle_runs where id = v_out for update;
    select coalesce(sum(party_size), 0) into v_booked from public.reservations where status = 'active' and outbound_run_id = v_out and id <> p_id;
    if v_booked + v_party > v_cap then raise exception 'outbound_full:%', greatest(v_cap - v_booked, 0) using errcode = 'P0005'; end if;
  end if;
  if not p_admin and v_ret is not null then
    select coalesce(capacity, 25) into v_cap from public.shuttle_runs where id = v_ret for update;
    select coalesce(sum(party_size), 0) into v_booked from public.reservations where status = 'active' and return_run_id = v_ret and id <> p_id;
    if v_booked + v_party > v_cap then raise exception 'return_full:%', greatest(v_cap - v_booked, 0) using errcode = 'P0006'; end if;
  end if;

  update public.reservations set
    kind = (payload ->> 'kind')::public.reservation_kind,
    applicant_name = payload ->> 'applicantName',
    phone = payload ->> 'phone',
    district_code = nullif(payload ->> 'districtCode', ''),
    inviter_name = nullif(payload ->> 'inviterName', ''),
    age_group = nullif(payload ->> 'ageGroup', ''),
    party_size = v_party,
    transport = (payload ->> 'transport')::public.transport_kind,
    outbound_run_id = v_out,
    return_run_id = v_ret,
    vehicle_plate = nullif(payload ->> 'vehiclePlate', ''),
    mobility_support = coalesce((payload ->> 'mobilitySupport')::boolean, false),
    mobility_note = nullif(payload ->> 'mobilityNote', ''),
    dietary_note = nullif(payload ->> 'dietaryNote', ''),
    contact_consent = coalesce((payload ->> 'contactConsent')::boolean, false),
    attendance = coalesce(nullif(payload ->> 'attendance', ''), 'main'),
    worship_service = nullif(payload ->> 'worshipService', '')::smallint,
    worship_site = nullif(payload ->> 'worshipSite', ''),
    updated_at = now()
  where id = p_id;

  delete from public.reservation_members where reservation_id = p_id;
  for m in select * from jsonb_array_elements(coalesce(payload -> 'members', '[]'::jsonb)) loop
    i := i + 1;
    insert into public.reservation_members (reservation_id, position, name, relation, age_group, dietary_note)
    values (p_id, i, m ->> 'name', nullif(m ->> 'relation', ''), nullif(m ->> 'ageGroup', ''), nullif(m ->> 'dietaryNote', ''));
  end loop;

  return jsonb_build_object('reservation_id', p_id, 'code', v_old.code, 'party_size', v_party);
end $$;

revoke execute on function public.update_reservation(uuid, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.update_reservation(uuid, jsonb, boolean) to service_role;

-- check: the function exists (and only the server can call it)
select proname, has_function_privilege('anon', oid, 'execute') as anon_can_call
from pg_proc where proname = 'update_reservation';
