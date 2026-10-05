import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist_Mono, Inter, Nunito } from "next/font/google";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/theme/toaster";
import { BRAND } from "@/content/brand";
import { NONCE_HEADER } from "@/server/security/csp";
import "./globals.css";

/*
 * Inter (variable, with optical-size axis): UI + numbers. Excellent tabular figures
 * (`tabular` / `numeric` utilities) and automatic display optics at large sizes.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
  display: "swap",
});

/* Nunito (rounded, variable): page titles and section headings – matches Milo's soft shapes. */
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

/* Mono is only for code/debug surfaces – not preloaded. */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: BRAND.name,
    template: `%s · ${BRAND.name}`,
  },
  applicationName: BRAND.name,
  description: BRAND.description,
  appleWebApp: { capable: true, title: BRAND.shortName, statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // enables env(safe-area-inset-*) → pb-safe etc.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BRAND.colors.paper },
    { media: "(prefers-color-scheme: dark)", color: BRAND.colors.ink },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // CSP nonce from src/proxy.ts (makes every page dynamic – they all are user-specific anyway).
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined;
  return (
    <html
      lang="de"
      suppressHydrationWarning
      className={`${inter.variable} ${nunito.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <ThemeProvider nonce={nonce}>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
