"use client";

import { useEffect, useState } from "react";
import { KpiCard } from "@/components/KpiCard";
import { TrendChart } from "@/components/TrendChart";
import { KpiTable } from "@/components/KpiTable";
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

  useEffect(() => {
    if (!code && !clienteId) return;
    const params = new URLSearchParams({ da, a });
    if (code) params.set("code", code);
    if (clienteId) params.set("clienteId", clienteId);

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
  }, [code, clienteId, da, a]);

  return (
    <div className="viz-root space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block mb-1" style={{ color: "var(--text-secondary)" }}>
            Da
          </span>
          <input
            type="month"
            value={da}
            onChange={(e) => setDa(e.target.value)}
            className="rounded-lg border px-3 py-2 bg-transparent"
            style={{ borderColor: "var(--border-hairline)", color: "var(--text-primary)" }}
          />
        </label>
        <label className="text-sm">
          <span className="block mb-1" style={{ color: "var(--text-secondary)" }}>
            A
          </span>
          <input
            type="month"
            value={a}
            onChange={(e) => setA(e.target.value)}
            className="rounded-lg border px-3 py-2 bg-transparent"
            style={{ borderColor: "var(--border-hairline)", color: "var(--text-primary)" }}
          />
        </label>
      </div>

      {errore && <p className="text-sm text-red-600">{errore}</p>}

      {caricamento && !dati && (
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Caricamento…
        </p>
      )}

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

          <TrendChart trend={dati.trend} />

          <KpiTable gruppi={dati.gruppi} totale={dati.totale} />
        </div>
      )}
    </div>
  );
}
