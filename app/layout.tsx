import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { AnalyticsScripts } from "@/components/marketing/AnalyticsScripts";
import { ChunkLoadRecovery } from "@/components/navigation/ChunkLoadRecovery";
import { InstantRouteShell } from "@/components/navigation/instant-route-shell";
import { getAppBuildId } from "@/lib/navigation/appBuildId";
import { lineroomRootViewport } from "@/lib/rootViewport";
import { rootMetadata } from "@/lib/seo";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = rootMetadata;

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
        <AnalyticsScripts />
        <ChunkLoadRecovery initialBuildId={buildId} />
        <InstantRouteShell />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
