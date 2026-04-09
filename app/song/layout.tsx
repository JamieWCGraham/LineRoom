import { lineroomEditorViewport } from "@/lib/editorViewport";

export const viewport = lineroomEditorViewport;

export default function SongLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="h-dvh min-h-0 overflow-hidden [text-size-adjust:100%] [-webkit-text-size-adjust:100%]">
      {children}
    </div>
  );
}
