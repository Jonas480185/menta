import { Milo } from "@/components/mascot/milo";

/** Shared shell for /login and /signup: centered, mobile-first, no app navigation. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center bg-background px-4 py-10 sm:px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Milo mood="happy" size={72} animated={false} className="text-primary" title="Milo winkt dir zu" />
        </div>
        {children}
      </div>
    </main>
  );
}
