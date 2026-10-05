import { AppNav } from "@/components/shell/app-nav";
import { KeyboardShortcuts } from "@/components/shell/keyboard-shortcuts";
import { getCurrentUser, requireOnboardedContext } from "@/server/auth/context";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireOnboardedContext();
  const user = await getCurrentUser();
  return (
    <div className="min-h-dvh lg:pl-64">
      <div className="pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+1rem)] lg:pb-8">{children}</div>
      <AppNav userName={user?.name} />
      <KeyboardShortcuts />
    </div>
  );
}
