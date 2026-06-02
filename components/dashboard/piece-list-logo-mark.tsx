import Image from "next/image";
import logoAsset from "@/lib/logos/logo.png";

type Size = "sm" | "md" | "lg";

const sizeStyles: Record<
  Size,
  { box: string; image: string; width: number; height: number }
> = {
  sm: {
    box: "h-6 w-6 rounded-md",
    image: "h-4 w-4",
    width: 16,
    height: 16,
  },
  md: {
    box: "h-9 w-9 rounded-lg",
    image: "h-7 w-7",
    width: 28,
    height: 28,
  },
  lg: {
    box: "h-9 w-9 rounded-lg",
    image: "h-7 w-7",
    width: 28,
    height: 28,
  },
};

type Props = {
  size?: Size;
  /** Rich album-style artwork for Continue Working cards. */
  variant?: "default" | "featured";
  className?: string;
};

function FeaturedPieceArtwork({ className }: { className?: string }) {
  return (
    <div
      className={`relative shrink-0 ${className ?? ""}`}
      aria-hidden
    >
      <div className="relative flex h-[4.75rem] w-[4.75rem] items-center justify-center overflow-hidden rounded-xl border border-zinc-700/50 bg-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_28px_-14px_rgba(0,0,0,0.85)]">
        <div
          className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_center,rgba(82,82,91,0.45)_0px,rgba(82,82,91,0.45)_1px,transparent_1px,transparent_5px)] opacity-80"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_32%,rgba(9,9,11,0.55)_33%,transparent_34%)]"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-br from-emerald-900/15 via-transparent to-zinc-950/90"
          aria-hidden
        />
        <div
          className="absolute inset-[10%] rounded-full border border-zinc-600/25"
          aria-hidden
        />
        <div className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full bg-zinc-950/95 ring-1 ring-zinc-600/40 shadow-[inset_0_2px_8px_rgba(0,0,0,0.55)]">
          <Image
            src={logoAsset}
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
          />
        </div>
      </div>
    </div>
  );
}

/** LineRoom logo mark beside piece titles and on cards. */
export function PieceListLogoMark({
  size = "md",
  variant = "default",
  className,
}: Props) {
  if (variant === "featured") {
    return <FeaturedPieceArtwork className={className} />;
  }

  const s = sizeStyles[size];
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden border border-zinc-700/70 bg-gradient-to-br from-zinc-800 to-emerald-950/45 ${s.box} ${className ?? ""}`}
      aria-hidden
    >
      <Image
        src={logoAsset}
        alt=""
        width={s.width}
        height={s.height}
        className={`object-contain ${s.image}`}
      />
    </span>
  );
}
