import type { Metadata } from "next";

import { ComponentGallery } from "./gallery-client";

export const metadata: Metadata = {
  title: "Komponenten-Galerie",
  description: "Interne Übersicht aller UI-Komponenten mit ihren Zuständen.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

/** Internal dev gallery of `src/components/ui` (all values are illustrative samples). */
export default function ComponentGalleryPage() {
  return <ComponentGallery />;
}
