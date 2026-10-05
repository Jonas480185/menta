import { readFileSync } from "node:fs";
import path from "node:path";

/** Loads a recorded API response from this directory (tests only: no network). */
export function loadFixture<T = Record<string, unknown>>(name: string): T {
  return JSON.parse(readFileSync(path.join(__dirname, name), "utf8")) as T;
}

/** A fetch stub that answers from a URL→fixture map (first matching substring wins). */
export function fixtureFetch(routes: Record<string, { status?: number; body: unknown }>) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const impl = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) return new Response(JSON.stringify({ error: "no fixture" }), { status: 500 });
    const { status = 200, body } = routes[key];
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  };
  return { fetch: impl as typeof fetch, calls };
}
