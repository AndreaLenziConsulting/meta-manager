import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Stile input/select/textarea standard dell'app, sul Design System ALC: raggio `radius-md` (8px),
 * bordo `bordo-campo` (la `linea` delle card è decorativa e non regge il confine di un campo), 44px
 * di altezza, anello di focus del sistema (quello globale di globals.css: qui nessun `outline-none`).
 * `w-full` è nella classe base: per un input dentro una riga flex passare `className="w-auto
 * flex-1"` — tailwind-merge risolve il conflitto invece di lasciare due `w-*` in competizione.
 */
const inputBase =
  "w-full min-h-11 rounded-lg border border-bordo-campo bg-surface-card px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-500 " +
  "focus:border-brand transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputBase, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputBase, "resize-none", className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputBase, className)} {...props} />;
}
