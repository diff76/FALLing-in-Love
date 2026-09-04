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
