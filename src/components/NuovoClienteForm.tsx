"use client";

import { useState } from "react";

type Props = {
  consulenti: { consulenteId: string; nome: string }[];
  prodotti: { prodottoId: string; nome: string }[];
};

type Esito = { clienteId: string; accessCode: string; roadmapGenerata: boolean };

const inputClass =
  "w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition";
const labelClass = "text-xs font-semibold text-gray-700 mb-1 block";

export function NuovoClienteForm({ consulenti, prodotti }: Props) {
  const [nome, setNome] = useState("");
  const [adAccountId, setAdAccountId] = useState("");
  const [consulenteId, setConsulenteId] = useState("");
  const [targetCpa, setTargetCpa] = useState("");
  const [targetCpl, setTargetCpl] = useState("");
  const [prodottoId, setProdottoId] = useState("");
  const [dataInizioProgetto, setDataInizioProgetto] = useState("");
  const [mostraTabExtra, setMostraTabExtra] = useState(false);

  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [esito, setEsito] = useState<Esito | null>(null);
  const [rigenerando, setRigenerando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setCaricamento(true);
    try {
      const res = await fetch("/api/clienti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          adAccountId,
          consulenteId,
          targetCpa: targetCpa ? Number(targetCpa) : null,
          targetCpl: targetCpl ? Number(targetCpl) : null,
          prodottoId,
          dataInizioProgetto: prodottoId ? dataInizioProgetto : "",
          mostraTabExtra,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Creazione non riuscita");
      setEsito(body as Esito);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setCaricamento(false);
    }
  }

  async function handleRigeneraRoadmap() {
    if (!esito) return;
    setRigenerando(true);
    setErrore(null);
    try {
      const res = await fetch("/api/attivita/genera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId: esito.clienteId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Generazione roadmap non riuscita");
      setEsito({ ...esito, roadmapGenerata: true });
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setRigenerando(false);
    }
  }

  if (esito) {
    const link = `${typeof window !== "undefined" ? window.location.origin : ""}/report/${esito.accessCode}`;
    return (
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">✅</span>
          <h3 className="font-semibold text-gray-900">Cliente creato</h3>
        </div>

        <div className="space-y-2 text-sm">
          <p className="text-gray-500">
            Link cliente pubblico:{" "}
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(link)}
              className="font-mono text-brand hover:underline break-all text-left"
              title="Copia negli appunti"
            >
              {link}
            </button>
          </p>
        </div>

        {prodottoId && !esito.roadmapGenerata && (
          <div className="rounded-lg bg-yellow-50 border border-yellow-100 text-yellow-800 text-xs p-3 space-y-2">
            <p>La generazione della roadmap non è riuscita. Il cliente esiste comunque, puoi riprovare.</p>
            <button
              type="button"
              onClick={handleRigeneraRoadmap}
              disabled={rigenerando}
              className="rounded-lg bg-yellow-800 hover:bg-yellow-900 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 transition"
            >
              {rigenerando ? "Riprovo…" : "Riprova generazione roadmap"}
            </button>
          </div>
        )}
        {errore && <p className="text-xs text-red-600">{errore}</p>}

        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <a
            href={`/dashboard/cliente/${encodeURIComponent(esito.clienteId)}`}
            className="rounded-xl bg-cta hover:bg-cta-dark text-white text-sm font-semibold px-4 py-2.5 transition active:scale-[.98]"
          >
            Vai alla scheda cliente
          </a>
          <a href="/dashboard" className="rounded-xl border border-gray-200 text-sm font-semibold px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition">
            Torna alla home
          </a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6 space-y-4">
      <div>
        <label className={labelClass}>Nome cliente</label>
        <input className={inputClass} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Es. Mobilieri Bianchi Srl" required />
      </div>

      <div>
        <label className={labelClass}>Ad account Meta</label>
        <input
          className={inputClass}
          value={adAccountId}
          onChange={(e) => setAdAccountId(e.target.value)}
          placeholder="Solo cifre, senza act_"
          required
        />
      </div>

      <div>
        <label className={labelClass}>Consulente di riferimento</label>
        <select className={inputClass} value={consulenteId} onChange={(e) => setConsulenteId(e.target.value)} required>
          <option value="" disabled>
            Seleziona…
          </option>
          {consulenti.map((c) => (
            <option key={c.consulenteId} value={c.consulenteId}>
              {c.nome}
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

      <div className="pt-2 border-t border-gray-100 space-y-4">
        <div>
          <label className={labelClass}>Prodotto (opzionale)</label>
          <select className={inputClass} value={prodottoId} onChange={(e) => setProdottoId(e.target.value)}>
            <option value="">Nessuno</option>
            {prodotti.map((p) => (
              <option key={p.prodottoId} value={p.prodottoId}>
                {p.nome}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-gray-400 mt-1">Se scegli un prodotto, la roadmap di attività viene generata subito.</p>
        </div>

        {prodottoId && (
          <div>
            <label className={labelClass}>Data inizio progetto</label>
            <input
              className={inputClass}
              type="date"
              value={dataInizioProgetto}
              onChange={(e) => setDataInizioProgetto(e.target.value)}
              required
            />
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
        <input type="checkbox" checked={mostraTabExtra} onChange={(e) => setMostraTabExtra(e.target.checked)} className="accent-current text-brand" />
        Il cliente vede anche il tab Meeting (oltre a KPI)
      </label>

      {errore && <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-100 text-red-700 text-xs">{errore}</div>}

      <button
        type="submit"
        disabled={caricamento || !nome || !adAccountId || !consulenteId}
        className="w-full rounded-xl bg-cta hover:bg-cta-dark disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 transition active:scale-[.98]"
      >
        {caricamento ? "Creazione…" : "Crea cliente"}
      </button>
    </form>
  );
}
