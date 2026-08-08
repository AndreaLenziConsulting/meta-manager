"use client";

import { useEffect, useState } from "react";
import { KpiCard } from "@/components/KpiCard";
import { TrendChart } from "@/components/TrendChart";
import { KpiTable } from "@/components/KpiTable";
import { MonthRangePicker } from "@/components/MonthRangePicker";
import { CampagneFilter } from "@/components/CampagneFilter";
import { formatEuro, formatNumero, formatPercentuale, formatRoas } from "@/lib/format";
import type { KpiResponse } from "@/types/kpi";

function meseCorrente(): string {
  return new Date().toISOString().slice(0, 7);
}

function meseIndietro(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 7);
}

type Props = { code?: string; clienteId?: string };

export function KpiDashboard({ code, clienteId }: Props) {
  const [da, setDa] = useState(meseIndietro(2));
  const [a, setA] = useState(meseCorrente());
  const [dati, setDati] = useState<KpiResponse | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [sincronizzando, setSincronizzando] = useState(false);
  const [esitoSync, setEsitoSync] = useState<string | null>(null);

  // Il filtro campagne è legato al contesto (cliente/codice + periodo) in cui è stato scelto: se quel
  // contesto cambia, le campagne disponibili non sono più le stesse e si torna a "tutte" — senza bisogno
  // di un effect dedicato, è solo un valore derivato da confrontare col contesto corrente.
  const contestoAttuale = `${code ?? ""}|${clienteId ?? ""}|${da}|${a}`;
  const [filtroCampagne, setFiltroCampagne] = useState<{ contesto: string; selezionate: Set<string> | null }>({
    contesto: contestoAttuale,
    selezionate: null,
  });
  const campagneSelezionate = filtroCampagne.contesto === contestoAttuale ? filtroCampagne.selezionate : null;

  useEffect(() => {
    if (!code && !clienteId) return;
    const params = new URLSearchParams({ da, a });
    if (code) params.set("code", code);
    if (clienteId) params.set("clienteId", clienteId);
    if (campagneSelezionate) params.set("campagne", Array.from(campagneSelezionate).join(","));

    Promise.resolve()
      .then(() => {
        setCaricamento(true);
        setErrore(null);
        return fetch(`/api/kpi?${params.toString()}`);
      })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Errore nel caricamento dei dati");
        }
        return res.json();
      })
      .then((data: KpiResponse) => setDati(data))
      .catch((err) => setErrore(err.message))
      .finally(() => setCaricamento(false));
  }, [code, clienteId, da, a, campagneSelezionate, refreshTick]);

  async function handleAggiornaKpi() {
    if (!clienteId) return;
    setSincronizzando(true);
    setEsitoSync(null);
    try {
      const res = await fetch("/api/sync-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Aggiornamento non riuscito");
      setEsitoSync(`Aggiornate ${body.righe} righe da Meta Ads`);
      setRefreshTick((t) => t + 1);
    } catch (err) {
      setEsitoSync(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSincronizzando(false);
    }
  }

  return (
    <div className="viz-root space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <MonthRangePicker
          da={da}
          a={a}
          onChange={(nDa, nA) => {
            setDa(nDa);
            setA(nA);
          }}
        />

        {dati && (
          <CampagneFilter
            campagneDisponibili={dati.campagneDisponibili}
            selezionate={campagneSelezionate}
            onChange={(selezionate) => setFiltroCampagne({ contesto: contestoAttuale, selezionate })}
          />
        )}

        {clienteId && (
          <button
            type="button"
            onClick={handleAggiornaKpi}
            disabled={sincronizzando}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:border-brand/40 disabled:opacity-50 transition"
          >
            <RefreshIcon spinning={sincronizzando} />
            {sincronizzando ? "Aggiornamento…" : "Aggiorna KPI"}
          </button>
        )}

        {esitoSync && <span className="text-xs text-gray-500">{esitoSync}</span>}
      </div>

      {errore && <p className="text-sm text-red-600">{errore}</p>}

      {caricamento && !dati && <p className="text-sm text-gray-500">Caricamento…</p>}

      {dati && (
        <div className="space-y-6" style={{ opacity: caricamento ? 0.6 : 1, transition: "opacity 150ms" }}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard label="Investimento" value={formatEuro(dati.totale.investimento)} />
            <KpiCard label="Lead" value={formatNumero(dati.totale.numeroLead)} />
            <KpiCard label="Costo per Lead" value={formatEuro(dati.totale.costoPerLead)} />
            <KpiCard label="Appuntamenti effettuati" value={formatNumero(dati.totale.appuntamentiEffettuati)} />
            <KpiCard label="% effettuati su fissati" value={formatPercentuale(dati.totale.percentualeEffettuatiSuFissati)} />
            <KpiCard label="Vendite" value={formatNumero(dati.totale.numeroVendite)} />
            <KpiCard label="Tasso di chiusura" value={formatPercentuale(dati.totale.tassoDiChiusura)} />
            <KpiCard label="Fatturato" value={formatEuro(dati.totale.fatturato)} />
            <KpiCard label="ROAS" value={formatRoas(dati.totale.roas)} />
            <KpiCard label="CPA" value={formatEuro(dati.totale.cpa)} />
          </div>

          <TrendChart trend={dati.trend} trendSettimanale={dati.trendSettimanale} />

          <KpiTable gruppi={dati.gruppi} totale={dati.totale} campagne={dati.campagne} />
        </div>
      )}
    </div>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={spinning ? "animate-spin" : ""}
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}
