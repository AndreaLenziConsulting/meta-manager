import Image from "next/image";
import type { ReactNode } from "react";

export function AppHeader({ subtitle, children }: { subtitle?: string; children?: ReactNode }) {
  return (
    <header className="bg-surface-card border-b border-ink-300/60 sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-surface-card/85">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Image
            src="/lenzi.webp"
            alt="Andrea Lenzi Consulting"
            width={120}
            height={40}
            priority
            className="object-contain h-8 w-auto"
          />
          <div className="hidden sm:block w-px h-7 bg-ink-300/60" />
          <div className="hidden sm:block min-w-0">
            <h1 className="font-heading font-bold text-sm text-ink-900 leading-tight truncate tracking-wide">Meta Manager ALC</h1>
            <p className="text-[11px] text-ink-500 leading-tight truncate">
              {subtitle || "Dashboard KPI automatizzata da Meta Ads"}
            </p>
          </div>
        </div>
        {children && <div className="flex items-center gap-3 flex-shrink-0">{children}</div>}
      </div>
    </header>
  );
}
