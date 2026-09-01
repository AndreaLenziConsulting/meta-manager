"use client";

import { useEffect, useState } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { BoxGrafici } from "@/components/BoxGrafici";
import { DettaglioCampagneEsteso } from "@/components/DettaglioCampagneEsteso";
import { MonthRangePicker } from "@/components/MonthRangePicker";
import { CampagneFilter } from "@/components/CampagneFilter";
import { Tabs } from "@/components/Tabs";
import { Button } from "@/components/ui/Button";
import { SintesiTessere } from "@/components/SintesiTessere";
import { calcolaSalute } from "@/lib/salute";
import { formatMotivoIntervento } from "@/lib/saluteMessaggio";
import { attivitaInRitardo } from "@/lib/roadmap";
import { applicaOverlayGhl, applicaOverlayGhlTrend } from "@/lib/kpiGhlOverlay";
import type { AttivitaClienteRow, KpiResponse } from "@/types/kpi";
import type { GhlRiepilogoResponse } from "@/types/ghl";

function meseCorrente(): string {
  return new Date().toISOString().slice(0, 7);
}

// Default del filtro periodo: i mesi coperti dagli ultimi 30 giorni (oggi compreso), non più un
// intervallo fisso — su richiesta esplicita. Quasi sempre 2 mesi (il mese in corso + il
// precedente), tranne nei primissimi giorni del mese dove coincide con 1 solo mese.
function meseIniziale30Giorni(): string {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return d.toISOString().slice(0, 7);
}

// Numero di mesi coperti dal periodo selezionato (inclusivo su entrambi gli estremi) — serve a
// calcolare un periodo precedente di pari durata per il confronto sotto alle tessere di sintesi
// (vedi SintesiTessere.tsx/confrontoPeriodo.ts): "ultimi 30 giorni" (~1-2 mesi) si confronta con
// gli altrettanti mesi subito prima, "ultimi 3/6 mesi" allo stesso modo. Il filtro dell'app lavora
// a livello di mese (vedi /api/kpi), quindi il confronto resta anch'esso a livello di mese: è
// l'equivalente più fedele di "stesso numero di giorni prima" che l'architettura attuale permetta
// senza introdurre un secondo asse di filtro giorno-per-giorno.
function contaMesiPeriodo(da: string, a: string): number {
  const [dY, dM] = da.split("-").map(Number);
  const [aY, aM] = a.split("-").map(Number);
  return (aY - dY) * 12 + (aM - dM) + 1;
}

