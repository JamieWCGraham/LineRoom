import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { APP_TAGLINE } from "@/components/app-brand";
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
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
