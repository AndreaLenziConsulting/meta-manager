"use client";

import { useState } from "react";
import type { Cliente, Consulente } from "@/types/kpi";

// Duplicato deliberatamente da NuovoClienteForm.tsx (non estratto in comune) — stessa convenzione
// già in uso nel progetto per componenti-form dedicati (vedi commento in AttivitaLista.tsx).
const inputClass =
  "w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition";
const labelClass = "text-xs font-semibold text-gray-700 mb-1 block";

type Props = {
  cliente: Cliente;
  consulenti: Consulente[];
  onClose: () => void;
  onSalvato: () => void;
};

export function ModificaClienteModal({ cliente, consulenti, onClose, onSalvato }: Props) {
  const [nome, setNome] = useState(cliente.nome);
  const [adAccountId, setAdAccountId] = useState(cliente.adAccountId);
  const [email, setEmail] = useState(cliente.email);
  const [consulenteId, setConsulenteId] = useState(cliente.consulenteId);
  const [targetCpa, setTargetCpa] = useState(cliente.targetCpa !== null ? String(cliente.targetCpa) : "");
  const [targetCpl, setTargetCpl] = useState(cliente.targetCpl !== null ? String(cliente.targetCpl) : "");
  const [tipoConversioneLead, setTipoConversioneLead] = useState(cliente.tipoConversioneLead);
  const [mostraTabExtra, setMostraTabExtra] = useState(cliente.mostraTabExtra);
  const [attivo, setAttivo] = useState(cliente.attivo);

  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setSalvando(true);
    try {
      const res = await fetch("/api/clienti", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId: cliente.clienteId,
          nome,
          adAccountId,
          email,
          consulenteId,
          targetCpa: targetCpa ? Number(targetCpa) : null,
          targetCpl: targetCpl ? Number(targetCpl) : null,
          tipoConversioneLead,
          mostraTabExtra,
          attivo,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Salvataggio non riuscito");
      onSalvato();
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSalvando(false);
    }
  }

  return (
    // Overlay: chiude sul click fuori dal pannello. onMouseDown (non onClick) sul pannello ferma la
    // propagazione così un drag-select che parte dentro il form e finisce sopra l'overlay non chiude
    // accidentalmente il modale a metà modifica.
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Modifica ${cliente.nome}`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-lg p-6 space-y-4 my-8"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-900">Modifica cliente</h3>
            <p className="text-xs text-gray-400 mt-0.5 font-mono">{cliente.clienteId}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none" aria-label="Chiudi">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Nome cliente</label>
            <input className={inputClass} value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>

          <div>
            <label className={labelClass}>Ad account Meta</label>
            <input className={inputClass} value={adAccountId} onChange={(e) => setAdAccountId(e.target.value)} placeholder="Solo cifre, senza act_" required />
          </div>

          <div>
            <label className={labelClass}>Email cliente (opzionale)</label>
            <input
              className={inputClass}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Per l'invio automatico del follow-up meeting"
            />
          </div>

          <div>
            <label className={labelClass}>Consulente di riferimento</label>
            <select className={inputClass} value={consulenteId} onChange={(e) => setConsulenteId(e.target.value)} required>
              {consulenti.map((c) => (
                <option key={c.consulenteId} value={c.consulenteId}>
                  {c.nome}
                  {!c.attivo ? " (disattivato)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Target CPA (€, opzionale)</label>
              <input className={inputClass} type="number" step="0.01" value={targetCpa} onChange={(e) => setTargetCpa(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Target CPL (€, opzionale)</label>
              <input className={inputClass} type="number" step="0.01" value={targetCpl} onChange={(e) => setTargetCpl(e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Tipo conversione lead (opzionale)</label>
            <input
              className={inputClass}
              value={tipoConversioneLead}
              onChange={(e) => setTipoConversioneLead(e.target.value)}
              placeholder="Vuoto = usa la lista di default (Lead Ads classici)"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Action type esatto di Meta Insights da contare come lead — solo per clienti con tracciamento non
              standard (es. iscrizioni a webinar/eventi).
            </p>
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={mostraTabExtra} onChange={(e) => setMostraTabExtra(e.target.checked)} className="accent-current text-brand" />
              Il cliente vede anche il tab Meeting (oltre a KPI)
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={attivo} onChange={(e) => setAttivo(e.target.checked)} className="accent-current text-brand" />
              Cliente attivo
            </label>
          </div>

          {errore && <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-100 text-red-700 text-xs">{errore}</div>}

          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <button
              type="submit"
              disabled={salvando || !nome || !adAccountId || !consulenteId}
              className="rounded-xl bg-cta hover:bg-cta-dark disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2.5 transition active:scale-[.98]"
            >
              {salvando ? "Salvataggio…" : "Salva modifiche"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-200 text-sm font-semibold px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition"
            >
              Annulla
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
