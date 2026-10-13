import type { Metadata } from "next";
import { APP_TAGLINE } from "@/components/app-brand";
import {
  OG_DESCRIPTION,
  OG_IMAGE_PATH,
  OG_TITLE,
  SITE_URL,
} from "@/lib/site-config";

const ogImage = {
  url: OG_IMAGE_PATH,
  width: 1200,
  height: 630,
  alt: "LineRoom line-by-line lyric feedback",
} as const;

export const rootMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "LineRoom — Lyrics & poetry workspace",
  description: APP_TAGLINE,
  openGraph: {
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    url: "/",
    siteName: "LineRoom",
    images: [ogImage],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    images: [OG_IMAGE_PATH],
  },
};

/** Per-page title, description, canonical, and social overrides. */
export function publicPageMetadata(opts: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: opts.path },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url: opts.path,
    },
    twitter: {
      title: opts.title,
      description: opts.description,
    },
  };
}
