-- 0007 (2026-10-01): scan-desk helpers that staff accounts need but cannot do through RLS.
--  1) items already handed out at a check-in, and adding the ones that were missed on a re-scan
--  2) the return-shuttle desk: seats per run (capacity − booked) and booking / changing / cancelling
-- Every function checks the caller's role itself (security definer). Run once in the SQL Editor.

-- ---------- 1) hospitality items on re-scan ----------
create or replace function public.checkin_items(p_checkin_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_any_role('staff', 'desk', 'admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_object_agg(i.code, d.qty)
    from public.hospitality_distributions d join public.hospitality_items i on i.id = d.item_id
    where d.checkin_id = p_checkin_id and d.qty > 0), '{}'::jsonb);
end $$;

-- p_items = {"stamp": 2, "pouch": 2, ...}; items already given at this check-in are left as they are
create or replace function public.add_checkin_items(p_checkin_id uuid, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k text; v int;
begin
  if not public.has_any_role('staff', 'admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.checkins where id = p_checkin_id and voided_at is null) then raise exception 'unknown check-in'; end if;
  for k, v in select key, (value)::int from jsonb_each_text(coalesce(p_items, '{}'::jsonb)) loop
    if v > 0 then
      insert into public.hospitality_distributions (checkin_id, item_id, qty)
      select p_checkin_id, i.id, v from public.hospitality_items i
      where i.code = k
        and not exists (select 1 from public.hospitality_distributions d where d.checkin_id = p_checkin_id and d.item_id = i.id);
    end if;
  end loop;
  return public.checkin_items(p_checkin_id);
end $$;

-- ---------- 2) return shuttle desk ----------
-- one row per active return run: seats = capacity (one bus), booked = people on active sign-ups
create or replace function public.return_board() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_any_role('staff', 'desk', 'admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', s.id, 'label', s.label, 'capacity', coalesce(s.capacity, 25),
             'booked', coalesce(b.people, 0), 'available', greatest(coalesce(s.capacity, 25) - coalesce(b.people, 0), 0)) order by s.departs_at)
    from public.shuttle_runs s
    left join (select return_run_id, sum(party_size) people from public.reservations where status = 'active' and return_run_id is not null group by 1) b
      on b.return_run_id = s.id
    where s.direction = 'return' and s.active), '[]'::jsonb);
end $$;

-- book (or move) a party onto a return run, or cancel with p_run_id = null; refuses when the bus is full
create or replace function public.book_return(p_reservation_id uuid, p_run_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_party int; v_cap int; v_booked int;
begin
  if not public.has_any_role('staff', 'admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  select party_size into v_party from public.reservations where id = p_reservation_id and status = 'active';
  if v_party is null then raise exception 'unknown reservation'; end if;
  if p_run_id is not null then
    select coalesce(capacity, 25) into v_cap from public.shuttle_runs where id = p_run_id and direction = 'return' and active for update;
    if v_cap is null then raise exception 'unknown return run'; end if;
    select coalesce(sum(party_size), 0) into v_booked from public.reservations
      where status = 'active' and return_run_id = p_run_id and id <> p_reservation_id;
    if v_booked + v_party > v_cap then
      raise exception '좌석이 부족합니다 (남은 좌석 %석, 필요 %석)', greatest(v_cap - v_booked, 0), v_party using errcode = 'P0004';
    end if;
  end if;
  update public.reservations set return_run_id = p_run_id where id = p_reservation_id;
  return public.return_board();
end $$;

grant execute on function public.checkin_items(uuid), public.add_checkin_items(uuid, jsonb),
  public.return_board(), public.book_return(uuid, uuid) to authenticated;

-- check: should list the four functions
select proname from pg_proc where proname in ('checkin_items', 'add_checkin_items', 'return_board', 'book_return') order by 1;
