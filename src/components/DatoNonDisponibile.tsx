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
        "inline-flex h-4 w-4 shrink-0 cursor-help select-none items-center justify-center rounded-full border border-ink-300 text-[9px] font-semibold leading-none text-ink-300",
        className
      )}
    >
      ?
    </span>
  );
}
