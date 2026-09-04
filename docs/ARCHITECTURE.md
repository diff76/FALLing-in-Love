# Architecture

## Shape
- npm workspaces. Two Next.js 16 apps (`web`, `ops`) share only `@fil/config`, `@fil/domain`, `@fil/supabase`.
- No separate backend. Public writes go through a Route Handler (`/api/reservations`) that validates with zod and calls a `security definer` RPC using the server-only secret key. Ops screens use Server Actions and the cookie-bound Supabase client; Postgres (RLS + role checks inside every RPC) is the real authorization layer.
- `output: "standalone"` + `Dockerfile` keep hosting portable. First target: two Vercel projects on separate domains; Docker hosts work unchanged.

## Boundaries
- The cinematic engine (`apps/web/src/lib/scroll-world/scrub-engine.js`, vendored from scroll-world v0.8.0 with three local patches: page-offset scroll math, an idle class while outside the world, and a real ES `export`) owns only the `#world` container. Scene copy, pacing and media paths live in `apps/web/src/config/scenes.ts` + `media-manifest.json`.
- `assignSeat` (SQL) is the only seat rule; `perform_checkin` (SQL) is the only attendance write. TypeScript mirrors in `@fil/domain` exist for tests and previews.
- The public app never links to ops; the ops app is `noindex` and every page calls `requireRole`.

## Data flow
```
guest → /apply → POST /api/reservations → create_reservation() → reservations/members/seat/pass
staff → /scan → find_reservations() | lookup_reservation_by_pass() → perform_checkin() → checkins
checkins INSERT → Realtime → desk (refresh) · display (welcome) · admin (refresh)
```

## Environment
`.env.example`. Secret key only in server contexts; `createAdminSupabaseClient` throws in the browser.
