import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Load the database drivers with native Node `require` instead of bundling them.
   * PGlite resolves its WASM (`pglite.wasm`, `pglite.data`) and extension bundles
   * (`pg_trgm.tar.gz`, `unaccent.tar.gz`) via `new URL(…, import.meta.url)`; bundled, Turbopack
   * copies ~18 MB of assets into `.next/server` and the extension tarballs still point back
   * into node_modules. External = identical behavior in dev, build, scripts and tests.
   * (`pg` is on Next's default external list; listed for explicitness.)
   * See docs/architecture/technical.md → "PGlite im Next.js-Runtime".
   */
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
};

export default nextConfig;
