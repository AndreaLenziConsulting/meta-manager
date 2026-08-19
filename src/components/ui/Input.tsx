import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Stile input/select/textarea standard dell'app — sostituisce `inputClass` duplicato
 * testualmente identico in tre componenti-form (NuovoClienteForm, ModificaClienteModal,
 * MeetingTab). `w-full` è nella classe base: per un input dentro una riga flex (dove la
 * larghezza deve venire da flex-1/w-32) passare `className="w-auto flex-1"` — tailwind-merge
 * risolve il conflitto invece di lasciare due `w-*` in competizione.
 */
const inputBase =
  "w-full rounded-xl border border-ink-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition disabled:opacity-50 disabled:cursor-not-allowed";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputBase, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputBase, "resize-none", className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputBase, className)} {...props} />;
}
