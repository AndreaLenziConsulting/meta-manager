"use client";

import { useEffect, useState } from "react";
import { formatPercentuale } from "@/lib/format";
import { oggiIso } from "@/lib/roadmap";
import { ultimoGiornoDelMese } from "@/lib/kpi";
import { calcolaPacingMensile } from "@/lib/targetPacing";
import { calcolaQuoteVenditori } from "@/lib/venditori";
import { BloccoPacing } from "@/components/BloccoPacing";
import type { KpiResponse } from "@/types/kpi";
import type { GhlRiepilogoResponse } from "@/types/ghl";

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
 *
 * Fase 4 (11/2026, automazione da GHL): un venditore con ghlUserId impostato E una sede connessa a
 * GHL sostituisce l'attuale di appuntamenti/fatturato con quello derivato da GHL
 * (ghlDati.perVenditore[venditore.venditoreId], join su assignedUserId/assignedTo — vedi
 * riepilogoPerVenditoreGhl in lib/ghl.ts) invece dei RisultatiVenditori inseriti a mano. Un
 * venditore senza ghlUserId (o una sede senza GHL) si comporta esattamente come in Fase 2, invariato.
 *
 * Filtro campagne (08/10/2026, chiesto dall'utente: "deve seguire il filtro campagne"): i numeri da
 * GHL sono quelli delle campagne scelte in alto, come nella vista "Andamento venditori" — lo stesso
 * parametro `campagne` passato a /api/ghl da KpiSection.tsx, che senza parametro applica il
 * predefinito della sede. Il periodo scelto in alto invece continua a non contare: il ritmo è sempre
 * quello del mese in corso. I risultati inseriti a mano non portano la campagna e restano quelli
 * inseriti. La nota sopra i blocchi dice sempre quali contatti stanno contando.
 */
export function PacingVenditoriChart({
  clienteId,
  sedeId,
  haConnessioneGhl,
  parametroCampagne,
  filtroCampagneAttivo,
}: {
  clienteId: string;
  sedeId: string;
  haConnessioneGhl: boolean;
  /** Il valore di `campagne` per /api/ghl, lo stesso della pagina: null = predefinito della sede. */
  parametroCampagne: string | null;
  /** Vero se in alto è scelto un sottoinsieme di campagne (anche quello predefinito della sede). */
  filtroCampagneAttivo: boolean;
}) {
  const [dati, setDati] = useState<KpiResponse | null>(null);
  const [ghlDati, setGhlDati] = useState<GhlRiepilogoResponse | null>(null);
  // Per quale filtro campagne sono i `ghlDati` che ho in mano ("" = predefinito). Cambiando le
  // campagne quelli di prima restano, attenuati, finché non arrivano i nuovi.
  const [campagneGhl, setCampagneGhl] = useState<string | null>(null);
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

  // Fetch GHL separato — stesso schema di PacingTargetChart.tsx (può essere lento, non deve
  // bloccare i numeri di RisultatiVenditori sopra).
  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve()
      .then(() => {
        if (!haConnessioneGhl) {
          setGhlDati(null);
          return undefined;
        }
        const mese = meseCorrente();
        const params = new URLSearchParams({ clienteId, sedeId, da: mese, a: mese });
        if (parametroCampagne) params.set("campagne", parametroCampagne);
        return fetch(`/api/ghl?${params.toString()}`, { signal: controller.signal })
          .then((res) => (res.ok ? res.json() : null))
          .then((body: GhlRiepilogoResponse | null) => {
            setGhlDati(body);
            setCampagneGhl(parametroCampagne ?? "");
          });
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setGhlDati(null);
      });
    return () => controller.abort();
  }, [clienteId, sedeId, haConnessioneGhl, parametroCampagne]);

  if (caricamento) return <p className="text-sm text-ink-500">Caricamento…</p>;
  if (errore) return <p className="text-sm text-critico">{errore}</p>;
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
    // Fase 4: presente solo se questo venditore ha un ghlUserId configurato E la sede è connessa a
    // GHL (vedi il commento in cima al file) — undefined per tutti gli altri, fallback ai
    // RisultatiVenditori di `risultato` esattamente come prima di questa fase.
    const daGhl = ghlDati?.connesso ? ghlDati.perVenditore?.[venditore.venditoreId] : undefined;
    const appuntamentiMese = daGhl ? daGhl.appuntamenti.totali : (risultato?.appuntamentiFissati ?? 0);
    const fatturatoMese = daGhl ? daGhl.opportunita.fatturato : (risultato?.fatturato ?? 0);
    const vendite = daGhl ? daGhl.opportunita.vendite : (risultato?.vendite ?? 0);
    const metriche = calcolaPacingMensile({
      investimentoMese: 0,
      fatturatoMese,
      leadMese: 0,
      appuntamentiMese,
      targetBudgetMensile: null,
      // Senza capienza indicata (facoltativa dall'08/10/2026) il venditore non ha una quota: nessun
      // target da inseguire, mai un target a zero.
      targetFatturatoMensile: dati.sede.targetFatturatoMensile != null && quota > 0 ? dati.sede.targetFatturatoMensile * quota : null,
      targetLeadSettimana: null,
      targetAppuntamentiSettimana: dati.sede.targetAppuntamentiSettimana != null && quota > 0 ? dati.sede.targetAppuntamentiSettimana * quota : null,
      giornoDelMese,
      giorniNelMese,
    });
    // Frazione 0-1 (non già ×100): formatPercentuale (lib/format.ts) moltiplica internamente,
    // stesso motivo per cui `quota` sotto viene passata così com'è a formatPercentuale.
    const chiusura = appuntamentiMese > 0 ? vendite / appuntamentiMese : null;
    return { venditore, quota, metriche, chiusura, daGhl: daGhl !== undefined };
  });

  if (blocchi.every((b) => b.metriche.length === 0)) {
    return (
      <p className="text-sm text-ink-500">
        {quote.size === 0 && (dati.sede.targetFatturatoMensile != null || dati.sede.targetAppuntamentiSettimana != null)
          ? "Nessun venditore ha una capienza indicata: senza, il target della sede non si può dividere fra loro. Si indica da \"Modifica cliente\", fra le impostazioni della sede."
          : "Nessun target di appuntamenti o fatturato impostato per questa sede: si imposta da \"Modifica cliente\", fra le impostazioni della sede."}
      </p>
    );
  }

  // Quali contatti contano nei numeri arrivati da GHL (vedi PerimetroVenditori in types/ghl.ts); null
  // se da GHL non arriva nessun venditore.
  const perimetro = ghlDati?.connesso && blocchi.some((b) => b.daGhl) ? (ghlDati.perimetroVenditori ?? "tutti") : null;
  const aManoNonDivisi = filtroCampagneAttivo && blocchi.some((b) => !b.daGhl);
  const inAggiornamento = haConnessioneGhl && ghlDati !== null && campagneGhl !== (parametroCampagne ?? "");

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-500">
        Mese in corso, giorno {giornoDelMese} di {giorniNelMese}, qualunque sia il periodo scelto in alto — la quota di ciascun venditore è proporzionale alla capienza dichiarata.
        {perimetro === "campagne-scelte" && " Segue il filtro campagne: da GHL contano solo i contatti arrivati dalle campagne scelte in alto."}
        {perimetro === "tutti" && " Da GHL contano tutti i contatti, qualunque sia la campagna."}
        {perimetro === "non-distinguibili" &&
          " Il filtro campagne qui non si applica: su GHL nessun contatto di questa sede risulta arrivato da una campagna, quindi contano tutti."}
        {aManoNonDivisi && " I risultati inseriti a mano non si dividono per campagna: restano quelli inseriti."}
        {inAggiornamento && (
          <span role="status" className="font-semibold text-ink-700">
            {" "}
            Aggiornamento…
          </span>
        )}
      </p>
      {/* Cambiate le campagne, i numeri di prima restano attenuati finché arrivano i nuovi. */}
      <div className="space-y-5" aria-busy={inAggiornamento} style={{ opacity: inAggiornamento ? 0.6 : 1, transition: "opacity 150ms" }}>
        {blocchi.map(({ venditore, quota, metriche, chiusura, daGhl }) => (
          <BloccoPacing
            key={venditore.venditoreId}
            titolo={venditore.nome}
            sottotitolo={`${quota > 0 ? `${formatPercentuale(quota)} del carico` : "capienza non indicata"}${chiusura != null ? ` · chiusura ${formatPercentuale(chiusura)}` : ""}${
              daGhl ? (perimetro === "campagne-scelte" ? " · via GHL, solo campagne scelte" : " · via GHL") : filtroCampagneAttivo ? " · a mano, non diviso per campagna" : ""
            }`}
            metriche={metriche}
            fraz={fraz}
          />
        ))}
      </div>
    </div>
  );
}
