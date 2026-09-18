"use client";

import { useEffect, useState } from "react";
import { oggiIso } from "@/lib/roadmap";
import { ultimoGiornoDelMese } from "@/lib/kpi";
import { applicaOverlayGhl } from "@/lib/kpiGhlOverlay";
import { calcolaPacingMensile } from "@/lib/targetPacing";
import { BloccoPacing } from "@/components/BloccoPacing";
import type { KpiGroup, KpiResponse } from "@/types/kpi";
import type { GhlRiepilogoResponse } from "@/types/ghl";

function meseCorrente(): string {
  return oggiIso().slice(0, 7);
}

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
 * tipoCampagna — vedi CategoriaCommerciale in types/kpi.ts).
 *
 * Fase 3 (11/2026, automazione da tag GHL): quando la categoria ha un tagGhl impostato E la sede è
 * connessa a GHL, l'attuale di richieste/appuntamenti/fatturato viene sostituito con quello derivato
 * dal tag contatto (ghlDati.perTag[categoria.categoriaId], vedi riepilogoPerTag in lib/ghl.ts) invece
 * dei RisultatiCommerciali inseriti a mano per quella categoria — il budget resta SEMPRE da
 * dati.gruppi (Meta ads), mai da GHL, che non ha un concetto di spesa pubblicitaria. Una categoria
 * senza tagGhl (o una sede senza GHL connesso) si comporta esattamente come in Fase 1, invariata.
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
    // Fase 3: presente solo se questa categoria ha un tagGhl configurato E la sede è connessa a GHL
    // (vedi il commento in cima al file) — undefined per tutte le altre, fallback ai
    // RisultatiCommerciali di gruppo esattamente come prima di questa fase.
    const daGhl = ghlDati?.connesso ? ghlDati.perTag?.[categoria.categoriaId] : undefined;
    return {
      categoria,
      daGhl: daGhl !== undefined,
      metriche: calcolaPacingMensile({
        investimentoMese: gruppo?.investimento ?? 0,
        fatturatoMese: daGhl ? daGhl.opportunita.fatturato : (gruppo?.fatturato ?? 0),
        leadMese: daGhl ? daGhl.richieste : (gruppo?.numeroLead ?? 0),
        appuntamentiMese: daGhl ? daGhl.appuntamenti.totali : (gruppo?.appuntamentiFissati ?? 0),
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
        {blocchiCategoria.map(({ categoria, metriche, daGhl }) => (
          <BloccoPacing
            key={categoria.categoriaId}
            titolo={categoria.nome}
            sottotitolo={daGhl ? "via tag GHL" : undefined}
            metriche={metriche}
            fraz={fraz}
          />
        ))}
        <BloccoPacing titolo={categorie.length > 0 ? "Totale sede" : undefined} metriche={metricheTotale} fraz={fraz} />
      </div>
    </div>
  );
}
