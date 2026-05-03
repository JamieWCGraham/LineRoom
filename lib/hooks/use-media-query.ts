"use client";

import { useEffect, useState } from "react";

export function useMediaQuery(query: string, serverFallback = false) {
  const [matches, setMatches] = useState(serverFallback);

  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

export function useIsMdUp() {
  return useMediaQuery("(min-width: 768px)", true);
}
