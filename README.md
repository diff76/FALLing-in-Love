# FALLing in Love — 2026 온출전 event platform

One event, one Supabase data system, two front doors:

- `apps/web` — the public, cinematic invitation (`/`, `/apply`, `/pass/[token]`, `/one-more-song`) on port 3000
- `apps/ops` — the private operations app (`/login`, `/scan`, `/desk`, `/display`, `/admin`) on port 3001
- `packages/config` — event constants · `packages/domain` — types, validation, service boundaries · `packages/supabase` — clients and DB types
- `supabase/` — schema migration, seed, setup notes · `media/` — scroll-world prompts, pipeline scripts, anchor renders · `docs/` — design and decisions

## Run

```bash
npm install
npm run dev:web
npm run dev:ops
```

Rendering the public site needs no Supabase credentials. Reservation writes, the pass page and every operations screen activate when `.env.local` (see `.env.example`) points at a project with `supabase/migrations/0001_init.sql` applied.

## Verify

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

## Media

Posters under `apps/web/public/media/scenes` are temporary plates from campus photographs. The clay-diorama scroll-world chain (stills → dives → connectors → encodes) lands in `apps/web/public/media/clips`; run `npm run media:manifest` afterwards and the scenes pick the clips up without code changes. See `docs/MEDIA_PIPELINE.md`.
