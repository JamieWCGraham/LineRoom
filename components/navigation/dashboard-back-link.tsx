"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { prefetchDashboard } from "@/lib/navigation/warmDashboard";

type Props = Omit<ComponentProps<typeof Link>, "href"> & {
  href?: "/";
};

/** Back to dashboard: prefetch on hover/focus; standard Link nav shows the dashboard loading shell immediately. */
export function DashboardBackLink({
  href = "/",
  onPointerEnter,
  onPointerDown,
  prefetch = true,
  ...rest
}: Props) {
  const router = useRouter();

  return (
    <Link
      href={href}
      prefetch={prefetch}
      onPointerEnter={(e) => {
        onPointerEnter?.(e);
        if (!e.defaultPrevented) prefetchDashboard(router);
      }}
      onPointerDown={(e) => {
        onPointerDown?.(e);
        if (!e.defaultPrevented) prefetchDashboard(router);
      }}
      onFocus={() => prefetchDashboard(router)}
      {...rest}
    />
  );
}
