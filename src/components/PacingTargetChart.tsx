"use client";

import { useEffect, useState } from "react";
import { formatEuro, formatNumero } from "@/lib/format";
import { oggiIso } from "@/lib/roadmap";
import { ultimoGiornoDelMese } from "@/lib/kpi";
import { applicaOverlayGhl } from "@/lib/kpiGhlOverlay";
import { calcolaPacingMensile, type MetricaPacing } from "@/lib/targetPacing";
import type { KpiGroup, KpiResponse } from "@/types/kpi";
import type { GhlRiepilogoResponse } from "@/types/ghl";

function meseCorrente(): string {
  return oggiIso().slice(0, 7);
}

const ETICHETTA_STATO: Record<MetricaPacing["stato"], string> = {
  successo: "In linea con il ritmo atteso",
  attenzione: "Leggermente indietro, recuperabile",
  critico: "Indietro rispetto al ritmo atteso",
};

const COLORE_STATO: Record<MetricaPacing["stato"], string> = {
  successo: "var(--pos)",
  attenzione: "var(--warn)",
  critico: "var(--neg)",
};

/**
 * Blocco 6, opzione "Target mensili" (default — richiesta utente 11/2026: "a che punto ci si trova
 * sui vari target mensili rispetto al giorno attuale"). A differenza degli altri grafici del blocco
 * 6 (FunnelConversioneChart/CostoPerRisultatoChart/...), NON riceve dati già scaricati dal
 * genitore: il mese in corso è un concetto indipendente dal periodo scelto nel filtro in alto
 * (che può mostrare mesi passati o un intervallo di più mesi) — fa il proprio fetch, scoped al
 * primo giorno del mese corrente fino a oggi, sempre e comunque.
 *
 * "Mese fino a oggi" non richiede alcun taglio esplicito per data: metaDaily/RisultatiCommerciali/
 * GHL non hanno mai dati per giorni futuri (non ancora accaduti), quindi computeKpi(da=a=mese
 * corrente) e /api/ghl con lo stesso mese restituiscono già solo l'accumulato fino ad oggi, senza
 * bisogno di troncare nulla qui.
 *
 * Categorie commerciali (Fase 1, 11/2026, "target diversi per fasce diverse di clienti/servizi"):
 * se la sede ne ha configurate (dati.sede.categorie, già nella stessa risposta /api/kpi già in
 * fetch qui — nessuna chiamata in più), un blocco di pacing per categoria si aggiunge PRIMA del
 * blocco esistente (ora etichettato "Totale sede" solo in quel caso). L'attuale per categoria viene
 * dal KpiGroup già raggruppato per tipoCampagna da computeKpi (dati.gruppi, join per nome===
 * tipoCampagna — vedi CategoriaCommerciale in types/kpi.ts) — DELIBERATAMENTE senza overlay GHL
 * (kpiGhlOverlay lavora solo sul totale sede, non ha un concetto di tipoCampagna): il blocco
 * "Totale sede" resta l'unico GHL-aware, i blocchi per categoria usano i RisultatiCommerciali grezzi
 * così come inseriti — una scelta di scope per questo giro, non un limite strutturale.
 */
