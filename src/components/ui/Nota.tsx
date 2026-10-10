import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const TONO = {
  accento: { box: "border-l-brand bg-brand-light", etichetta: "text-accento-testo" },
  ok: { box: "border-l-ok bg-ok-tenue", etichetta: "text-ok" },
  attenzione: { box: "border-l-attenzione bg-attenzione-tenue", etichetta: "text-attenzione" },
  critico: { box: "border-l-critico bg-critico-tenue", etichetta: "text-critico" },
} as const;

export type TonoNota = keyof typeof TONO;

/**
 * Box di avviso del Design System ALC ("Nota"): barra di 4px a sinistra nel colore del tono, fondo
 * `-tenue`, etichetta in maiuscolo che dice di che avviso si tratta (il colore non basta mai da
 * solo), testo in `testo`. Il testo resta scuro su tutti i toni: il colore di stato sta nella barra e
 * nell'etichetta, così il contenuto si legge sempre a contrasto pieno.
 */
export function Nota({
  tono = "accento",
  etichetta,
  children,
  className,
  compatta = false,
  role,
}: {
  tono?: TonoNota;
  etichetta?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Dentro pannelli e liste: meno spazio attorno. */
  compatta?: boolean;
  role?: "alert" | "status";
}) {
  const stile = TONO[tono];
  return (
    <div
      role={role}
      className={cn("flex flex-col gap-1 rounded-r-lg border-l-4 text-sm leading-[22px] text-ink-700", compatta ? "px-4 py-3" : "px-5 py-4", stile.box, className)}
    >
      {etichetta && <p className={cn("text-xs leading-4 font-bold uppercase tracking-[.12em]", stile.etichetta)}>{etichetta}</p>}
      {children}
    </div>
  );
}
