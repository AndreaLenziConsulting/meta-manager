"use client";

/**
 * Testo su una riga, statico o editabile inline (uno `<span>` o un `<input>` a seconda di
 * `editable`) — estratto da MeetingReportView.tsx, dove era l'unico consumer. Pensato per testo
 * "in linea" dentro un contesto colorato (es. header brandizzato), non per form standard: per
 * quello vedi Input.tsx/Field.tsx.
 */
export function EditableInline({
  value,
  onChange,
  editable,
  className,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  editable: boolean;
  className?: string;
  placeholder?: string;
}) {
  if (!editable) {
    return <span className={className}>{value}</span>;
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className={`${className ?? ""} rounded px-1 -mx-1 hover:bg-white/10 focus:bg-white/15 focus-visible:outline-accento-su-notte transition-colors`}
    />
  );
}
