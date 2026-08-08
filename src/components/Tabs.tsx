"use client";

export type TabDef = { id: string; label: string };

export function Tabs({
  tabs,
  attivo,
  onChange,
}: {
  tabs: TabDef[];
  attivo: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            attivo === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