function spostaMesi(mese: string, delta: number): string {
  const [y, m] = mese.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type Props = { code?: string; clienteId?: string; haConnessioneGhl?: boolean; ruoloAdmin?: boolean };

/**
 * Contenuto della voce "KPI" dell'accordion in SchedaCliente.tsx — sostituisce KpiDashboard.tsx.
 * Fase 1 del redesign (blocchi 1-3): nome cliente e switcher sede sono usciti da qui (il primo è
 * ora ClienteHeader.tsx in cima alla pagina, fuori dall'accordion; il secondo si è spostato nella
 * riga filtri sotto — un filtro come gli altri due, non più accanto al nome). Tutto il resto
 * (tessere, grafico, tabella) resta identico a KpiDashboard.tsx per ora: viene sostituito blocco
 * per blocco nelle fasi successive del redesign (5, 6, 7), non tutto insieme.
 */
export function KpiSection({ code, clienteId, haConnessioneGhl, ruoloAdmin }: Props) {
  const [da, setDa] = useState(meseIniziale30Giorni());
  const [a, setA] = useState(meseCorrente());
  // Periodo precedente di pari durata (mesi), per il confronto sotto alle tessere di sintesi —
  // vedi il commento su contaMesiPeriodo/spostaMesi sopra e SintesiTessere.tsx.
  const aPrecedente = spostaMesi(da, -1);
  const daPrecedente = spostaMesi(da, -contaMesiPeriodo(da, a));
  const [dati, setDati] = useState<KpiResponse | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [sincronizzando, setSincronizzando] = useState(false);
  const [esitoSync, setEsitoSync] = useState<string | null>(null);
  // Form inline "+ Aggiungi ad account" nell'avviso sotto — mai aperto di default, solo admin.
  const [adAccountAperto, setAdAccountAperto] = useState(false);
  const [adAccountBozza, setAdAccountBozza] = useState("");
  const [salvandoAdAccount, setSalvandoAdAccount] = useState(false);
  const [erroreAdAccount, setErroreAdAccount] = useState<string | null>(null);
  // Solo per la vista interna (clienteId) — mai richiesto/mostrato sul link pubblico (code), vedi
  // il richiamo "solo per il team" più sotto e src/app/api/attivita/route.ts (già riservata al team).
  const [attivitaInRitardoCount, setAttivitaInRitardoCount] = useState(0);
  // Sostituisce (non affianca) le tessere Fatturato/Vendite/ROAS/CPA/Appuntamenti fissati con i
  // dati letti in diretta da GHL quando il cliente ha una connessione attiva — vedi
  // kpiGhlOverlay.ts per il perché di quali tessere sì e quali no. null = nessun dato GHL
  // disponibile (non connesso, filtro campagne attivo, o fetch non ancora arrivato).
  const [ghlDati, setGhlDati] = useState<GhlRiepilogoResponse | null>(null);
  // Stesse due variabili ma per il periodo precedente (confronto sotto alle tessere) — null finché
  // il rispettivo fetch non è arrivato o se non c'è un periodo precedente comparabile.
  const [datiPrecedenti, setDatiPrecedenti] = useState<KpiResponse | null>(null);
  const [ghlDatiPrecedenti, setGhlDatiPrecedenti] = useState<GhlRiepilogoResponse | null>(null);
  // Frequenza per campagna (blocco 7) — letta live sull'intero periodo, mai persistita (vedi
  // lib/meta.ts). Mappa vuota finché non arriva o se la chiamata fallisce: quella campagna mostra
  // "dato non disponibile" e non contribuisce al pallino, mai un falso verde.
  const [frequenzaPerCampagna, setFrequenzaPerCampagna] = useState<Record<string, number>>({});

  // Contesto = quale cliente/codice sto guardando, indipendente dalla sede: cambia solo quando si
  // naviga verso un cliente diverso, non quando si cambia sede all'interno dello stesso cliente.
  const contestoCliente = `${code ?? ""}|${clienteId ?? ""}`;
  // Sede scelta esplicitamente dall'utente in questo contesto — null finché non la sceglie, così
  // il fetch usa il default deciso dal server (prima sede attiva). Si azzera da sé passando a un
  // altro cliente (stesso pattern di filtroCampagne sotto).
  const [sedeScelta, setSedeScelta] = useState<{ contesto: string; sedeId: string | null }>({
    contesto: contestoCliente,
    sedeId: null,
  });
  const sedeId = sedeScelta.contesto === contestoCliente ? sedeScelta.sedeId : null;

  // Il filtro campagne è legato al contesto (cliente/codice + sede + periodo) in cui è stato scelto:
  // se quel contesto cambia, le campagne disponibili non sono più le stesse e si torna a "tutte" —
  // senza bisogno di un effect dedicato, è solo un valore derivato da confrontare col contesto corrente.
  const contestoAttuale = `${contestoCliente}|${sedeId ?? ""}|${da}|${a}`;
  const [filtroCampagne, setFiltroCampagne] = useState<{ contesto: string; selezionate: Set<string> | null }>({
    contesto: contestoAttuale,
    selezionate: null,
  });
  const campagneSelezionate = filtroCampagne.contesto === contestoAttuale ? filtroCampagne.selezionate : null;

  useEffect(() => {
    if (!code && !clienteId) return;
    const controller = new AbortController();
    // cumulato=1: aggiunge solo primaData/totaleCumulato alla risposta (calcolo additivo, riusa
    // dati già in memoria lato server — vedi api/kpi/route.ts), serve al grafico "Saldo netto
    // cumulato" (blocco 6c) per sapere da quale mese parte la storia della sede.
    const params = new URLSearchParams({ da, a, cumulato: "1" });
    if (code) params.set("code", code);
    if (clienteId) params.set("clienteId", clienteId);
    if (sedeId) params.set("sedeId", sedeId);
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
  }, [code, clienteId, sedeId, da, a, campagneSelezionate, refreshTick]);

  // Stesso fetch di sopra ma sul periodo precedente (daPrecedente/aPrecedente) — solo per il
  // confronto sotto alle tessere di sintesi, mai per il resto della pagina (grafico/tabella
  // restano sul periodo scelto dall'utente). Fallisce in silenzio (null): un confronto mancante
  // fa solo sparire l'indicatore, non è un errore da mostrare come i dati principali sopra.
  useEffect(() => {
    if (!code && !clienteId) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ da: daPrecedente, a: aPrecedente });
    if (code) params.set("code", code);
    if (clienteId) params.set("clienteId", clienteId);
    if (sedeId) params.set("sedeId", sedeId);
    if (campagneSelezionate) params.set("campagne", Array.from(campagneSelezionate).join(","));

    Promise.resolve()
      .then(() => fetch(`/api/kpi?${params.toString()}`, { signal: controller.signal }))
      .then((res) => (res.ok ? (res.json() as Promise<KpiResponse>) : null))
      .then((data) => setDatiPrecedenti(data))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setDatiPrecedenti(null);
      });

    return () => controller.abort();
  }, [code, clienteId, sedeId, daPrecedente, aPrecedente, campagneSelezionate, refreshTick]);

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

  // Dati GHL per l'overlay delle tessere KPI (vedi kpiGhlOverlay.ts) — fetch separato dal
  // /api/kpi principale sopra, stesso motivo di attivitaInRitardoCount: /api/ghl può essere lento
  // (chiama l'account GHL del cliente in diretta), non deve mai bloccare il caricamento dei numeri
  // Meta Ads. Mai sul link pubblico (code): gated su clienteId+haConnessioneGhl, mai su code.
  // sedeGhl legge la sede RISOLTA dal server (dati?.sede?.sedeId), non lo stato locale sedeId: se
  // sedeId è ancora null (default non ancora scelto) partirebbe un fetch senza sapere su quale sede,
  // stesso motivo per cui handleAggiornaKpi sotto usa dati?.sede?.sedeId e non sedeId.
  const sedeGhl = dati?.sede?.sedeId;
  useEffect(() => {
    const controller = new AbortController();
    // Promise.resolve().then() invece di un return/setState diretto nel corpo dell'effect: stesso
    // schema già in uso nel fetch principale sopra e in AttivitaTab.tsx/ProspectTab.tsx (regola
    // react-hooks/set-state-in-effect — niente setState sincrono nel corpo di un effect).
    Promise.resolve()
      .then(() => {
        if (!clienteId || !haConnessioneGhl || !sedeGhl || campagneSelezionate) {
          setGhlDati(null);
          return undefined;
        }
        const params = new URLSearchParams({ clienteId, sedeId: sedeGhl, da, a });
        return fetch(`/api/ghl?${params.toString()}`, { signal: controller.signal })
          .then((res) => (res.ok ? res.json() : null))
          .then((body: GhlRiepilogoResponse | null) => setGhlDati(body));
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setGhlDati(null);
      });
    return () => controller.abort();
  }, [clienteId, haConnessioneGhl, sedeGhl, da, a, campagneSelezionate, refreshTick]);

  // Stesso fetch GHL di sopra ma sul periodo precedente — serve perché il confronto sotto alle
  // tessere non deve mai mettere a confronto un valore "oggi" letto da GHL con un valore "ieri"
  // letto dal Funnel: sarebbe un confronto fra fonti diverse spacciato per un trend reale (stessa
  // regola di non-mescolare-provenienza già seguita altrove in questo file).
  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve()
      .then(() => {
        if (!clienteId || !haConnessioneGhl || !sedeGhl || campagneSelezionate) {
          setGhlDatiPrecedenti(null);
          return undefined;
        }
        const params = new URLSearchParams({ clienteId, sedeId: sedeGhl, da: daPrecedente, a: aPrecedente });
        return fetch(`/api/ghl?${params.toString()}`, { signal: controller.signal })
          .then((res) => (res.ok ? res.json() : null))
          .then((body: GhlRiepilogoResponse | null) => setGhlDatiPrecedenti(body));
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setGhlDatiPrecedenti(null);
      });
    return () => controller.abort();
  }, [clienteId, haConnessioneGhl, sedeGhl, daPrecedente, aPrecedente, campagneSelezionate, refreshTick]);

  // Frequenza per campagna (blocco 7, tabella Dettaglio) — stesso ciclo di vita del fetch GHL
  // sopra: una volta per apertura sezione, non solo aprendo la vista "per singola campagna", perché
  // la stessa mappa alimenterà anche gli avvisi operativi (blocco 4) più avanti nel redesign. Usa
  // la sede RISOLTA dal server (sedeGhl, già letto sopra), stesso motivo dell'effect GHL: prima che
  // /api/kpi risponda non sappiamo ancora su quale sede/ad account chiedere.
  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve()
      .then(() => {
        if (!clienteId || !sedeGhl) {
          setFrequenzaPerCampagna({});
          return undefined;
        }
        const params = new URLSearchParams({ clienteId, sedeId: sedeGhl, da, a });
        return fetch(`/api/meta-frequenza?${params.toString()}`, { signal: controller.signal })
          .then((res) => (res.ok ? res.json() : null))
          .then((body: { frequenzaPerCampagna: Record<string, number> } | null) => setFrequenzaPerCampagna(body?.frequenzaPerCampagna ?? {}));
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setFrequenzaPerCampagna({});
      });
    return () => controller.abort();
  }, [clienteId, sedeGhl, da, a, refreshTick]);

  // Mese di inizio storia della sede (da dati.primaData, letto grazie a cumulato=1 sul fetch
  // principale sopra) — serve al grafico "Saldo netto cumulato" (blocco 6c), che copre l'intera
  // storia della sede, non il periodo scelto nel filtro. Se il mese di inizio coincide (o è
  // successivo, caso limite) col `da` già selezionato, non c'è storia aggiuntiva da recuperare: si
  // riusa direttamente trendSettimanaleConOverlay sotto invece di una fetch praticamente identica.
  const meseInizioStorico = dati?.primaData ? dati.primaData.slice(0, 7) : null;
  const serveFetchCumulato = meseInizioStorico !== null && meseInizioStorico < da;

  const [datiCumulato, setDatiCumulato] = useState<KpiResponse | null>(null);
  useEffect(() => {
    if (!code && !clienteId) return;
    const controller = new AbortController();
    Promise.resolve()
      .then(() => {
        if (!meseInizioStorico || !serveFetchCumulato) {
          setDatiCumulato(null);
          return undefined;
        }
        const params = new URLSearchParams({ da: meseInizioStorico, a });
        if (code) params.set("code", code);
        if (clienteId) params.set("clienteId", clienteId);
        if (sedeId) params.set("sedeId", sedeId);
        if (campagneSelezionate) params.set("campagne", Array.from(campagneSelezionate).join(","));
        return fetch(`/api/kpi?${params.toString()}`, { signal: controller.signal })
          .then((res) => (res.ok ? (res.json() as Promise<KpiResponse>) : null))
          .then((data) => setDatiCumulato(data));
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setDatiCumulato(null);
      });

    return () => controller.abort();
  }, [code, clienteId, sedeId, meseInizioStorico, serveFetchCumulato, a, campagneSelezionate, refreshTick]);

  // Stesso principio del fetch GHL "periodo precedente" sopra: il saldo netto cumulato non deve
  // mai mettere a confronto un fatturato GHL (mostrato ovunque nella pagina, tessere comprese) con
  // un fatturato Funnel per le stesse settimane in questo solo grafico — stessa fonte ovunque.
  const [ghlDatiCumulato, setGhlDatiCumulato] = useState<GhlRiepilogoResponse | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve()
      .then(() => {
        if (!clienteId || !haConnessioneGhl || !sedeGhl || campagneSelezionate || !meseInizioStorico || !serveFetchCumulato) {
          setGhlDatiCumulato(null);
          return undefined;
        }
        const params = new URLSearchParams({ clienteId, sedeId: sedeGhl, da: meseInizioStorico, a });
        return fetch(`/api/ghl?${params.toString()}`, { signal: controller.signal })
          .then((res) => (res.ok ? res.json() : null))
          .then((body: GhlRiepilogoResponse | null) => setGhlDatiCumulato(body));
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setGhlDatiCumulato(null);
      });
    return () => controller.abort();
  }, [clienteId, haConnessioneGhl, sedeGhl, meseInizioStorico, serveFetchCumulato, a, campagneSelezionate, refreshTick]);

  // Fatturato/Vendite/ROAS/CPA/Appuntamenti fissati mostrati sotto: da GHL se connesso (e nessun
  // filtro campagne attivo), altrimenti dal Funnel come sempre — vedi kpiGhlOverlay.ts per il
  // dettaglio di quali tessere e perché non tutte.
  const overlayGhl = dati
    ? applicaOverlayGhl(dati.totale, campagneSelezionate ? null : ghlDati, {
        filtroCampagneAttivo: campagneSelezionate !== null,
      })
    : null;
  // Stesso overlay ma sul periodo precedente — per il confronto sotto alle tessere di sintesi,
  // vedi il commento sul fetch GHL precedente sopra per il perché.
  const overlayGhlPrecedente = datiPrecedenti
    ? applicaOverlayGhl(datiPrecedenti.totale, campagneSelezionate ? null : ghlDatiPrecedenti, {
        filtroCampagneAttivo: campagneSelezionate !== null,
      })
    : null;
  // Stesso overlay anche sul grafico: senza questo il fatturato del grafico resterebbe quello del
  // Funnel (spesso 0) mentre le tessere sopra mostrano già i numeri GHL — un'incoerenza visibile
  // sulla stessa pagina. Vedi applicaOverlayGhlTrend in kpiGhlOverlay.ts.
  const trendSettimanaleConOverlay = dati
    ? applicaOverlayGhlTrend(dati.trendSettimanale, campagneSelezionate ? null : ghlDati, {
        filtroCampagneAttivo: campagneSelezionate !== null,
      })
    : [];
  // Serie settimanale per il grafico "Saldo netto cumulato" (blocco 6c) — copre l'intera storia
  // della sede: se serve un fetch dedicato (vedi serveFetchCumulato sopra) usa quello, overlay-GHL
  // applicato allo stesso modo di trendSettimanaleConOverlay; altrimenti il periodo già selezionato
  // COINCIDE con tutta la storia disponibile, si riusa trendSettimanaleConOverlay direttamente.
  // null solo mentre il fetch dedicato è ancora in corso — il grafico mostra "Caricamento…".
  const serieSaldoNetto = !dati
    ? null
    : !serveFetchCumulato
      ? trendSettimanaleConOverlay
      : datiCumulato
        ? applicaOverlayGhlTrend(datiCumulato.trendSettimanale, campagneSelezionate ? null : ghlDatiCumulato, {
            filtroCampagneAttivo: campagneSelezionate !== null,
          })
        : null;

  // "Aggiorna KPI" controlla ora sia Meta che GHL — Meta Ads sincronizza davvero (scrive righe in
  // MetaDaily, da cui la dashboard legge), GHL invece è già letto in diretta dal tab KPI stesso
  // (vedi l'effect sopra e kpiGhlOverlay.ts): qui non c'è nulla da scrivere, solo da verificare che
  // il collegamento risponda e mostrarne un riepilogo insieme all'esito di Meta, in un solo messaggio.
  // Promise.allSettled (non un semplice Promise.all): un errore GHL non deve nascondere l'esito
  // reale della sincronizzazione Meta, e viceversa.
  async function handleAggiornaKpi() {
    if (!clienteId) return;
    setSincronizzando(true);
    setEsitoSync(null);
    const sedeId = dati?.sede?.sedeId;
    try {
      const [metaEsito, ghlEsito] = await Promise.allSettled([
        fetch("/api/sync-meta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clienteId }),
        }).then(async (res) => {
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body.error || "Aggiornamento non riuscito");
          return body as { righe: number };
        }),
        sedeId
          ? fetch(`/api/ghl?clienteId=${encodeURIComponent(clienteId)}&sedeId=${encodeURIComponent(sedeId)}`).then(async (res) => {
              const body = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(body.error || "Errore dal collegamento GHL");
              return body;
            })
          : Promise.resolve(null),
      ]);

      const parti: string[] = [];
      parti.push(
        metaEsito.status === "fulfilled"
          ? `Aggiornate ${metaEsito.value.righe} righe da Meta Ads`
          : `Meta Ads: ${metaEsito.reason instanceof Error ? metaEsito.reason.message : "errore sconosciuto"}`
      );
      if (ghlEsito.status === "rejected") {
        parti.push(`GHL: ${ghlEsito.reason instanceof Error ? ghlEsito.reason.message : "errore sconosciuto"}`);
      } else if (ghlEsito.value && !ghlEsito.value.connesso) {
        parti.push("GHL non collegato per questa sede");
      } else if (ghlEsito.value?.connesso) {
        parti.push(`GHL: ${ghlEsito.value.appuntamenti.totali} appuntamenti, ${ghlEsito.value.opportunita.vendite} vendite`);
      }
      setEsitoSync(parti.join(" · "));
      setRefreshTick((t) => t + 1);
    } finally {
      setSincronizzando(false);
    }
  }

  // Collega un ad account a una sede che ne è priva (opzionale alla creazione, vedi
  // /api/clienti) — stessa route PATCH usata da ModificaClienteModal, solo admin (già garantito
  // server-side, qui solo per non mostrare un pulsante che darebbe comunque 403). Dopo il
  // salvataggio, refreshTick fa ripartire il fetch KPI: l'avviso sparisce da sé quando
  // dati.sede.adAccountId torna valorizzato.
  async function handleSalvaAdAccount() {
    if (!dati) return;
    const valore = adAccountBozza.trim();
    if (!/^\d+$/.test(valore)) {
      setErroreAdAccount('Ad account id non valido: solo cifre, senza il prefisso "act_"');
      return;
    }
    setSalvandoAdAccount(true);
    setErroreAdAccount(null);
    try {
      const res = await fetch("/api/sedi", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sedeId: dati.sede.sedeId, adAccountId: valore }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Salvataggio non riuscito");
      setAdAccountAperto(false);
      setAdAccountBozza("");
      setRefreshTick((t) => t + 1);
    } catch (err) {
      setErroreAdAccount(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSalvandoAdAccount(false);
    }
  }

  // Motivo del richiamo: null quando non c'è nulla da segnalare, sempre e solo per la vista
  // interna — vedi formatMotivoIntervento per l'unico punto di verità su quando comparire.
  const motivo =
    clienteId && dati
      ? formatMotivoIntervento(
          calcolaSalute(dati.totale, dati.sede.targetCpa ?? null, dati.sede.targetCpl ?? null),
          attivitaInRitardoCount
        )
      : null;

  return (
    <div className="viz-root space-y-6">
      {dati && motivo && (
        <div className="flex flex-wrap items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 leading-relaxed flex-1 min-w-[220px]">
            <span className="font-semibold">Solo per te: </span>
            {motivo}
          </p>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-red-700/60 whitespace-nowrap">
            Visibile solo al team
          </span>
        </div>
      )}
      {/* Ad account opzionale alla creazione (vedi /api/clienti) — senza, questa sede non ha
          nessun dato Meta Ads da mostrare/sincronizzare. Mai sul link pubblico (gated su
          clienteId, mai valorizzato lì): un avviso "collega il tuo ad account" non avrebbe
          senso mostrato al cliente finale, è un'azione di configurazione del team. */}
      {dati && clienteId && !dati.sede.adAccountId && (
        <div className="rounded-xl bg-yellow-50 border border-yellow-100 text-yellow-800 text-xs p-3 space-y-2">
          <p>
            Nessun ad account Meta collegato per questa sede — niente da sincronizzare, i KPI restano a zero finché
            non lo colleghi.
          </p>
          {ruoloAdmin &&
            (adAccountAperto ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={adAccountBozza}
                  onChange={(e) => setAdAccountBozza(e.target.value)}
                  placeholder="Solo cifre, senza act_"
                  autoFocus
                  className="rounded-lg border border-yellow-200 bg-white px-2.5 py-1.5 text-xs text-ink-900 outline-none focus:ring-2 focus:ring-yellow-300 w-48"
                />
                <button
                  type="button"
                  onClick={handleSalvaAdAccount}
                  disabled={salvandoAdAccount}
                  className="rounded-lg bg-yellow-800 hover:bg-yellow-900 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 transition cursor-pointer"
                >
                  {salvandoAdAccount ? "Salvataggio…" : "Salva"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdAccountAperto(false);
                    setErroreAdAccount(null);
                  }}
                  className="text-yellow-800/70 hover:text-yellow-900 text-xs font-medium px-1 cursor-pointer"
                >
                  Annulla
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdAccountAperto(true)}
                className="rounded-lg bg-yellow-800 hover:bg-yellow-900 text-white text-xs font-semibold px-3 py-1.5 transition cursor-pointer"
              >
                + Aggiungi ad account
              </button>
            ))}
          {erroreAdAccount && <p className="text-red-600">{erroreAdAccount}</p>}
        </div>
      )}

      {/* Riga filtri: data, sede (solo se il cliente ne ha più di una — un filtro come gli altri,
          non più accostata al nome cliente come prima di questo redesign), campagne. Azione +
          relativo esito a destra. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <MonthRangePicker
            da={da}
            a={a}
            onChange={(nDa, nA) => {
              setDa(nDa);
              setA(nA);
            }}
          />

          {dati && dati.sediDisponibili.length > 1 && (
            <Tabs
              tabs={dati.sediDisponibili.map((s) => ({ id: s.sedeId, label: s.nome }))}
              attivo={dati.sede.sedeId}
              onChange={(id) => setSedeScelta({ contesto: contestoCliente, sedeId: id })}
            />
          )}

          {dati && (
            <CampagneFilter
              campagneDisponibili={dati.campagneDisponibili}
              selezionate={campagneSelezionate}
              onChange={(selezionate) => setFiltroCampagne({ contesto: contestoAttuale, selezionate })}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {clienteId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAggiornaKpi}
              disabled={sincronizzando}
              className="flex items-center gap-2 bg-surface-card py-2 shadow-sm"
            >
              <RefreshCw size={14} className={sincronizzando ? "animate-spin" : ""} />
              {sincronizzando ? "Aggiornamento…" : "Aggiorna KPI"}
            </Button>
          )}

          {esitoSync && <span className="text-xs text-ink-500">{esitoSync}</span>}
        </div>
      </div>

      {errore && <p className="text-sm text-red-600">{errore}</p>}

      {caricamento && !dati && <p className="text-sm text-ink-500">Caricamento…</p>}

      {dati && (
        <div className="space-y-6" style={{ opacity: caricamento ? 0.6 : 1, transition: "opacity 150ms" }}>
          <div>
            <SintesiTessere
              totale={dati.totale}
              overlayGhl={overlayGhl}
              totalePrecedente={datiPrecedenti?.totale ?? null}
              overlayGhlPrecedente={overlayGhlPrecedente}
            />
            {overlayGhl?.parziale && (
              <p className="text-xs bg-yellow-50 border border-yellow-100 text-yellow-800 rounded-lg px-3 py-2.5 mt-5">
                Uno o più calendari GHL non erano raggiungibili al momento del caricamento — i numeri di
                &quot;Appuntamenti fissati/effettuati&quot;, &quot;% effettuati su fissati&quot; e &quot;Tasso di chiusura&quot;
                potrebbero essere incompleti (vendite e fatturato non sono interessati).
              </p>
            )}
          </div>

          <BoxGrafici
            funnel={{
              numeroLead: dati.totale.numeroLead,
              appuntamentiFissati: overlayGhl?.appuntamentiFissati.valore ?? dati.totale.appuntamentiFissati,
              appuntamentiEffettuati: overlayGhl?.appuntamentiEffettuati.valore ?? dati.totale.appuntamentiEffettuati,
              numeroVendite: overlayGhl?.numeroVendite.valore ?? dati.totale.numeroVendite,
            }}
            trendSettimanaleConOverlay={trendSettimanaleConOverlay}
            serieSaldoNetto={serieSaldoNetto}
          />

          <DettaglioCampagneEsteso
            gruppi={dati.gruppi}
            totale={dati.totale}
            campagne={dati.campagne}
            frequenzaPerCampagna={frequenzaPerCampagna}
            targetCpl={dati.sede.targetCpl ?? null}
            mostraValutazione={Boolean(clienteId)}
          />
        </div>
      )}
    </div>
  );
}
