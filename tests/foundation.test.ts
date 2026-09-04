import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { SCENE_ORDER } from "@fil/domain";

const routes = [
  "apps/web/src/app/page.tsx", "apps/web/src/app/apply/page.tsx", "apps/web/src/app/pass/[token]/page.tsx",
  "apps/web/src/app/one-more-song/page.tsx", "apps/web/src/app/api/reservations/route.ts",
  "apps/ops/src/app/login/page.tsx", "apps/ops/src/app/scan/page.tsx", "apps/ops/src/app/desk/page.tsx",
  "apps/ops/src/app/display/page.tsx", "apps/ops/src/app/admin/page.tsx", "apps/ops/src/proxy.ts",
];

test("public and operations entry routes exist and stay separate", async () => {
  await Promise.all(routes.map((p) => access(new URL(`../${p}`, import.meta.url))));
  const web = await readFile(new URL("../apps/web/src/components/site-sections.tsx", import.meta.url), "utf8");
  assert.ok(!/\/(scan|desk|admin)\b/.test(web), "public site must not link to operations");
});

test("scene config keeps the approved seven-scene order", async () => {
  const src = await readFile(new URL("../apps/web/src/config/scenes.ts", import.meta.url), "utf8");
  const ids = [...src.matchAll(/^\s+id: "([a-z-]+)"/gm)].map((m) => m[1]);
  assert.deepEqual(ids, [...SCENE_ORDER]);
});

test("operations app is never indexed and every page is guarded", async () => {
  const layout = await readFile(new URL("../apps/ops/src/app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /robots:\s*\{\s*index:\s*false/);
  for (const p of ["scan", "desk", "display", "admin"]) {
    const src = await readFile(new URL(`../apps/ops/src/app/${p}/page.tsx`, import.meta.url), "utf8");
    assert.match(src, /requireRole\(/, `${p} page must call requireRole`);
  }
});

test("secret key never reaches client components", async () => {
  const files = ["apps/web/src/components/cinematic-world.tsx", "apps/web/src/components/reservation-form.tsx", "apps/ops/src/app/scan/scan-console.tsx", "apps/ops/src/app/display/welcome-display.tsx"];
  for (const f of files) {
    const src = await readFile(new URL(`../${f}`, import.meta.url), "utf8");
    assert.ok(!src.includes("SUPABASE_SECRET_KEY") && !src.includes("createAdminSupabaseClient"), f);
  }
});
