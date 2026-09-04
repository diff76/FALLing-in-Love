import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  { settings: { next: { rootDir: ["apps/web/", "apps/ops/"] } } },
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([
    "**/.next/**",
    "**/node_modules/**",
    "apps/web/src/lib/scroll-world/scrub-engine.js",
    "media/**",
  ]),
]);
