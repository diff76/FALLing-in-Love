-- 0006a (2026-09-28): STEP 1 of 2 — run this file ALONE first.
-- Adds the "parking" role (car-park team: sees only 주차 관리). PostgreSQL only lets a new
-- enum value be used after the statement that adds it has been committed, so the functions
-- and policies that use it live in 0006b_parking_role.sql — run that one second.
alter type public.staff_role add value if not exists 'parking';
