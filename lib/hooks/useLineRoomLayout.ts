"use client";

import { useEffect, useState } from "react";

export type MobilePane = "draft" | "chat" | "critique";
export type LyricDocPane = "draft" | "brainstorm";

export function useLineRoomLayout() {
  const [mobilePane, setMobilePane] = useState<MobilePane>("draft");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileTitleEditorOpen, setMobileTitleEditorOpen] = useState(false);
  const [lyricDocPane, setLyricDocPane] = useState<LyricDocPane>("draft");

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  return {
    mobilePane,
    setMobilePane,
    mobileMenuOpen,
    setMobileMenuOpen,
    mobileTitleEditorOpen,
    setMobileTitleEditorOpen,
    lyricDocPane,
    setLyricDocPane,
  };
}
