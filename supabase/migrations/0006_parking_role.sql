-- 0006 (2026-09-28): a "parking" role for the car-park team — it sees ONLY the parking desk.
-- Landing screens by role: admin → 관리자, staff → 스캔·체크인, desk → 웰컴 데스크, parking → 주차 관리.
--
-- The new enum value cannot be USED in the same transaction that adds it, so everything below
-- compares roles as TEXT (has_any_role) instead of casting 'parking'::staff_role.
alter type public.staff_role add value if not exists 'parking';

create or replace function public.has_any_role(variadic wanted text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_roles r where r.profile_id = auth.uid() and r.role::text = any (wanted));
$$;
grant execute on function public.has_any_role(text[]) to authenticated;

-- parking desk: + parking
create or replace function public.parking_adjust(p_delta int, p_capacity int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_any_role('staff', 'desk', 'admin', 'parking') then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.parking_state set occupied = greatest(0, occupied + coalesce(p_delta, 0)),
         capacity = coalesce(p_capacity, capacity), updated_at = now() where id = 1;
  return (select jsonb_build_object('capacity', capacity, 'occupied', occupied, 'free', capacity - occupied) from public.parking_state where id = 1);
end $$;

create or replace function public.parking_board() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_any_role('staff', 'desk', 'admin', 'parking') then raise exception 'forbidden' using errcode = '42501'; end if;
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
  if not public.has_any_role('staff', 'desk', 'admin', 'parking') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_arrived then
    insert into public.vip_arrivals (reservation_id, staff_id) values (p_reservation_id, auth.uid()) on conflict (reservation_id) do nothing;
  else
    delete from public.vip_arrivals where reservation_id = p_reservation_id;
  end if;
end $$;

-- realtime on the parking desk reads these two tables through RLS
drop policy if exists "ops reads parking" on public.parking_state;
create policy "ops reads parking" on public.parking_state for select to authenticated using (public.has_any_role('staff', 'desk', 'admin', 'parking'));
drop policy if exists "ops reads vip" on public.vip_arrivals;
create policy "ops reads vip" on public.vip_arrivals for select to authenticated using (public.has_any_role('staff', 'desk', 'admin', 'parking'));

-- check: should list admin, desk, parking, staff
select unnest(enum_range(null::public.staff_role))::text as roles;
