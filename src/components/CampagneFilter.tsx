"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CampagnaDisponibile } from "@/types/kpi";

type Props = {
  campagneDisponibili: CampagnaDisponibile[];
  selezionate: Set<string> | null; // null = tutte
  onChange: (selezionate: Set<string> | null) => void;
};

export function CampagneFilter({ campagneDisponibili, selezionate, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const tuttiGliId = useMemo(() => campagneDisponibili.map((c) => c.campaignId), [campagneDisponibili]);
  const attive = selezionate ?? new Set(tuttiGliId);
  const tutteSelezionate = attive.size >= tuttiGliId.length;

  const gruppi = useMemo(() => {
    const map = new Map<string, CampagnaDisponibile[]>();
    for (const c of campagneDisponibili) {
      const lista = map.get(c.tipoCampagna) ?? [];
      lista.push(c);
      map.set(c.tipoCampagna, lista);
    }
    return Array.from(map.entries());
  }, [campagneDisponibili]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function emetti(nuovoSet: Set<string>) {
    onChange(nuovoSet.size >= tuttiGliId.length ? null : nuovoSet);
  }

  function toggleTutte() {
    emetti(new Set(tutteSelezionate ? [] : tuttiGliId));
  }

  function toggleCampagna(campaignId: string) {
    const next = new Set(attive);
    if (next.has(campaignId)) next.delete(campaignId);
    else next.add(campaignId);
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
        className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm hover:border-brand/40 transition"
      >
        <FiltroIcon />
        {tutteSelezionate ? `Tutte le campagne (${tuttiGliId.length})` : `${attive.size}/${tuttiGliId.length} campagne`}
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-72 rounded-2xl border border-gray-200 bg-white shadow-lg p-4">
          <button
            type="button"
            onClick={toggleTutte}
            className="w-full text-left text-xs font-semibold px-2 py-1.5 rounded-lg text-brand hover:bg-brand-light transition-colors mb-2"
          >
            {tutteSelezionate ? "Deseleziona tutte" : "Seleziona tutte"}
          </button>

          <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
            {gruppi.map(([tipo, lista]) => {
              const idsGruppo = lista.map((c) => c.campaignId);
              const tuttiNelGruppo = idsGruppo.every((id) => attive.has(id));
              return (
                <div key={tipo}>
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-900 cursor-pointer">
                    <input type="checkbox" checked={tuttiNelGruppo} onChange={() => toggleGruppo(idsGruppo)} className="accent-current text-brand" />
                    {tipo}
                  </label>
                  <div className="mt-1 ml-5 space-y-1">
                    {lista.map((c) => (
                      <label key={c.campaignId} className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={attive.has(c.campaignId)}
                          onChange={() => toggleCampagna(c.campaignId)}
                          className="accent-current text-brand"
                        />
                        <span className="truncate">{c.nomeCampagna}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
            {gruppi.length === 0 && <p className="text-xs text-gray-400">Nessuna campagna nel periodo selezionato.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function FiltroIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}
