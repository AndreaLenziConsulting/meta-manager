import type { ReactNode } from "react";

/**
 * Wrapper label + campo + hint/errore — sostituisce `labelClass` duplicato testualmente identico
 * in tre componenti-form (NuovoClienteForm, ModificaClienteModal, MeetingTab). Il campo va passato
 * come children (Input/Select/Textarea di questa stessa cartella, o un componente su misura).
 */
export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label className="text-xs font-semibold text-ink-700 mb-1 block">{label}</label>
      {children}
      {hint && !error && <p className="text-[11px] text-ink-500 mt-1">{hint}</p>}
      {error && <p className="text-[11px] mt-1 text-red-600">{error}</p>}
    </div>
  );
}
