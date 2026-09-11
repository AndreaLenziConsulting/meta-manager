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
 * Trattamento "panel" del redesign "Vetro ALC" (Fase C, 09/09/2026), valori esatti dal mockup di
 * riferimento — non approssimati: raggio 20px (`rounded-[20px]`, tra il 2xl e il 3xl di Tailwind,
 * nessun preset coincide), bordo `--glass-border-soft` (quasi trasparente, 8% nero) invece del
 * bordo pieno `border-ink-300` di prima, ombra composita `--shadow-panel` + un filo di luce interna
 * in alto (`inset 0 1px 0 --glass-highlight`) che dà il bordo "levigato" del mockup. Resta una
 * superficie opaca (`bg-surface-card`): il vetro (blur) non tocca il contenuto, solo bordo/ombra
 * cambiano — vedi il piano di redesign sul perché.
 */
export function Card({
  padding = "md",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { padding?: keyof typeof PADDING }) {
  return (
    <div
      className={cn(
        "rounded-[20px] border border-[var(--glass-border-soft)] bg-surface-card shadow-[var(--shadow-panel),inset_0_1px_0_var(--glass-highlight)]",
        PADDING[padding],
        className
      )}
      {...props}
    />
  );
}
