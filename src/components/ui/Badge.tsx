import type { ReactNode } from "react";
import { STILE_LIVELLO, type LivelloStato } from "@/lib/statusStyles";
import { cn } from "@/lib/cn";

/**
 * Etichetta di stato a pillola, nello stile del Design System ALC ("Badge"): 12px in grassetto,
 * minuscolo, con il pallino iniziale nel colore del testo. Il colore non basta mai da solo: dentro
 * c'è sempre la parola che dice lo stato.
 *
 * Due modalità: `tono` per un tono semantico diretto (risolve il colore da STILE_LIVELLO); `classe`
 * per un colore già risolto da una mappa di dominio (es. formatStatoCampagna/formatStatoAttivita in
 * lib/format.ts, che a loro volta leggono da STILE_LIVELLO) — mai un colore scritto qui da zero.
 */
type BadgeProps =
  | { tono: LivelloStato; classe?: never; children: ReactNode; className?: string }
  | { tono?: never; classe: string; children: ReactNode; className?: string };

export function Badge({ children, className, ...props }: BadgeProps) {
  const classeColore = "tono" in props && props.tono ? STILE_LIVELLO[props.tono].classe : (props as { classe: string }).classe;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs leading-4 font-bold px-2.5 py-1 rounded-full border whitespace-nowrap",
        classeColore,
        className
      )}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  );
}
