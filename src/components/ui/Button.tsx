import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const VARIANTE = {
  // CTA principale — verde, colore di azione (non di brand, vedi src/lib/statusStyles.ts).
  primary: "bg-cta hover:bg-cta-dark text-white disabled:opacity-50 disabled:cursor-not-allowed",
  // Azione secondaria in evidenza — bordo brand, usato dove serve un CTA meno assertivo del verde
  // (es. scarica/genera in un contesto che non è "salva").
  secondary: "border-2 border-brand text-brand hover:bg-brand-light disabled:opacity-50 disabled:cursor-not-allowed",
  // Azione terziaria/annulla — nessuno sfondo, solo bordo neutro.
  ghost: "border border-ink-300 text-ink-700 hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed",
} as const;

const DIMENSIONE = {
  sm: "text-xs px-3 py-1.5",
  md: "text-sm px-4 py-2.5",
} as const;

/**
 * Bottone standard dell'app — sostituisce le stringhe di classi ripetute in almeno 5 file per il
 * CTA verde, e introduce varianti coerenti per le azioni secondarie/annulla che oggi erano
 * ridichiarate diversamente componente per componente.
 */
export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTE; size?: keyof typeof DIMENSIONE }) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-xl font-semibold transition cursor-pointer active:scale-[.98] disabled:active:scale-100",
        VARIANTE[variant],
        DIMENSIONE[size],
        className
      )}
      {...props}
    />
  );
}
