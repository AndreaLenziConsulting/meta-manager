"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { oggiIso } from "@/lib/roadmap";
import { ultimoGiornoDelMese } from "@/lib/kpi";
import { spostaMese } from "@/lib/periodo";
import { formatMeseEsteso } from "@/lib/format";
import { applicaOverlayGhl } from "@/lib/kpiGhlOverlay";
import { calcolaPacingMensile } from "@/lib/targetPacing";
import { BloccoPacing } from "@/components/BloccoPacing";
import { BloccoSenzaCluster } from "@/components/BloccoSenzaCluster";
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
 * mese scelto qui dentro.
 *
 * Mese di riferimento selezionabile (richiesta utente 01/10/2026): di default il mese corrente, con
 * le frecce si va ai mesi precedenti (mai a un mese futuro, non avrebbe dati). Un mese già concluso
 * è letto come risultato finale contro il target intero — nessun marker "Oggi", etichette "Target
 * raggiunto / non raggiunto" (vedi BloccoPacing) — e sempre contro i target impostati OGGI: l'app
 * non conserva lo storico dei target, e la nota in testa lo dice.
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
 *
 * "Senza cluster" (20/09/2026, segnalato dall'utente: il totale sede non coincideva con la somma dei
 * blocchi per categoria) — un blocco in più, dopo quelli per categoria e prima di "Totale sede", che
 * mostra ghlDati.senzaTag (BloccoSenzaCluster.tsx): i conteggi dei contatti senza NESSUNO dei tag
 * configurati, senza target/pacing — solo per non far sparire in silenzio numeri che il totale sede
 * include ma nessun cluster cattura. Visibile solo se c'è almeno una categoria con tagGhl configurato
 * (altrimenti "senza cluster" non è una domanda sensata) e solo se contiene almeno un dato non a zero.
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
  // Stato del fetch GHL sotto: finché è "caricamento" i blocchi per cluster NON vengono disegnati
  // (mostrerebbero 0/79 per qualche secondo, letto dall'utente come "non misura i cluster" — bug
  // segnalato 27/09/2026); "errore" mostra una nota esplicita invece di zeri silenziosi.
  const [ghlStato, setGhlStato] = useState<"caricamento" | "ok" | "errore">("caricamento");
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  // Mese di riferimento (YYYY-MM): quello corrente finché l'utente non ne sceglie un altro.
  const [mese, setMese] = useState(meseCorrente);

  useEffect(() => {
    const controller = new AbortController();

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
  }, [clienteId, sedeId, mese]);

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
          setGhlStato("ok");
          return undefined;
        }
        setGhlStato("caricamento");
        // Cambiando mese i dati GHL del mese precedente non devono mai restare accanto ai numeri
        // Meta di quello nuovo, nemmeno per i secondi che GHL impiega a rispondere.
        setGhlDati(null);
        const params = new URLSearchParams({ clienteId, sedeId, da: mese, a: mese });
        return fetch(`/api/ghl?${params.toString()}`, { signal: controller.signal })
          .then((res) => {
            setGhlStato(res.ok ? "ok" : "errore");
            return res.ok ? res.json() : null;
          })
          .then((body: GhlRiepilogoResponse | null) => setGhlDati(body));
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setGhlStato("errore");
        setGhlDati(null);
      });
    return () => controller.abort();
  }, [clienteId, sedeId, haConnessioneGhl, mese]);

  // Sempre visibile, anche durante il caricamento o con un errore: è l'unico modo di cambiare mese.
  const selettore = <SelettoreMese mese={mese} meseMassimo={meseCorrente()} onChange={setMese} />;

  if (caricamento) {
    return (
      <div className="space-y-4">
        {selettore}
        <p className="text-sm text-ink-500">Caricamento…</p>
      </div>
    );
  }
  if (errore) {
    return (
      <div className="space-y-4">
        {selettore}
        <p className="text-sm text-red-600">{errore}</p>
      </div>
    );
  }
  if (!dati) return selettore;

  const overlay = applicaOverlayGhl(dati.totale, ghlDati, { filtroCampagneAttivo: false });
  const oggi = oggiIso();
  // Mese già concluso: il "giorno del mese" è l'ultimo, quindi il ritmo atteso coincide col target
  // intero (frazione 1) e le barre mostrano il risultato finale.
  const concluso = mese < oggi.slice(0, 7);
  const giorniNelMese = Number(ultimoGiornoDelMese(mese).slice(-2));
  const giornoDelMese = concluso ? giorniNelMese : Number(oggi.slice(-2));

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
      // I numeri GHL del cluster così come sono: mostrati da soli quando il cluster non ha nessun
      // target (BloccoPacing non disegnerebbe nulla e il cluster sparirebbe dal grafico).
      datiGhl: daGhl,
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

  const senzaCluster = ghlDati?.connesso ? ghlDati.senzaTag : undefined;
  const senzaClusterHaDati =
    senzaCluster !== undefined &&
    (senzaCluster.richieste > 0 ||
      senzaCluster.appuntamenti.totali > 0 ||
      senzaCluster.opportunita.vendite > 0 ||
      senzaCluster.opportunita.fatturato > 0);

  // Cluster calcolati da GHL (tag o pipeline): i loro numeri si mostrano anche senza target, quindi
  // una sede che ne ha non è mai "vuota" — nemmeno mentre GHL sta ancora caricando.
  const haClusterAutomatici =
    Boolean(haConnessioneGhl) && categorie.some((c) => c.tagGhl.trim() !== "" || (c.pipelineGhl ?? "").trim() !== "");

  if (metricheTotale.length === 0 && blocchiCategoria.every((b) => b.metriche.length === 0) && !haClusterAutomatici) {
    return (
      <div className="space-y-4">
        {selettore}
        <p className="text-sm text-ink-500">
          Nessun target commerciale impostato per questa sede — impostali da &quot;Modifica cliente&quot; per vedere qui il ritmo del mese.
        </p>
      </div>
    );
  }

  const fraz = giorniNelMese > 0 ? Math.min(giornoDelMese / giorniNelMese, 1) : 0;
  const ghlInCaricamento = Boolean(haConnessioneGhl) && ghlStato === "caricamento";
  const ghlFallito = Boolean(haConnessioneGhl) && ghlStato === "errore";
  // Finché GHL carica, fatturato e appuntamenti del totale sede non sono ancora quelli veri (GHL li
  // sostituisce appena arriva): si mostrano solo le righe che vengono da Meta, mai uno zero
  // provvisorio — col selettore del mese l'attesa capita a ogni cambio, non solo all'apertura.
  const metricheTotaleVisibili = ghlInCaricamento
    ? metricheTotale.filter((m) => m.chiave === "budget" || m.chiave === "lead")
    : metricheTotale;

  return (
    <div className="space-y-4">
      {selettore}
      <p className="text-xs text-ink-500">
        {concluso
          ? "Mese concluso — risultato finale contro i target impostati oggi (l'app non conserva i target di allora)."
          : `Mese in corso, giorno ${giornoDelMese} di ${giorniNelMese} — quanto raccolto finora contro il ritmo lineare atteso a oggi.`}
      </p>
      {ghlInCaricamento && <p className="text-xs text-ink-500">Dati GHL in caricamento… i blocchi per cluster compaiono tra pochi secondi.</p>}
      {ghlFallito && (
        <p className="text-xs text-red-600">Dati GHL non disponibili: i cluster mostrano solo i Risultati Commerciali inseriti a mano.</p>
      )}
      <div className="space-y-5">
        {!ghlInCaricamento &&
          blocchiCategoria.map(({ categoria, metriche, daGhl, datiGhl }) =>
            metriche.length === 0 && datiGhl ? (
              <BloccoSenzaCluster
                key={categoria.categoriaId}
                dati={datiGhl}
                titolo={categoria.nome}
                descrizione="Numeri del mese da GHL. Nessun target impostato per questo cluster: aggiungilo da Modifica cliente per vedere il ritmo."
                neutro
              />
            ) : (
              <BloccoPacing
                key={categoria.categoriaId}
                titolo={categoria.nome}
                sottotitolo={daGhl ? "da GHL" : undefined}
                metriche={metriche}
                fraz={fraz}
                concluso={concluso}
              />
            )
          )}
        {senzaClusterHaDati && senzaCluster && <BloccoSenzaCluster dati={senzaCluster} />}
        <BloccoPacing
          titolo={categorie.length > 0 ? "Totale sede" : undefined}
          metriche={metricheTotaleVisibili}
          fraz={fraz}
          concluso={concluso}
        />
      </div>
    </div>
  );
}

