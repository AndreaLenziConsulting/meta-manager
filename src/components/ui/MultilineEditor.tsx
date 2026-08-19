"use client";

import { EditableTextarea } from "@/components/ui/EditableTextarea";

/**
 * Editor per un blocco di testo multi-riga (una stringa separata da a-capo) — in sola lettura
 * si mostra come elenco puntato, in modifica come textarea unica. Estratto da
 * MeetingReportView.tsx, dove era l'unico consumer.
 */
export function MultilineEditor({
  value,
  onChange,
  editable,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  editable: boolean;
  placeholder?: string;
}) {
  if (!editable) {
    const lines = value.split("\n").map((l) => l.trim()).filter(Boolean);
    return (
      <ul className="mt-3 space-y-2">
        {lines.map((line, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
            <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0 bg-brand" />
            <span className="whitespace-pre-wrap flex-1">{line}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="mt-3">
      <EditableTextarea value={value} onChange={onChange} editable={true} placeholder={placeholder} className="text-sm text-gray-700 leading-relaxed" />
    </div>
  );
}
