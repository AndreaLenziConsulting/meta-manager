import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const VARIANTE = {
  // Barra nel colore di accento: la tessera normale.
  accento: "border-linea border-l-brand bg-surface-card",
  // Il numero che conta di più nella vista: tessera scura (`notte-superficie` col velo, bordo di luce,
  // `shadow-notte`). Una, al massimo due per schermata.
  notte: "border-white/10 border-l-blu-luce bg-notte-superficie [background-image:var(--gradiente-velo-notte)] shadow-[var(--shadow-notte)]",
  // Barra nel colore di stato quando il numero è letto contro un target.
  ok: "border-linea border-l-ok bg-surface-card",
  attenzione: "border-linea border-l-attenzione bg-surface-card",
  critico: "border-linea border-l-critico bg-surface-card",
} as const;

export type VarianteKpi = keyof typeof VARIANTE;

/**
 * Tessera numero del Design System ALC ("Kpi"): barra di accento di 4px a sinistra, prima il valore
 * (32/36 extra-bold, cifre tabellari), sotto l'etichetta (didascalia). `children` è la riga di
 * dettaglio sotto l'etichetta (variazione sul periodo precedente, metrica derivata).
 *
 * Il valore è testo, non un numero: quando il dato manca il chiamante passa la sua dicitura
 * ("Non compilato") invece di uno zero — vedi SintesiTessere.tsx.
 */
export function Kpi({
  valore,
  etichetta,
  variante = "accento",
  attenuato = false,
  children,
  className,
}: {
  valore: ReactNode;
  etichetta: ReactNode;
  variante?: VarianteKpi;
  /** Valore assente: scritto più piccolo e in `testo-secondario`, così non sembra un numero. */
  attenuato?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const notte = variante === "notte";
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-0.5 rounded-l-[4px] rounded-r-xl border border-l-4 py-4 pl-4 pr-5 shadow-[var(--shadow-card)]",
        VARIANTE[variante],
        className
      )}
    >
      <p
        className={cn(
          "font-heading tabular-nums",
          attenuato ? "text-lg leading-9 font-bold" : "text-[32px] leading-9 font-extrabold",
          notte ? "text-su-notte" : attenuato ? "text-ink-500" : "text-ink-900"
        )}
      >
        {valore}
      </p>
      <p className={cn("text-xs leading-4 font-medium", notte ? "text-su-notte-secondario" : "text-ink-500")}>{etichetta}</p>
      {children}
    </div>
  );
}
