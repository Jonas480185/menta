import { redirect } from "next/navigation";
import { todayInTimezone } from "@/lib/dates";
import { getServiceContext } from "@/server/auth/context";

export default async function DiaryIndex() {
  const ctx = await getServiceContext();
  redirect(`/diary/${todayInTimezone(ctx.timezone)}`);
}
