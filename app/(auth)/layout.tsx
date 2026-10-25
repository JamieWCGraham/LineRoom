import { PrefetchAuthLayoutRoutes } from "@/components/navigation/route-prefetch";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex w-full flex-1 flex-col items-center justify-start px-4 pb-10 pt-8 sm:justify-center sm:py-12">
      <PrefetchAuthLayoutRoutes />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_-15%,rgba(217,119,6,0.14),transparent_55%)]"
        aria-hidden
      />
      <div className="relative z-10 flex w-full max-w-md justify-center sm:max-w-none">
        {children}
      </div>
    </div>
  );
}
