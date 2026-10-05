/**
 * Content Security Policy for HTML responses (set per request in `src/proxy.ts`).
 *
 * - Scripts: only same-origin plus scripts carrying the per-request nonce (`strict-dynamic` lets those
 *   load their chunks). Next.js and next-themes pick the nonce up during SSR.
 * - Styles: `'unsafe-inline'` is required – motion, Recharts and React write `style` attributes, which
 *   nonces cannot cover. Style injection is far less dangerous than script injection.
 * - The app loads no third-party resources: everything else is `'self'`.
 * - Development needs `'unsafe-eval'` for React's error overlay / stack reconstruction.
 */
export function buildCsp(nonce: string, { dev = false }: { dev?: boolean } = {}): string {
  const directives: [string, ...string[]][] = [
    ["default-src", "'self'"],
    ["script-src", "'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(dev ? ["'unsafe-eval'"] : [])],
    ["style-src", "'self'", "'unsafe-inline'"],
    ["img-src", "'self'", "blob:", "data:"],
    ["font-src", "'self'"],
    ["connect-src", "'self'", ...(dev ? ["ws:"] : [])],
    ["media-src", "'self'", "blob:"],
    ["worker-src", "'self'", "blob:"],
    ["manifest-src", "'self'"],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["frame-ancestors", "'none'"],
    // No `upgrade-insecure-requests`: it breaks plain-http self-hosting (e.g. `pnpm start` locally);
    // HTTPS is enforced by the HSTS header instead.
  ];
  return directives.map((d) => d.join(" ")).join("; ");
}

/** Unpredictable per-request nonce (128 bit, base64). */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/** Request header that carries the nonce from the proxy to server components. */
export const NONCE_HEADER = "x-nonce";
