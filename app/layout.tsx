import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { APP_TAGLINE } from "@/components/app-brand";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { ChunkLoadRecovery } from "@/components/navigation/ChunkLoadRecovery";
import { InstantRouteShell } from "@/components/navigation/instant-route-shell";
import { getAppBuildId } from "@/lib/navigation/appBuildId";
import { lineroomRootViewport } from "@/lib/rootViewport";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "LineRoom — Lyrics & poetry workspace",
  description: APP_TAGLINE,
};

export const viewport: Viewport = lineroomRootViewport;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const buildId = getAppBuildId();

  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-dvh flex-col font-sans antialiased">
        <ChunkLoadRecovery initialBuildId={buildId} />
        <InstantRouteShell />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
