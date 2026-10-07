import { cn } from "@/lib/cn";

type DatoNonDisponibileProps = {
  /** Spiega perché manca il dato (es. "Nessuna spesa nel periodo"). Se assente, testo generico. */
  motivo?: string;
  className?: string;
};

/**
 * Indicatore inline per un valore null da divisione-per-zero o dato mancante — MAI un semplice
 * trattino silenzioso. Pallino vuoto (outline) + "?" con tooltip nativo (title). Colore neutro,
 * non rosso: l'assenza del dato non è un errore, spesso è solo un denominatore zero.
 */
export function DatoNonDisponibile({ motivo, className }: DatoNonDisponibileProps) {
  const testo = motivo?.trim() || "Dato non disponibile";
  return (
    <span
      title={testo}
      aria-label={testo}
      className={cn(
        "inline-flex h-5 w-5 shrink-0 cursor-help select-none items-center justify-center rounded-full border border-bordo-campo text-xs font-bold leading-none text-ink-500",
        className
      )}
    >
      ?
    </span>
  );
}
