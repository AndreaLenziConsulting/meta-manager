import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const DIMENSIONE = {
  // Dentro righe fitte (tabelle, elenchi): 32px, sopra il minimo di 24px per un bersaglio.
  sm: "h-8 w-8",
  // In schede e intestazioni: 40px.
  md: "h-10 w-10",
  // Comandi usati col dito (menù su telefono): 44px.
  lg: "h-11 w-11",
} as const;

/**
 * Pulsante di sola icona (matita di modifica, chiudi, menù). L'icona resta piccola, il bersaglio no:
 * prima la matita era cliccabile solo sui suoi 12-14px (audit UX del 06/10/2026). `etichetta` è
 * obbligatoria: è il nome che legge lo screen reader e il suggerimento al passaggio del mouse.
 */
export function PulsanteIcona({
  etichetta,
  dimensione = "md",
  className,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "title"> & { etichetta: string; dimensione?: keyof typeof DIMENSIONE }) {
  return (
    <button
      type="button"
      aria-label={etichetta}
      title={etichetta}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full text-ink-500 transition-colors cursor-pointer hover:bg-surface hover:text-accento-testo disabled:opacity-45 disabled:cursor-not-allowed",
        DIMENSIONE[dimensione],
        className
      )}
      {...props}
    />
  );
}
