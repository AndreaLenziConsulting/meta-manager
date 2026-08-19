"use client";

import { useEffect, useState } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { TrendChart } from "@/components/TrendChart";
import { KpiTable } from "@/components/KpiTable";
import { MonthRangePicker } from "@/components/MonthRangePicker";
import { CampagneFilter } from "@/components/CampagneFilter";
import { Button } from "@/components/ui/Button";
import { formatEuro, formatNumero, formatPercentuale, formatRoas } from "@/lib/format";
import { calcolaSalute } from "@/lib/salute";
import { formatMotivoIntervento } from "@/lib/saluteMessaggio";
import { attivitaInRitardo } from "@/lib/roadmap";
import type { AttivitaClienteRow, KpiResponse } from "@/types/kpi";

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
  // Solo per la vista interna (clienteId) — mai richiesto/mostrato sul link pubblico (code), vedi
  // il richiamo "solo per il team" più sotto e src/app/api/attivita/route.ts (già riservata al team).
  const [attivitaInRitardoCount, setAttivitaInRitardoCount] = useState(0);

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
    const controller = new AbortController();
    const params = new URLSearchParams({ da, a });
    if (code) params.set("code", code);
    if (clienteId) params.set("clienteId", clienteId);
    if (campagneSelezionate) params.set("campagne", Array.from(campagneSelezionate).join(","));

    Promise.resolve()
      .then(() => {
        setCaricamento(true);
        setErrore(null);
        return fetch(`/api/kpi?${params.toString()}`, { signal: controller.signal });
      })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Errore nel caricamento dei dati");
        }
        return res.json();
      })
      .then((data: KpiResponse) => setDati(data))
      .catch((err) => {
        // Una richiesta abortita (perché ne è già partita una più recente) non è un errore da mostrare:
        // i suoi setState arriverebbero comunque dopo quelli della richiesta in corso, sovrascrivendoli.
        if (err instanceof DOMException && err.name === "AbortError") return;
        setErrore(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCaricamento(false);
      });

    return () => controller.abort();
  }, [code, clienteId, da, a, campagneSelezionate, refreshTick]);

  // Conteggio attività in ritardo per il richiamo "solo per il team" — indipendente dal periodo
  // scelto per i KPI (le attività non hanno stagionalità), quindi un effect separato legato solo a
  // clienteId. /api/attivita non ha mai un ramo `code`: sul link pubblico questo fetch non parte.
  // Nessun reset a 0 quando clienteId manca: `motivo` più sotto è comunque gated su `clienteId`,
  // quindi un conteggio residuo non gated non verrebbe mai letto/mostrato.
  useEffect(() => {
    if (!clienteId) return;
    const controller = new AbortController();
    fetch(`/api/attivita?clienteId=${encodeURIComponent(clienteId)}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { gruppi: { attivita: AttivitaClienteRow[] }[] } | null) => {
        if (!body) return;
        const tutte = body.gruppi.flatMap((g) => g.attivita);
        setAttivitaInRitardoCount(attivitaInRitardo(tutte).length);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [clienteId]);

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

  // Motivo del richiamo: null quando non c'è nulla da segnalare, sempre e solo per la vista
  // interna — vedi formatMotivoIntervento per l'unico punto di verità su quando comparire.
  const motivo =
    clienteId && dati
      ? formatMotivoIntervento(
          calcolaSalute(dati.totale, dati.cliente.targetCpa ?? null, dati.cliente.targetCpl ?? null),
          attivitaInRitardoCount
        )
      : null;

  const metricheSecondarie = dati
    ? [
        { label: "Investimento", value: formatEuro(dati.totale.investimento) },
        { label: "Lead", value: formatNumero(dati.totale.numeroLead) },
        { label: "Costo per Lead", value: formatEuro(dati.totale.costoPerLead) },
        { label: "Appuntamenti effettuati", value: formatNumero(dati.totale.appuntamentiEffettuati) },
        { label: "% effettuati su fissati", value: formatPercentuale(dati.totale.percentualeEffettuatiSuFissati) },
        { label: "Vendite", value: formatNumero(dati.totale.numeroVendite) },
        { label: "Tasso di chiusura", value: formatPercentuale(dati.totale.tassoDiChiusura) },
        { label: "ROAS", value: formatRoas(dati.totale.roas) },
        { label: "CPA", value: formatEuro(dati.totale.cpa) },
      ]
    : [];

  return (
    <div className="viz-root space-y-6">
      {dati && (
        <div>
          <h2 className="font-heading font-bold text-2xl text-ink-900">{dati.cliente.nome}</h2>
          {motivo && (
            <div className="mt-3 flex flex-wrap items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
              <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-[13px] text-red-700 leading-relaxed flex-1 min-w-[220px]">
                <span className="font-semibold">Solo per te: </span>
                {motivo}
              </p>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-red-700/60 whitespace-nowrap">
                Visibile solo al team
              </span>
            </div>
          )}
        </div>
      )}

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
          <Button variant="ghost" size="sm" onClick={handleAggiornaKpi} disabled={sincronizzando} className="flex items-center gap-2 bg-surface-card shadow-sm">
            <RefreshCw size={14} className={sincronizzando ? "animate-spin" : ""} />
            {sincronizzando ? "Aggiornamento…" : "Aggiorna KPI"}
          </Button>
        )}

        {esitoSync && <span className="text-xs text-ink-500">{esitoSync}</span>}
      </div>

      {errore && <p className="text-sm text-red-600">{errore}</p>}

      {caricamento && !dati && <p className="text-sm text-ink-500">Caricamento…</p>}

      {dati && (
        <div className="space-y-6" style={{ opacity: caricamento ? 0.6 : 1, transition: "opacity 150ms" }}>
          <div>
            <div className="pb-5 mb-5 border-b border-ink-300/60">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-500">Fatturato</p>
              <p className="font-heading font-bold text-4xl sm:text-5xl text-ink-900 mt-1.5 tabular-nums">
                {formatEuro(dati.totale.fatturato)}
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-5">
              {metricheSecondarie.map((m) => (
                <div key={m.label}>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">{m.label}</p>
                  <p className="font-heading font-bold text-lg text-ink-900 mt-1 tabular-nums">{m.value}</p>
                </div>
              ))}
            </div>
          </div>

          <TrendChart trend={dati.trend} trendSettimanale={dati.trendSettimanale} />

          <KpiTable gruppi={dati.gruppi} totale={dati.totale} campagne={dati.campagne} />
        </div>
      )}
    </div>
  );
}
