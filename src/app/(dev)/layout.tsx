import { notFound } from "next/navigation";

/** Internal tooling (design system gallery): available in development only. */
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
