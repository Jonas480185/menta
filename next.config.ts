import type { NextConfig } from "next";

/** Security headers for every response (the CSP itself is per request, see src/proxy.ts). */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Camera only for the barcode scanner on our own origin; everything else off.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
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
