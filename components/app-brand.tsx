import Image from "next/image";
import logoAsset from "@/lib/logos/logo.png";

/** Single source for product description (login, dashboard, editor header). */
export const APP_TAGLINE =
  "LineRoom is a modern workspace for songwriters to draft, shape, and refine lyrics in real time.";

export function AppBrandLogo({
  size = 32,
  className,
  priority,
  alt = "",
}: {
  size?: number;
  className?: string;
  priority?: boolean;
  /** Empty when the word “LineRoom” appears beside the mark (avoids duplicate SR labels). */
  alt?: string;
}) {
  return (
    <Image
      src={logoAsset}
      alt={alt}
      width={size}
      height={size}
      className={`shrink-0 object-contain ${className ?? ""}`}
      priority={priority}
    />
  );
}

export function AppBrandHero() {
  return (
    <header className="mb-6 text-center sm:mb-10">
      <div className="flex items-center justify-center gap-2.5 sm:gap-3">
        <AppBrandLogo size={48} className="h-9 w-9 sm:h-11 sm:w-11" priority />
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          <span className="bg-gradient-to-b from-zinc-50 to-zinc-400 bg-clip-text text-transparent">
            LineRoom
          </span>
        </h1>
      </div>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-zinc-500 sm:mt-4">
        {APP_TAGLINE}
      </p>
    </header>
  );
}

export function AppBrandDash() {
  return (
    <div className="border-b border-zinc-800/80 pb-8">
      <div className="flex items-center gap-2.5 sm:gap-3">
        <AppBrandLogo size={48} className="h-10 w-10 sm:h-12 sm:w-12" />
        <p className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
          LineRoom
        </p>
      </div>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
        {APP_TAGLINE}
      </p>
    </div>
  );
}
