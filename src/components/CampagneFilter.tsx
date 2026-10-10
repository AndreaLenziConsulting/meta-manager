"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Filter } from "lucide-react";
import type { CampagnaDisponibile } from "@/types/kpi";
import { formatCanale, formatStatoCampagna } from "@/lib/format";

type Props = {
  campagneDisponibili: CampagnaDisponibile[];
  selezionate: Set<string> | null; // null = tutte
  onChange: (selezionate: Set<string> | null) => void;
  // Presente solo se la sede ha un filtro predefinito "solo campagne ALC" (06/10/2026, vedi
  // src/lib/campagneAlc.ts): `attivo` = la selezione mostrata È quel predefinito, non una scelta
  // fatta a mano; `onRipristina` ci torna.
  predefinito?: { attivo: boolean; onRipristina: () => void };
  /** Forma compatta, per la striscia dei filtri che resta in alto mentre si scorre (StrisciaFiltri.tsx). */
  compatto?: boolean;
};

export function CampagneFilter({ campagneDisponibili, selezionate, onChange, predefinito, compatto = false }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const tuttiGliId = useMemo(() => campagneDisponibili.map((c) => c.campaignId), [campagneDisponibili]);
  // Solo gli id presenti nel periodo: `selezionate` può contenerne altri (il predefinito elenca tutte
  // le campagne ALC della sede, anche quelle senza spesa in questo periodo), che qui non hanno una
  // casella e falserebbero sia il conteggio sia "tutte selezionate".
  const attive = useMemo(
    () => (selezionate ? new Set(tuttiGliId.filter((id) => selezionate.has(id))) : new Set(tuttiGliId)),
    [selezionate, tuttiGliId]
  );
  const tutteSelezionate = selezionate === null || attive.size >= tuttiGliId.length;

  // Raggruppamento per canale (Meta/Google Ads — Fase 1 del redesign multi-canale, 12/09/2026),
  // ma SOLO quando è davvero presente più di un canale: con un solo canale (oggi sempre, finché
  // Google Ads non è collegato in Fase 2) l'etichetta di gruppo resta il solo tipo_campagna, byte
  // per byte identica a prima di questo campo — stesso principio del selettore Sede (invisibile
  // con una sola sede).
  const mostraGruppoCanale = useMemo(
    () => new Set(campagneDisponibili.map((c) => c.canale ?? "meta")).size > 1,
    [campagneDisponibili]
  );

  const gruppi = useMemo(() => {
    const map = new Map<string, { etichetta: string; lista: CampagnaDisponibile[] }>();
    for (const c of campagneDisponibili) {
      const chiave = mostraGruppoCanale ? `${c.canale ?? "meta"}::${c.tipoCampagna}` : c.tipoCampagna;
      const etichetta = mostraGruppoCanale ? `${formatCanale(c.canale)} · ${c.tipoCampagna}` : c.tipoCampagna;
      const entry = map.get(chiave) ?? { etichetta, lista: [] };
      entry.lista.push(c);
      map.set(chiave, entry);
    }
    return Array.from(map.entries());
  }, [campagneDisponibili, mostraGruppoCanale]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
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
    // Compatto: su telefono il pannello si allinea al bordo della striscia, non a questo pulsante
    // (stesso motivo di DateRangePicker).
    <div className={compatto ? "sm:relative" : "relative"} ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-lg border border-bordo-campo bg-surface-card text-ink-900 hover:border-brand transition cursor-pointer ${
          compatto ? "min-h-8 px-2.5 py-1 text-[13px] leading-[18px]" : "min-h-10 px-3 py-2 text-sm"
        }`}
      >
        <Filter size={compatto ? 14 : 16} aria-hidden="true" className="text-ink-500" />
        {predefinito?.attivo
          ? `${compatto ? "Campagne ALC" : "Solo campagne ALC"} (${attive.size}/${tuttiGliId.length})`
          : tutteSelezionate
            ? `Tutte le campagne (${tuttiGliId.length})`
            : `${attive.size}/${tuttiGliId.length} campagne`}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Scegli le campagne"
          className={`absolute z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-bordo-card bg-surface-card shadow-[var(--shadow-alta)] p-4 ${compatto ? "left-0" : ""}`}
        >
          <button
            type="button"
            onClick={toggleTutte}
            className="w-full min-h-8 text-left text-sm font-semibold px-2 py-1.5 rounded-lg text-accento-testo hover:bg-brand-light transition-colors mb-2 cursor-pointer"
          >
            {tutteSelezionate ? "Deseleziona tutte" : "Seleziona tutte"}
          </button>
          {predefinito && (
            <div className="mb-2 px-2 text-xs text-ink-500">
              {predefinito.attivo ? (
                <p>Filtro predefinito: solo le campagne con ALC nel nome. Per vederle tutte usa &quot;Seleziona tutte&quot;.</p>
              ) : (
                <button
                  type="button"
                  onClick={predefinito.onRipristina}
                  className="font-semibold text-accento-testo underline underline-offset-2"
                >
                  Torna al predefinito (solo campagne ALC)
                </button>
              )}
            </div>
          )}

          <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
            {gruppi.map(([chiave, { etichetta, lista }]) => {
              const idsGruppo = lista.map((c) => c.campaignId);
              const tuttiNelGruppo = idsGruppo.every((id) => attive.has(id));
              return (
                <div key={chiave}>
                  <label className="flex min-h-8 items-center gap-2.5 text-sm font-bold text-ink-900 cursor-pointer">
                    <input type="checkbox" checked={tuttiNelGruppo} onChange={() => toggleGruppo(idsGruppo)} className="h-[18px] w-[18px] accent-[var(--brand-primary)] cursor-pointer flex-shrink-0" />
                    {etichetta}
                  </label>
                  <div className="mt-1 ml-5 space-y-1">
                    {lista.map((c) => {
                      const stato = formatStatoCampagna(c.stato);
                      return (
                        <label key={`${c.canale ?? "meta"}::${c.campaignId}`} className="flex items-center gap-2 text-xs text-ink-500 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={attive.has(c.campaignId)}
                            onChange={() => toggleCampagna(c.campaignId)}
                            className="h-[18px] w-[18px] accent-[var(--brand-primary)] cursor-pointer flex-shrink-0"
                          />
                          {stato && (
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${stato.puntino}`} title={stato.label} />
                          )}
                          <span className="truncate">{c.nomeCampagna}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {gruppi.length === 0 && <p className="text-xs text-ink-500">Nessuna campagna nel periodo selezionato.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
