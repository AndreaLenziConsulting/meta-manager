import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const PADDING = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
} as const;

/**
 * Contenitore a card standard dell'app — sostituisce la stringa
 * "rounded-2xl border border-gray-200 bg-white shadow-sm p-4/5/6" ripetuta a mano in una decina
 * di componenti. `className` può aggiungere o sovrascrivere (via cn/tailwind-merge) qualunque
 * classe, incluso il padding se `padding="none"` non basta.
 *
 * Ombra `--shadow-panel` (redesign "Vetro ALC", Fase C, 09/09/2026) invece del generico
 * `shadow-sm` — più nitida delle ombre "diffuse da poster" di Tailwind, coerente col taglio
 * corporate del vetro sopra. Solo l'ombra: resta una superficie opaca (`bg-surface-card`), il
 * vetro non tocca il contenuto — vedi il piano di redesign sul perché.
 */
export function Card({
  padding = "md",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { padding?: keyof typeof PADDING }) {
  return (
    <div
      className={cn("rounded-2xl border border-ink-300 bg-surface-card shadow-[var(--shadow-panel)]", PADDING[padding], className)}
      {...props}
    />
  );
}