/** Frecce mese precedente/successivo attorno al nome del mese. `meseMassimo` = mese corrente: oltre
 * non si va (un mese futuro non ha dati). Il link di ritorno compare solo quando serve. */
function SelettoreMese({ mese, meseMassimo, onChange }: { mese: string; meseMassimo: string; onChange: (mese: string) => void }) {
  const alMassimo = mese >= meseMassimo;
  const classeFreccia =
    "h-8 w-8 inline-flex items-center justify-center rounded-lg border border-[var(--glass-border-soft)] text-ink-700 hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed";
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button type="button" className={classeFreccia} onClick={() => onChange(spostaMese(mese, -1))} aria-label="Mese precedente">
        <ChevronLeft size={16} />
      </button>
      <span className="min-w-[9.5rem] text-center text-sm font-semibold text-ink-900">{formatMeseEsteso(mese)}</span>
      <button
        type="button"
        className={classeFreccia}
        onClick={() => onChange(spostaMese(mese, 1))}
        disabled={alMassimo}
        aria-label="Mese successivo"
      >
        <ChevronRight size={16} />
      </button>
      {!alMassimo && (
        <button type="button" className="text-xs font-semibold text-brand underline underline-offset-2" onClick={() => onChange(meseMassimo)}>
          Torna al mese corrente
        </button>
      )}
    </div>
  );
}
