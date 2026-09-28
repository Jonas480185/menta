import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, getServiceContext } from "@/server/auth/context";
import { lookupBarcode } from "@/server/services/foods";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { code } = await params;
  if (!/^\d{6,14}$/.test(code)) return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  const res = await lookupBarcode(await getServiceContext(), code);
  return NextResponse.json(res, { headers: { "Cache-Control": "private, max-age=300" } });
}
