import type { ReactNode } from "react";
import { STILE_LIVELLO, type LivelloStato } from "@/lib/statusStyles";
import { cn } from "@/lib/cn";

/**
 * Pillola di stato — sostituisce la stringa
 * "text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded-full border" ripetuta a
 * mano ovunque si mostri uno stato (campagna, attività, salute cliente, allarmi). Il colore viene
 * sempre da src/lib/statusStyles.ts, mai ridichiarato qui.
 */
export function Badge({ tono, children, className }: { tono: LivelloStato; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded-full border whitespace-nowrap",
        STILE_LIVELLO[tono].classe,
        className
      )}
    >
      {children}
    </span>
  );
}
