"use client";

/**
 * Editor per un elenco puntato (string[]) con aggiunta/rimozione riga — estratto da
 * MeetingReportView.tsx, dove era l'unico consumer.
 */
export function BulletListEditor({
  items,
  onChange,
  editable,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  editable: boolean;
  placeholder?: string;
}) {
  if (!editable) {
    return (
      <ul className="mt-3 space-y-2">
        {items.map((hl, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
            <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0 bg-brand" />
            {hl}
          </li>
        ))}
      </ul>
    );
  }
  const update = (i: number, v: string) => {
    const next = [...items];
    next[i] = v;
    onChange(next);
  };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, ""]);

  return (
    <div className="mt-3 space-y-1.5">
      {items.map((hl, i) => (
        <div key={i} className="group flex items-start gap-2 text-sm text-gray-700">
          <span className="mt-2.5 w-2 h-2 rounded-full flex-shrink-0 bg-brand" />
          <input
            type="text"
            value={hl}
            onChange={(e) => update(i, e.target.value)}
            className="flex-1 rounded-md border border-transparent hover:border-gray-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 px-2 py-1 outline-none transition-colors"
          />
          <button type="button" onClick={() => remove(i)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 px-1 mt-0.5" aria-label="Rimuovi">
            ×
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="text-xs font-medium ml-4 mt-1.5 hover:underline text-brand">
        + {placeholder || "Aggiungi"}
      </button>
    </div>
  );
}
