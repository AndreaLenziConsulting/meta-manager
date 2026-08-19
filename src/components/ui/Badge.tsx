import type { ReactNode } from "react";
import { STILE_LIVELLO, type LivelloStato } from "@/lib/statusStyles";
import { cn } from "@/lib/cn";

/**
 * Pillola di stato — sostituisce la stringa
 * "text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded-full border" ripetuta a
 * mano ovunque si mostri uno stato (campagna, attività, salute cliente, allarmi).
 *
 * Due modalità: `tono` per un tono semantico diretto (risolve il colore da STILE_LIVELLO); `classe`
 * per un colore già risolto da una mappa di dominio (es. formatStatoCampagna/formatStatoAttivita in
 * lib/format.ts, che a loro volta leggono da STILE_LIVELLO ma restituiscono la classe finale, non
 * il tono astratto) — mai un colore scritto qui da zero, in un caso o nell'altro.
 */
type BadgeProps =
  | { tono: LivelloStato; classe?: never; children: ReactNode; className?: string }
  | { tono?: never; classe: string; children: ReactNode; className?: string };

export function Badge({ children, className, ...props }: BadgeProps) {
  const classeColore = "tono" in props && props.tono ? STILE_LIVELLO[props.tono].classe : (props as { classe: string }).classe;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded-full border whitespace-nowrap",
        classeColore,
        className
      )}
    >
      {children}
    </span>
  );
}
