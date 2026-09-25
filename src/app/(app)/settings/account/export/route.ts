import { getServiceContext } from "@/server/auth/context";
import { exportFileName, exportUserData } from "@/server/services/account/export";

/** GET /settings/account/export → downloads all of the user's data as JSON. */
export async function GET() {
  const ctx = await getServiceContext(); // redirects to /login when signed out
  const now = new Date();
  const data = await exportUserData(ctx, now);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(now)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