export function PacingTargetChart({
  clienteId,
  sedeId,
  haConnessioneGhl,
  targetBudgetMensile,
  targetFatturatoMensile,
  targetLeadSettimana,
  targetAppuntamentiSettimana,
}: {
  clienteId: string;
  sedeId: string;
  haConnessioneGhl: boolean;
  targetBudgetMensile: number | null;
  targetFatturatoMensile: number | null;
  targetLeadSettimana: number | null;
  targetAppuntamentiSettimana: number | null;
}) {
  const [dati, setDati] = useState<KpiResponse | null>(null);
  const [ghlDati, setGhlDati] = useState<GhlRiepilogoResponse | null>(null);
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

  // Fetch GHL separato — stesso motivo/stesso schema del fetch GHL principale in KpiSection.tsx
  // (può essere lento, non deve bloccare i numeri Meta sopra). Mai filtro campagne qui: il pacing
  // guarda il mese intero della sede, non una selezione di campagne.
  useEffect(() => {
    const controller = new AbortController();
    // Promise.resolve().then() invece di un return/setState diretto nel corpo dell'effect — stesso
    // schema già in uso nel fetch GHL di KpiSection.tsx (regola react-hooks/set-state-in-effect).
    Promise.resolve()
      .then(() => {
        if (!haConnessioneGhl) {
          setGhlDati(null);
          return undefined;
        }
        const mese = meseCorrente();
        const params = new URLSearchParams({ clienteId, sedeId, da: mese, a: mese });
        return fetch(`/api/ghl?${params.toString()}`, { signal: controller.signal })
          .then((res) => (res.ok ? res.json() : null))
          .then((body: GhlRiepilogoResponse | null) => setGhlDati(body));
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setGhlDati(null);
      });
    return () => controller.abort();
  }, [clienteId, sedeId, haConnessioneGhl]);

  if (caricamento) return <p className="text-sm text-ink-500">Caricamento…</p>;
  if (errore) return <p className="text-sm text-red-600">{errore}</p>;
  if (!dati) return null;

  const overlay = applicaOverlayGhl(dati.totale, ghlDati, { filtroCampagneAttivo: false });
  const oggi = oggiIso();
  const meseAttuale = oggi.slice(0, 7);
  const giornoDelMese = Number(oggi.slice(-2));
  const giorniNelMese = Number(ultimoGiornoDelMese(meseAttuale).slice(-2));

  const metricheTotale = calcolaPacingMensile({
    investimentoMese: dati.totale.investimento,
    fatturatoMese: overlay.fatturato.valore,
    leadMese: dati.totale.numeroLead,
    appuntamentiMese: overlay.appuntamentiFissati.valore,
    targetBudgetMensile,
    targetFatturatoMensile,
    targetLeadSettimana,
    targetAppuntamentiSettimana,
    giornoDelMese,
    giorniNelMese,
  });

  const categorie = dati.sede.categorie ?? [];
  const gruppoPer = (nome: string): KpiGroup | undefined => dati.gruppi.find((g) => g.tipoCampagna === nome);
  const blocchiCategoria = categorie.map((categoria) => {
    const gruppo = gruppoPer(categoria.nome);
    return {
      categoria,
      metriche: calcolaPacingMensile({
        investimentoMese: gruppo?.investimento ?? 0,
        fatturatoMese: gruppo?.fatturato ?? 0,
        leadMese: gruppo?.numeroLead ?? 0,
        appuntamentiMese: gruppo?.appuntamentiFissati ?? 0,
        targetBudgetMensile: categoria.targetBudgetMensile,
        targetFatturatoMensile: categoria.targetFatturatoMensile,
        targetLeadSettimana: categoria.targetLeadSettimana,
        targetAppuntamentiSettimana: categoria.targetAppuntamentiSettimana,
        giornoDelMese,
        giorniNelMese,
      }),
    };
  });

  if (metricheTotale.length === 0 && blocchiCategoria.every((b) => b.metriche.length === 0)) {
    return (
      <p className="text-sm text-ink-500">
        Nessun target commerciale impostato per questa sede — impostali da &quot;Modifica cliente&quot; per vedere qui il ritmo del mese.
      </p>
    );
  }

  const fraz = giorniNelMese > 0 ? Math.min(giornoDelMese / giorniNelMese, 1) : 0;

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-500">
        Mese in corso, giorno {giornoDelMese} di {giorniNelMese} — quanto raccolto finora contro il ritmo lineare atteso a oggi.
      </p>
      <div className="space-y-5">
        {blocchiCategoria.map(({ categoria, metriche }) => (
          <BloccoPacing key={categoria.categoriaId} titolo={categoria.nome} metriche={metriche} fraz={fraz} />
        ))}
        <BloccoPacing titolo={categorie.length > 0 ? "Totale sede" : undefined} metriche={metricheTotale} fraz={fraz} />
      </div>
    </div>
  );
}

/** Un blocco di pacing (titolo opzionale + marker "Oggi" + righe) — estratto per essere ripetuto una
 * volta per categoria commerciale più una volta per il totale sede (vedi il commento sulle
 * categorie sopra). Il marker si ripete identico in ogni blocco invece di uno condiviso per l'intero
 * componente: stessa frazione di mese (`fraz` è lo stesso per tutti), ma bloccarlo a un'unica
 * posizione assoluta attraverso un numero variabile di blocchi impilati (0-4) avrebbe richiesto un
 * calcolo di altezza dinamico fragile per un guadagno visivo minimo. */
function BloccoPacing({ titolo, metriche, fraz }: { titolo?: string; metriche: MetricaPacing[]; fraz: number }) {
  if (metriche.length === 0) return null;
  return (
    <div>
      {titolo && <p className="text-xs font-semibold text-ink-700 mb-2">{titolo}</p>}
      <div className="relative pt-5">
        {/* Colore da --baseline (var(--baseline)), lo stesso token della guida verticale al
            passaggio del mouse in TrendChart.tsx — non una classe Tailwind ink-*: qui il progetto ha
            solo gli step 900/700/500/300 mappati (vedi globals.css), niente step intermedi come
            ink-400 utilizzabili come classe. */}
        <div className="absolute top-5 bottom-0 w-px z-10 pointer-events-none" style={{ left: `${fraz * 100}%`, backgroundColor: "var(--baseline)" }} />
        <span
          className="absolute top-0 z-10 -translate-x-1/2 text-[10px] font-semibold whitespace-nowrap pointer-events-none"
          style={{ left: `${fraz * 100}%`, color: "var(--text-muted)" }}
        >
          Oggi
        </span>
        <div className="space-y-4">
          {metriche.map((m) => (
            <RigaPacing key={m.chiave} metrica={m} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RigaPacing({ metrica }: { metrica: MetricaPacing }) {
  const formatValore = metrica.unita === "euro" ? formatEuro : formatNumero;
  const percentuale = metrica.targetMensile > 0 ? (metrica.attuale / metrica.targetMensile) * 100 : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-xs font-semibold text-ink-700">{metrica.etichetta}</span>
        <span className="text-xs text-ink-500 tabular-nums">
          {formatValore(metrica.attuale)} <span className="text-ink-500/60">/</span> {formatValore(metrica.targetMensile)}
        </span>
      </div>
      {/* Traccia grigia neutra (gray-200, non ink-*: nessuno step abbastanza chiaro mappato — vedi
          il commento sul marker sopra) + riempimento colorato per stato — spec "meter" della skill
          dataviz: il riempimento porta la severità, la traccia è solo il contenitore neutro. */}
      <div className="h-3 rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${Math.min(Math.max(percentuale, 0), 100)}%`, backgroundColor: COLORE_STATO[metrica.stato] }}
        />
      </div>
      <p className="text-[11px] mt-1" style={{ color: COLORE_STATO[metrica.stato] }}>
        {ETICHETTA_STATO[metrica.stato]}
      </p>
    </div>
  );
}
