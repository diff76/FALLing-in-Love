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
