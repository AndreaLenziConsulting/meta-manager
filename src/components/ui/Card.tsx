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
 */
export function Card({
  padding = "md",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { padding?: keyof typeof PADDING }) {
  return <div className={cn("rounded-2xl border border-ink-300 bg-surface-card shadow-sm", PADDING[padding], className)} {...props} />;
}
