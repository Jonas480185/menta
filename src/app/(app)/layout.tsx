import { AppNav } from "@/components/shell/app-nav";
import { requireOnboardedContext } from "@/server/auth/context";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireOnboardedContext();
  return (
    <div className="min-h-dvh lg:pl-64">
      <div className="pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+1rem)] lg:pb-8">{children}</div>
      <AppNav />
    </div>
  );
}
