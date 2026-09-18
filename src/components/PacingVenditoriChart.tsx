"use client";

import { useEffect, useState } from "react";
import { formatPercentuale } from "@/lib/format";
import { oggiIso } from "@/lib/roadmap";
import { ultimoGiornoDelMese } from "@/lib/kpi";
import { calcolaPacingMensile } from "@/lib/targetPacing";
import { calcolaQuoteVenditori } from "@/lib/venditori";
import { BloccoPacing } from "@/components/BloccoPacing";
import type { KpiResponse } from "@/types/kpi";

function meseCorrente(): string {
  return oggiIso().slice(0, 7);
}

/**
 * Blocco 6, opzione "Performance venditori" (Fase 2, 11/2026 — "risultati assegnabili a persona,
 * target di squadra ripartiti per capienza"). Stesso schema di fetch indipendente di
 * PacingTargetChart.tsx (mese in corso, non il periodo scelto nel filtro in alto) — stessa risposta
 * /api/kpi, qui si legge solo `dati.sede.venditori`/`risultatiVenditoriPeriodo` invece di
 * `dati.totale`/`dati.gruppi`.
 *
 * A differenza dei blocchi per categoria in PacingTargetChart, qui ci sono SOLO 2 metriche
 * (appuntamenti fissati e fatturato): sono le uniche con un target sliceable per persona
 * (Sede.targetAppuntamentiSettimana/targetFatturatoMensile, moltiplicati per la quota del
 * venditore) — budget/lead non hanno senso per persona (la spesa ads non è attribuibile a un
 * singolo venditore). "Vendite" (conteggio) resta solo informativo — mostrato come percentuale di
 * chiusura sugli appuntamenti, mai paceggiato: l'app non ha mai un target "numero vendite" da
 * nessuna parte (vedi il commento su RisultatoVenditoreRow in types/kpi.ts).
 */
export function PacingVenditoriChart({ clienteId, sedeId }: { clienteId: string; sedeId: string }) {
  const [dati, setDati] = useState<KpiResponse | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const mese = meseCorrente();

    Promise.resolve()
      .then(() => {
        setCaricamento(true);
        setErrore(null);
        const params = new URLSearchParams({ clienteId, sedeId, da: mese, a: mese });
        return fetch(`/api/kpi?${params.toString()}`, { signal: controller.signal });
      })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Errore nel caricamento");
        }
        return res.json() as Promise<KpiResponse>;
      })
      .then((body) => setDati(body))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
      })
      .finally(() => {
        if (!controller.signal.aborted) setCaricamento(false);
      });

    return () => controller.abort();
  }, [clienteId, sedeId]);

  if (caricamento) return <p className="text-sm text-ink-500">Caricamento…</p>;
  if (errore) return <p className="text-sm text-red-600">{errore}</p>;
  if (!dati) return null;

  const venditori = dati.sede.venditori ?? [];
  if (venditori.length === 0) {
    return (
      <p className="text-sm text-ink-500">
        Nessun venditore configurato per questa sede — aggiungili da &quot;Modifica cliente&quot; per vedere qui le loro performance.
      </p>
    );
  }

  const oggi = oggiIso();
  const meseAttuale = oggi.slice(0, 7);
  const giornoDelMese = Number(oggi.slice(-2));
  const giorniNelMese = Number(ultimoGiornoDelMese(meseAttuale).slice(-2));
  const fraz = giorniNelMese > 0 ? Math.min(giornoDelMese / giorniNelMese, 1) : 0;

  const quote = calcolaQuoteVenditori(venditori);
  const risultatiPer = new Map((dati.sede.risultatiVenditoriPeriodo ?? []).map((r) => [r.venditoreId, r]));

  const blocchi = venditori.map((venditore) => {
    const quota = quote.get(venditore.venditoreId) ?? 0;
    const risultato = risultatiPer.get(venditore.venditoreId);
    const metriche = calcolaPacingMensile({
      investimentoMese: 0,
      fatturatoMese: risultato?.fatturato ?? 0,
      leadMese: 0,
      appuntamentiMese: risultato?.appuntamentiFissati ?? 0,
      targetBudgetMensile: null,
      targetFatturatoMensile: dati.sede.targetFatturatoMensile != null ? dati.sede.targetFatturatoMensile * quota : null,
      targetLeadSettimana: null,
      targetAppuntamentiSettimana: dati.sede.targetAppuntamentiSettimana != null ? dati.sede.targetAppuntamentiSettimana * quota : null,
      giornoDelMese,
      giorniNelMese,
    });
    // Frazione 0-1 (non già ×100): formatPercentuale (lib/format.ts) moltiplica internamente,
    // stesso motivo per cui `quota` sotto viene passata così com'è a formatPercentuale.
    const chiusura = risultato && risultato.appuntamentiFissati > 0 ? risultato.vendite / risultato.appuntamentiFissati : null;
    return { venditore, quota, metriche, chiusura };
  });

  if (blocchi.every((b) => b.metriche.length === 0)) {
    return (
      <p className="text-sm text-ink-500">
        Nessun target di appuntamenti/fatturato impostato per questa sede — impostalo da &quot;Modifica cliente&quot; per vedere qui il ritmo dei venditori.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-500">
        Mese in corso, giorno {giornoDelMese} di {giorniNelMese} — la quota di ciascun venditore è proporzionale alla capienza dichiarata.
      </p>
      <div className="space-y-5">
        {blocchi.map(({ venditore, quota, metriche, chiusura }) => (
          <BloccoPacing
            key={venditore.venditoreId}
            titolo={venditore.nome}
            sottotitolo={`${formatPercentuale(quota)} del carico${chiusura != null ? ` · chiusura ${formatPercentuale(chiusura)}` : ""}`}
            metriche={metriche}
            fraz={fraz}
          />
        ))}
      </div>
    </div>
  );
}
