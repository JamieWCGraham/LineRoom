import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { APP_TAGLINE } from "@/components/app-brand";
import { ChunkLoadRecovery } from "@/components/navigation/ChunkLoadRecovery";
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
      <body className="min-h-screen font-sans antialiased">
        <ChunkLoadRecovery initialBuildId={buildId} />
        {children}
      </body>
    </html>
  );
}
