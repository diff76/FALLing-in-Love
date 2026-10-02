-- 0008 (2026-10-02): parties checked in at 창동 THE GATE ride the shuttle and arrive on campus later.
--  * checkins.arrived_at / arrived_station_id: when and where a gate check-in reached the campus
--    (THE LANDING or the chapel). Null = still travelling. Check-ins made on campus leave them null.
--  * campus_arrival(): the campus scan desk records that arrival, can correct the head count once
--    (someone joined or dropped out on the way), and the lobby display greets them at that moment.
-- Run once in the SQL Editor.

alter table public.checkins add column if not exists arrived_at timestamptz;
alter table public.checkins add column if not exists arrived_station_id uuid references public.stations (id);

create or replace function public.campus_arrival(p_checkin_id uuid, p_station_code text, p_arrived_count int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_station uuid; v_ck public.checkins; v_party int;
begin
  if not public.has_any_role('staff', 'admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  select id into v_station from public.stations where code = p_station_code and code <> 'gate';
  if v_station is null then raise exception '캠퍼스 스테이션(THE LANDING · 채플)에서만 도착을 기록할 수 있습니다'; end if;
  select * into v_ck from public.checkins where id = p_checkin_id and voided_at is null for update;
  if v_ck.id is null then raise exception 'unknown check-in'; end if;
  select party_size into v_party from public.reservations where id = v_ck.reservation_id;
  update public.checkins set
    arrived_at = coalesce(arrived_at, now()),
    arrived_station_id = coalesce(arrived_station_id, v_station),
    arrived_count = case when p_arrived_count is null then arrived_count else greatest(0, least(p_arrived_count, v_party)) end
  where id = p_checkin_id
  returning * into v_ck;
  return jsonb_build_object('arrived_at', v_ck.arrived_at, 'arrived_count', v_ck.arrived_count);
end $$;

grant execute on function public.campus_arrival(uuid, text, int) to authenticated;

-- check: both columns and the function
select column_name from information_schema.columns where table_name = 'checkins' and column_name in ('arrived_at', 'arrived_station_id')
union all select proname::text from pg_proc where proname = 'campus_arrival';
