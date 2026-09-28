import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser, getServiceContext } from "@/server/auth/context";
import { searchFoods } from "@/server/services/foods";

const params = z.object({
  q: z.string().max(100).default(""),
  limit: z.coerce.number().int().min(1).max(50).default(30),
  external: z.enum(["0", "1"]).default("1"),
});

export async function GET(req: NextRequest) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const parsed = params.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  const ctx = await getServiceContext();
  const res = await searchFoods(ctx, parsed.data.q, {
    limit: parsed.data.limit,
    includeExternal: parsed.data.external === "1",
  });
  return NextResponse.json(res, { headers: { "Cache-Control": "private, max-age=30" } });
}
