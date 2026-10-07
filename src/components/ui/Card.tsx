import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const PADDING = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
} as const;

/**
 * Card del Design System ALC: `superficie` su `sfondo`, raggio `radius-lg` (12px), bordo `linea`,
 * `shadow-card`. È il blocco base di ogni schermata. `evidenza` aggiunge la barra di accento di 4px
 * a sinistra, il segno grafico di ALC: una o due per vista, per ciò che conta davvero — messa su
 * tutte le card perde significato. `className` può aggiungere o sovrascrivere qualunque classe.
 */
export function Card({
  padding = "md",
  evidenza = false,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { padding?: keyof typeof PADDING; evidenza?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-linea bg-surface-card shadow-[var(--shadow-card)]",
        evidenza && "border-l-4 border-l-brand rounded-l-[4px]",
        PADDING[padding],
        className
      )}
      {...props}
    />
  );
}
