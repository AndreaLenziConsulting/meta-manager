import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Intestazione di pagina del Design System ALC ("Intestazione"): sopratitolo in maiuscolo nel colore
 * di accento, titolo extra-bold in `inchiostro` che chiude col punto, sottotitolo in corsivo leggero
 * (l'unico corsivo ammesso dal sistema). Nelle app con molti dati vale solo per l'intestazione della
 * pagina: dentro le schede si usano `CLASSE_TITOLO_SEZIONE` e le didascalie.
 *
 * Il titolo è l'`h1` della pagina: una sola Intestazione per schermata. `azioni` sono i pulsanti
 * allineati a destra (a capo sotto il testo su schermi stretti).
 */
export function Intestazione({
  sopratitolo,
  titolo,
  sottotitolo,
  azioni,
  className,
}: {
  sopratitolo?: ReactNode;
  titolo: ReactNode;
  sottotitolo?: ReactNode;
  azioni?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}>
      <div className="flex min-w-0 max-w-[46rem] flex-col gap-2">
        {sopratitolo && <p className={CLASSE_SOPRATITOLO}>{sopratitolo}</p>}
        <h1 className="font-heading text-[28px] leading-[34px] font-extrabold text-ink-900 text-balance">{titolo}</h1>
        {sottotitolo && <p className="text-lg leading-7 font-light italic text-ink-500">{sottotitolo}</p>}
      </div>
      {azioni && <div className="flex flex-wrap items-center gap-3">{azioni}</div>}
    </header>
  );
}

/** `sopratitolo` del sistema: 12/16, grassetto, maiuscolo con spaziatura .12em, colore di accento. */
export const CLASSE_SOPRATITOLO = "text-xs leading-4 font-bold uppercase tracking-[.12em] text-accento-testo";

/** `titolo-3` del sistema (20/26, grassetto, `inchiostro`): il titolo di una scheda o di un pannello. */
export const CLASSE_TITOLO_SEZIONE = "font-heading text-xl leading-[26px] font-bold text-ink-900";
