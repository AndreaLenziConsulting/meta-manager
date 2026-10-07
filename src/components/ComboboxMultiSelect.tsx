"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Filter } from "lucide-react";

type Opzione = { id: string; label: string; gruppo?: string };

type Props = {
  etichettaTutti: string; // es. "Tutti i clienti" / "Tutti"
  nomePlurale: string; // usato nel trigger a selezione parziale, es. "3/12 clienti"
  opzioni: Opzione[];
  selezionati: Set<string> | null; // null = tutte
  onChange: (selezionati: Set<string> | null) => void;
  // Aggiunge un campo di ricerca in testa al pannello (filtra solo la lista visibile, non lo stato
  // di selezione) — nessun precedente da riusare in app, primo del suo genere: CampagneFilter.tsx
  // (di cui questo componente generalizza il meccanismo apri/chiudi/"seleziona tutte") non ne ha.
  ricercabile?: boolean;
};

/**
 * Combobox multi-selezione con ricerca — generalizza CampagneFilter.tsx (stesso meccanismo di
 * apertura/chiusura/"seleziona tutte", mai duplicato) per i filtri Cliente/Responsabile del
 * redesign Attività (08/09/2026): la vecchia riga di `Tabs` andava in overflow con molte opzioni
 * (chip di altezza diversa, tagliate a destra senza modo di scorrere). Raggruppamento opzionale
 * (`gruppo`, es. "Persone" vs "Ruoli" per gli assegnatari) con lo stesso stile a sotto-intestazione
 * già usato da CampagneFilter per tipo-campagna.
 */
export function ComboboxMultiSelect({ etichettaTutti, nomePlurale, opzioni, selezionati, onChange, ricercabile }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const tuttiGliId = useMemo(() => opzioni.map((o) => o.id), [opzioni]);
  const attive = selezionati ?? new Set(tuttiGliId);
  const tutteSelezionate = attive.size >= tuttiGliId.length;

  const opzioniVisibili = useMemo(() => {
    if (!query.trim()) return opzioni;
    const q = query.trim().toLowerCase();
    return opzioni.filter((o) => o.label.toLowerCase().includes(q));
  }, [opzioni, query]);

  const gruppi = useMemo(() => {
    const map = new Map<string, Opzione[]>();
    for (const o of opzioniVisibili) {
      const chiave = o.gruppo ?? "";
      const lista = map.get(chiave) ?? [];
      lista.push(o);
      map.set(chiave, lista);
    }
    return Array.from(map.entries());
  }, [opzioniVisibili]);
  const haGruppi = gruppi.some(([chiave]) => chiave !== "");

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    function handleTasto(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleTasto);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleTasto);
    };
  }, [open]);

  function emetti(nuovoSet: Set<string>) {
    onChange(nuovoSet.size >= tuttiGliId.length ? null : nuovoSet);
  }

  function toggleTutte() {
    emetti(new Set(tutteSelezionate ? [] : tuttiGliId));
  }

  function toggleOpzione(id: string) {
    const next = new Set(attive);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    emetti(next);
  }

  function toggleGruppo(idsGruppo: string[]) {
    const tuttiNelGruppo = idsGruppo.every((id) => attive.has(id));
    const next = new Set(attive);
    idsGruppo.forEach((id) => (tuttiNelGruppo ? next.delete(id) : next.add(id)));
    emetti(next);
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex items-center gap-2 min-h-10 rounded-lg border border-bordo-campo bg-surface-card px-3 py-2 text-sm text-ink-900 hover:border-brand transition cursor-pointer"
      >
        <Filter size={16} aria-hidden="true" className="text-ink-500" />
        {tutteSelezionate ? `${etichettaTutti} (${tuttiGliId.length})` : `${attive.size}/${tuttiGliId.length} ${nomePlurale}`}
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-72 rounded-xl border border-linea bg-surface-card shadow-[var(--shadow-alta)] p-4">
          {ricercabile && (
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca…"
              aria-label={`Cerca fra ${nomePlurale}`}
              className="w-full min-h-8 rounded-lg border border-bordo-campo bg-surface-card px-2.5 py-1 text-sm text-ink-900 placeholder:text-ink-500 focus:border-brand transition-colors mb-2"
            />
          )}
          <button
            type="button"
            onClick={toggleTutte}
            className="w-full min-h-8 text-left text-sm font-semibold px-2 py-1.5 rounded-lg text-brand hover:bg-brand-light transition-colors mb-2 cursor-pointer"
          >
            {tutteSelezionate ? "Deseleziona tutte" : "Seleziona tutte"}
          </button>

          <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
            {gruppi.map(([chiave, lista]) => {
              const idsGruppo = lista.map((o) => o.id);
              const tuttiNelGruppo = idsGruppo.every((id) => attive.has(id));
              return (
                <div key={chiave || "_"}>
                  {haGruppi && chiave && (
                    <label className="flex min-h-8 items-center gap-2.5 text-sm font-bold text-ink-900 cursor-pointer">
                      <input type="checkbox" checked={tuttiNelGruppo} onChange={() => toggleGruppo(idsGruppo)} className="h-[18px] w-[18px] accent-[var(--brand-primary)] cursor-pointer flex-shrink-0" />
                      {chiave}
                    </label>
                  )}
                  <div className={haGruppi && chiave ? "mt-1 ml-5 space-y-1" : "space-y-1"}>
                    {lista.map((o) => (
                      <label key={o.id} className="flex min-h-8 items-center gap-2.5 text-sm text-ink-700 cursor-pointer">
                        <input type="checkbox" checked={attive.has(o.id)} onChange={() => toggleOpzione(o.id)} className="h-[18px] w-[18px] accent-[var(--brand-primary)] cursor-pointer flex-shrink-0" />
                        <span className="truncate">{o.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
            {opzioniVisibili.length === 0 && <p className="text-xs text-ink-500">Nessun risultato.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
