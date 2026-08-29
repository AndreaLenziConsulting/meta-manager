import type { LivelloStato } from "@/lib/statusStyles";
import { STILE_LIVELLO } from "@/lib/statusStyles";
import { cn } from "@/lib/cn";

type PallinoStatoProps = {
  tono: LivelloStato;
  /** Spiega il motivo del colore (tooltip nativo) — es. "Costo per Lead a €12, il 20% sopra il target". */
  motivo?: string;
  className?: string;
};

/**
 * Pallino colorato condiviso — promosso dal `Puntino` locale già in uso in SaluteClienti.tsx
 * (stesso identico colore/dimensione, `STILE_LIVELLO[tono].puntino`) perché ora serve anche fuori
 * da quel componente (blocco 7 del redesign KPI, pallino per singola campagna). Con `motivo`
 * presente aggiunge un tooltip nativo (title) — senza, resta il puntino muto di sempre.
 */
export function PallinoStato({ tono, motivo, className }: PallinoStatoProps) {
  return (
    <span
      title={motivo}
      aria-label={motivo}
      className={cn("inline-block w-1.5 h-1.5 rounded-full shrink-0", motivo && "cursor-help", STILE_LIVELLO[tono].puntino, className)}
    />
  );
}
