export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_-15%,rgba(217,119,6,0.14),transparent_55%)]"
        aria-hidden
      />
      <div className="relative z-10 flex w-full justify-center">{children}</div>
    </div>
  );
}
