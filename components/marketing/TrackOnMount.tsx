"use client";

import { useEffect } from "react";
import { track, type AnalyticsEvent, type AnalyticsProps } from "@/lib/analytics";

export function TrackOnMount({
  event,
  props,
}: {
  event: AnalyticsEvent;
  props?: AnalyticsProps;
}) {
  const serialized = props ? JSON.stringify(props) : "";
  useEffect(() => {
    track(event, serialized ? (JSON.parse(serialized) as AnalyticsProps) : undefined);
  }, [event, serialized]);
  return null;
}
