"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PencilLine, RefreshCw } from "lucide-react";
import { BoxGrafici } from "@/components/BoxGrafici";
import { DettaglioCampagneEsteso, type DettaglioGhl, type DettaglioInserzioni } from "@/components/DettaglioCampagneEsteso";
import { CampagneFilter } from "@/components/CampagneFilter";
import { PARAMETRO_TUTTE_LE_CAMPAGNE } from "@/lib/campagneAlc";
import { Tabs } from "@/components/Tabs";
import { DateRangePicker, type SelezionePeriodo } from "@/components/DateRangePicker";
import { etichettaIntervallo, intervalloPreset, mesiEquivalenti, periodoPrecedente } from "@/lib/periodo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Nota } from "@/components/ui/Nota";
import { SintesiTessere, type StatoFontiCommerciali } from "@/components/SintesiTessere";
import { AvvisiOperativi } from "@/components/AvvisiOperativi";
import { FaseCompletataBanner } from "@/components/FaseCompletataBanner";
import { AndamentoCommerciale } from "@/components/AndamentoCommerciale";
import { RisultatiCommercialiModal } from "@/components/RisultatiCommercialiModal";
import { calcolaSalute } from "@/lib/salute";
import { generaAvvisiOperativi } from "@/lib/avvisiOperativi";
import { SOGLIA_FREQUENZA } from "@/lib/valutazioneCampagna";
import { trovaInserzioniOutlier, type AnagraficaInserzioneFuoriPeriodo, type InserzioneConStato } from "@/lib/inserzioniOutlier";
import { risultatiDaBreakdown } from "@/lib/dettaglioGhl";
import { confrontaTargetCommerciali } from "@/lib/targetCommerciali";
import { attivitaInRitardo } from "@/lib/roadmap";
import { applicaOverlayGhl, applicaOverlayGhlTrend } from "@/lib/kpiGhlOverlay";
import type { AttivitaClienteRow, KpiResponse } from "@/types/kpi";
import type { GhlRiepilogoResponse } from "@/types/ghl";

type Props = { code?: string; clienteId?: string; haConnessioneGhl?: boolean; ruoloAdmin?: boolean };

// Riferimento stabile per il link pubblico `code` (dove KpiResponse.anagraficaCampagne non arriva):
// un `[]` scritto inline sarebbe un array nuovo a ogni render, vedi ghlDettaglio più sotto.
const EMPTY_ANAGRAFICA_CAMPAGNE: NonNullable<KpiResponse["anagraficaCampagne"]> = [];

/**
 * Contenuto della voce "KPI" dell'accordion in SchedaCliente.tsx — sostituisce KpiDashboard.tsx.
 * Fase 1 del redesign (blocchi 1-3): nome cliente e switcher sede sono usciti da qui (il primo è
 * ora ClienteHeader.tsx in cima alla pagina, fuori dall'accordion; il secondo si è spostato nella
 * riga filtri sotto — un filtro come gli altri due, non più accanto al nome). Tutto il resto
 * (tessere, grafico, tabella) resta identico a KpiDashboard.tsx per ora: viene sostituito blocco
 * per blocco nelle fasi successive del redesign (5, 6, 7), non tutto insieme.
 */
export function KpiSection({ code, clienteId, haConnessioneGhl, ruoloAdmin }: Props) {
  // Periodo = due giorni inclusi (selettore in stile Meta, 26/09/2026 — vedi DateRangePicker.tsx e
  // lib/periodo.ts), default "Ultimi 30 giorni" esatti, oggi compreso (l'intento originale della
  // richiesta "ultimi 30 giorni", finora approssimato ai mesi interi coperti). `confronto` = periodo
  // di paragone scelto a mano nel picker, null = automatico (stesso numero di giorni subito prima).
  const [periodo, setPeriodo] = useState<SelezionePeriodo>(() => ({
    ...intervalloPreset("ultimi-30-giorni"),
    preset: "ultimi-30-giorni",
    confronto: null,
  }));
  const { da, a } = periodo;
  const { da: daPrecedente, a: aPrecedente } = periodo.confronto ?? periodoPrecedente(da, a);
  const [dati, setDati] = useState<KpiResponse | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  // Quale valore di refreshTick deve saltare la cache da 30s di /api/kpi — SOLO quello impostato da
  // un "Aggiorna KPI" manuale (handleAggiornaKpi sotto), mai le normali navigazioni (cambio periodo/
  // sede/campagne, che restano cached per velocità). Un ref (non uno state) confrontato col
  // refreshTick corrente dentro ai due effect che fanno fetch /api/kpi sotto — niente reset esplicito
  // da gestire: resta "vero" solo finché refreshTick non avanza di nuovo, ed entrambi gli effect
  // leggono lo stesso valore nello stesso giro, senza dipendere dall'ordine in cui girano (un
  // reset-dentro-un-effect romperebbe l'altro, vedi bug "serve cliccare 2-3 volte", 11/09/2026).
  const frescoPerTickRef = useRef<number | null>(null);
  const [sincronizzando, setSincronizzando] = useState(false);
  const [esitoSync, setEsitoSync] = useState<string | null>(null);
  // Finestra "Inserisci risultati" (08/10/2026): i risultati commerciali che prima si scrivevano a
  // mano nel foglio Google. Solo vista interna, come il pulsante che la apre.
  const [risultatiAperti, setRisultatiAperti] = useState(false);
  // Form inline "+ Aggiungi ad account" nell'avviso sotto — mai aperto di default, solo admin.
  const [adAccountAperto, setAdAccountAperto] = useState(false);
  const [adAccountBozza, setAdAccountBozza] = useState("");
  const [salvandoAdAccount, setSalvandoAdAccount] = useState(false);
  const [erroreAdAccount, setErroreAdAccount] = useState<string | null>(null);
  // Solo per la vista interna (clienteId) — mai richiesto/mostrato sul link pubblico (code), vedi
  // il richiamo "solo per il team" più sotto e src/app/api/attivita/route.ts (già riservata al team).
  const [attivitaInRitardoCount, setAttivitaInRitardoCount] = useState(0);
  // Banner "tappa raggiunta" (vista milestone, Fase 1 roadmap) — a differenza di AvvisiOperativi
  // sotto, QUESTO va anche sul link pubblico `code`: è l'unica superficie che il cliente finale ha
  // sul progresso del progetto (il tab Attività resta riservato al team, vedi SchedaCliente.tsx),
  // quindi /api/fasi-completate ha un ramo `code` dedicato — a differenza di /api/attivita. Risposta
  // volutamente minimale (solo fase+data): vedi FaseCompletataBanner.tsx.
  const [fasiCompletate, setFasiCompletate] = useState<{ fase: string; completataIl: string }[]>([]);
  // Sostituisce (non affianca) le tessere Fatturato/Vendite/ROAS/CPA/Appuntamenti fissati con i
  // dati letti in diretta da GHL quando il cliente ha una connessione attiva — vedi
  // kpiGhlOverlay.ts per il perché di quali tessere sì e quali no. null = nessun dato GHL
  // disponibile (non connesso, filtro campagne attivo, o fetch non ancora arrivato).
  const [ghlDati, setGhlDati] = useState<GhlRiepilogoResponse | null>(null);
  // true se l'ultimo fetch di /api/ghl è fallito (risposta non ok o eccezione) — distingue "dati
  // GHL non ancora arrivati" da "GHL non disponibile" per gli avvisi operativi (vedi
  // generaAvvisiOperativi: ghlAtteso/ghlErrore). Azzerato a ogni nuovo fetch.
  const [ghlErrore, setGhlErrore] = useState(false);
  // Stesse due variabili ma per il periodo precedente (confronto sotto alle tessere) — null finché
  // il rispettivo fetch non è arrivato o se non c'è un periodo precedente comparabile.
  const [datiPrecedenti, setDatiPrecedenti] = useState<KpiResponse | null>(null);
  const [ghlDatiPrecedenti, setGhlDatiPrecedenti] = useState<GhlRiepilogoResponse | null>(null);
  // Frequenza per campagna (blocco 7) — letta live sull'intero periodo, mai persistita (vedi
  // lib/meta.ts). Mappa vuota finché non arriva o se la chiamata fallisce: quella campagna mostra
  // "dato non disponibile" e non contribuisce al pallino, mai un falso verde.
  const [frequenzaPerCampagna, setFrequenzaPerCampagna] = useState<Record<string, number>>({});
  // Inserzioni (ad) per il controllo qualità "outlier CPL" (blocco 4) — vedi il fetch dedicato più
  // sotto e inserzioniOutlier.ts. Array vuoto finché non arriva o se non c'è nulla da leggere.
  const [inserzioni, setInserzioni] = useState<InserzioneConStato[]>([]);
  // Stato del fetch inserzioni + anagrafica delle inserzioni senza spesa nel periodo — solo per la
  // vista "Per singola inserzione" del Dettaglio (01/10/2026), che deve distinguere "in caricamento"
  // / "Meta non ha risposto" da "nessuna inserzione nel periodo". Il controllo outlier sopra continua
  // a leggere solo `inserzioni` (array vuoto = nessun avviso), comportamento invariato.
  const [inserzioniExtra, setInserzioniExtra] = useState<{
    stato: "caricamento" | "ok" | "errore";
    altre: Record<string, AnagraficaInserzioneFuoriPeriodo>;
  }>({ stato: "caricamento", altre: {} });

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
  // se quel contesto cambia, le campagne disponibili non sono più le stesse e si torna al
  // predefinito — senza bisogno di un effect dedicato, è solo un valore derivato da confrontare col
  // contesto corrente.
  //
  // Tre stati (06/10/2026, vedi src/lib/campagneAlc.ts): "predefinito" = decide il server (solo le
  // campagne con ALC nel nome, se la sede ne ha, altrimenti tutte); "tutte" = tutte, scelto a mano;
  // un Set = selezione a mano. Prima esistevano solo "tutte" (null) e la selezione.
  const contestoAttuale = `${contestoCliente}|${sedeId ?? ""}|${da}|${a}`;
  const [filtroCampagne, setFiltroCampagne] = useState<{ contesto: string; scelta: "predefinito" | "tutte" | Set<string> }>({
    contesto: contestoAttuale,
    scelta: "predefinito",
  });
  const sceltaCampagne = filtroCampagne.contesto === contestoAttuale ? filtroCampagne.scelta : "predefinito";
  // Quello che va in `campagne` verso /api/kpi e /api/ghl: null = parametro assente (predefinito del
  // server). Una stringa, non il Set: è ciò da cui dipendono i fetch, e resta uguale finché la scelta
  // non cambia davvero (un Set ricostruito a ogni risposta li farebbe ripartire in ciclo).
  const parametroCampagne =
    sceltaCampagne === "predefinito" ? null : sceltaCampagne === "tutte" ? PARAMETRO_TUTTE_LE_CAMPAGNE : Array.from(sceltaCampagne).join(",");

  useEffect(() => {
    if (!code && !clienteId) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ da, a });
    if (code) params.set("code", code);
    if (clienteId) params.set("clienteId", clienteId);
    if (sedeId) params.set("sedeId", sedeId);
    if (parametroCampagne) params.set("campagne", parametroCampagne);
    if (frescoPerTickRef.current === refreshTick) params.set("noCache", "1");

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
  }, [code, clienteId, sedeId, da, a, parametroCampagne, refreshTick]);

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
    if (parametroCampagne) params.set("campagne", parametroCampagne);
    if (frescoPerTickRef.current === refreshTick) params.set("noCache", "1");

    Promise.resolve()
      .then(() => fetch(`/api/kpi?${params.toString()}`, { signal: controller.signal }))
      .then((res) => (res.ok ? (res.json() as Promise<KpiResponse>) : null))
      .then((data) => setDatiPrecedenti(data))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setDatiPrecedenti(null);
      });

    return () => controller.abort();
  }, [code, clienteId, sedeId, daPrecedente, aPrecedente, parametroCampagne, refreshTick]);

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

  // Fasi completate di recente (vedi commento sopra su fasiCompletate) — indipendente dal periodo
  // scelto per i KPI, stesso motivo di attivitaInRitardoCount: le tappe di roadmap non hanno
  // stagionalità. Gated su code||clienteId (a differenza dell'effect sopra, gated solo su clienteId):
  // qui il ramo pubblico esiste davvero, vedi /api/fasi-completate.
  useEffect(() => {
    if (!code && !clienteId) return;
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (code) params.set("code", code);
    if (clienteId) params.set("clienteId", clienteId);
    fetch(`/api/fasi-completate?${params.toString()}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { fasi: { fase: string; completataIl: string }[] } | null) => setFasiCompletate(body?.fasi ?? []))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [code, clienteId]);

  // Dati GHL per l'overlay delle tessere KPI (vedi kpiGhlOverlay.ts) — fetch separato dal
  // /api/kpi principale sopra, stesso motivo di attivitaInRitardoCount: /api/ghl può essere lento
  // (chiama l'account GHL del cliente in diretta), non deve mai bloccare il caricamento dei numeri
  // Meta Ads. Mai sul link pubblico (code): gated su clienteId+haConnessioneGhl, mai su code.
  // sedeGhl legge la sede RISOLTA dal server (dati?.sede?.sedeId), non lo stato locale sedeId: se
  // sedeId è ancora null (default non ancora scelto) partirebbe un fetch senza sapere su quale sede,
  // stesso motivo per cui handleAggiornaKpi sotto usa dati?.sede?.sedeId e non sedeId.
  //
  // Il filtro campagne NON blocca più questo fetch (a differenza di prima della feature
  // "appuntamenti per campagna", 08/09/2026): si passa `campagne` a /api/ghl, che restringe
  // appuntamenti/opportunità ai soli contatti attribuiti a quelle campagne — vedi kpiGhlOverlay.ts
  // per cosa succede quando questa sede non ha ancora nessuna attribuzione disponibile.
  const sedeGhl = dati?.sede?.sedeId;
  useEffect(() => {
    const controller = new AbortController();
    // Promise.resolve().then() invece di un return/setState diretto nel corpo dell'effect: stesso
    // schema già in uso nel fetch principale sopra e in AttivitaTab.tsx/ProspectTab.tsx (regola
    // react-hooks/set-state-in-effect — niente setState sincrono nel corpo di un effect).
    Promise.resolve()
      .then(() => {
        if (!clienteId || !haConnessioneGhl || !sedeGhl) {
          setGhlDati(null);
          setGhlErrore(false);
          return undefined;
        }
        setGhlErrore(false);
        const params = new URLSearchParams({ clienteId, sedeId: sedeGhl, da, a });
        if (parametroCampagne) params.set("campagne", parametroCampagne);
        return fetch(`/api/ghl?${params.toString()}`, { signal: controller.signal })
          .then((res) => {
            setGhlErrore(!res.ok);
            return res.ok ? res.json() : null;
          })
          .then((body: GhlRiepilogoResponse | null) => setGhlDati(body));
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setGhlErrore(true);
        setGhlDati(null);
      });
    return () => controller.abort();
  }, [clienteId, haConnessioneGhl, sedeGhl, da, a, parametroCampagne, refreshTick]);

  // Stesso fetch GHL di sopra ma sul periodo precedente — serve perché il confronto sotto alle
  // tessere non deve mai mettere a confronto un valore "oggi" letto da GHL con un valore "ieri"
  // letto da RisultatiCommerciali: sarebbe un confronto fra fonti diverse spacciato per un trend reale (stessa
  // regola di non-mescolare-provenienza già seguita altrove in questo file).
  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve()
      .then(() => {
        if (!clienteId || !haConnessioneGhl || !sedeGhl) {
          setGhlDatiPrecedenti(null);
          return undefined;
        }
        const params = new URLSearchParams({ clienteId, sedeId: sedeGhl, da: daPrecedente, a: aPrecedente });
        if (parametroCampagne) params.set("campagne", parametroCampagne);
        return fetch(`/api/ghl?${params.toString()}`, { signal: controller.signal })
          .then((res) => (res.ok ? res.json() : null))
          .then((body: GhlRiepilogoResponse | null) => setGhlDatiPrecedenti(body));
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setGhlDatiPrecedenti(null);
      });
    return () => controller.abort();
  }, [clienteId, haConnessioneGhl, sedeGhl, daPrecedente, aPrecedente, parametroCampagne, refreshTick]);

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

  // Inserzioni (blocco 4, controllo qualità) — stesso ciclo di vita del fetch frequenza sopra:
  // dati grezzi per inserzione (spesa/lead/stato), la soglia di outlier si applica lato client
  // in inserzioniOutlier sotto (stesso schema "dati qui, soglia là" di campagneFrequenzaAlta).
  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve()
      .then(() => {
        if (!clienteId || !sedeGhl) {
          setInserzioni([]);
          setInserzioniExtra({ stato: "caricamento", altre: {} });
          return undefined;
        }
        setInserzioniExtra({ stato: "caricamento", altre: {} });
        const params = new URLSearchParams({ clienteId, sedeId: sedeGhl, da, a });
        // L'anagrafica delle inserzioni senza spesa nel periodo serve solo a dare un nome alle righe
        // a cui GHL attribuisce un risultato: chiesta solo per le sedi connesse a GHL.
        if (haConnessioneGhl) params.set("anagrafica", "1");
        return fetch(`/api/meta-inserzioni?${params.toString()}`, { signal: controller.signal })
          .then((res) => (res.ok ? res.json() : null))
          .then(
            (
              body: {
                inserzioni: InserzioneConStato[];
                altreInserzioni?: Record<string, AnagraficaInserzioneFuoriPeriodo>;
                errore?: boolean;
              } | null
            ) => {
              setInserzioni(body?.inserzioni ?? []);
              setInserzioniExtra({ stato: !body || body.errore ? "errore" : "ok", altre: body?.altreInserzioni ?? {} });
            }
          );
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setInserzioni([]);
        setInserzioniExtra({ stato: "errore", altre: {} });
      });
    return () => controller.abort();
  }, [clienteId, sedeGhl, haConnessioneGhl, da, a, refreshTick]);

  // Le campagne effettivamente considerate, null = tutte. Con la scelta "predefinito" è ciò che il
  // server ha applicato (dati.campagnePredefinite): serve qui solo per mostrare il filtro, restringere
  // tabella Dettaglio e inserzioni, e dire all'overlay GHL che un filtro è attivo.
  const predefiniteSede = dati?.campagnePredefinite ?? null;
  const campagneSelezionate = useMemo<Set<string> | null>(() => {
    if (sceltaCampagne === "tutte") return null;
    if (sceltaCampagne !== "predefinito") return sceltaCampagne;
    return predefiniteSede ? new Set(predefiniteSede) : null;
  }, [sceltaCampagne, predefiniteSede]);

  // Le righe della finestra "Inserisci risultati": un tipo di campagna per riga, quelli delle campagne
  // che la scheda conta di suo (il predefinito della sede, se c'è) — un risultato inserito sotto un
  // tipo che il filtro predefinito esclude non comparirebbe nei numeri. "" = campagne senza tipo
  // ("Non classificata" nel resto della pagina). Senza campagne resta la sola riga senza tipo.
  const tipiPerRisultati = useMemo(() => {
    const anagrafica = dati?.anagraficaCampagne ?? EMPTY_ANAGRAFICA_CAMPAGNE;
    const contate = predefiniteSede ? anagrafica.filter((c) => predefiniteSede.includes(c.campaignId)) : anagrafica;
    const tipi = Array.from(new Set(contate.map((c) => (c.tipoCampagna === "Non classificata" ? "" : c.tipoCampagna)))).sort((x, y) => x.localeCompare(y));
    return tipi.length > 0 ? tipi : [""];
  }, [dati, predefiniteSede]);

  // Fatturato/Vendite/ROAS/CPA/Appuntamenti fissati mostrati sotto: da GHL se connesso (scoped
  // alle campagne selezionate quando quella sede ha attribuzione disponibile), altrimenti da
  // RisultatiCommerciali come sempre — vedi kpiGhlOverlay.ts per il dettaglio di quali tessere e
  // perché non tutte. `ghlDati` non va più forzato a null quando un filtro campagne è attivo (a
  // differenza di prima della feature "appuntamenti per campagna"): è già scoped da /api/ghl
  // stesso (vedi il fetch sopra), applicaOverlayGhl decide da sola se è affidabile.
  const overlayGhl = dati
    ? applicaOverlayGhl(dati.totale, ghlDati, { filtroCampagneAttivo: campagneSelezionate !== null })
    : null;
  // Stesso overlay ma sul periodo precedente — per il confronto sotto alle tessere di sintesi,
  // vedi il commento sul fetch GHL precedente sopra per il perché.
  const overlayGhlPrecedente = datiPrecedenti
    ? applicaOverlayGhl(datiPrecedenti.totale, ghlDatiPrecedenti, { filtroCampagneAttivo: campagneSelezionate !== null })
    : null;
  // Stato delle fonti dei numeri commerciali per le tessere (vedi SintesiTessere.tsx): finché GHL
  // non ha risposto le tessere dicono "lettura in corso", e senza righe inserite a mano né GHL dicono
  // "Non compilato" — mai uno zero che non è un dato. `ghlDati` resta quello del periodo precedente
  // durante un cambio periodo (non torna null), quindi qui "in arrivo" vale solo al primo caricamento.
  const fontiCommerciali = useMemo<StatoFontiCommerciali>(
    () => ({
      manualePresente: Boolean(dati?.risultatiCommercialiNelPeriodo),
      ghlInArrivo: Boolean(clienteId && haConnessioneGhl) && ghlDati === null && !ghlErrore,
      ghlErrore,
    }),
    [dati, clienteId, haConnessioneGhl, ghlDati, ghlErrore]
  );
  // Stesso overlay anche sul grafico: senza questo il fatturato del grafico resterebbe quello di
  // RisultatiCommerciali (spesso 0) mentre le tessere sopra mostrano già i numeri GHL — un'incoerenza visibile
  // sulla stessa pagina. Vedi applicaOverlayGhlTrend in kpiGhlOverlay.ts. Memoizzato (non un valore
  // derivato diretto come sopra): serve anche come dipendenza di confrontoTarget più sotto, dove un
  // nuovo array a ogni render vanificherebbe la memoizzazione di quel useMemo.
  const trendSettimanaleConOverlay = useMemo(
    () =>
      dati
        ? applicaOverlayGhlTrend(dati.trendSettimanale, ghlDati, { filtroCampagneAttivo: campagneSelezionate !== null })
        : [],
    [dati, ghlDati, campagneSelezionate]
  );

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
      setRefreshTick((t) => {
        const nuovo = t + 1;
        frescoPerTickRef.current = nuovo; // legge fresco da Sheets, mai la cache da 30s — vedi sopra
        return nuovo;
      });
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

  // Campagne ATTIVE con frequenza sopra soglia (blocco 4) — stessa soglia di valutazioneCampagna.ts
  // (blocco 7), mai un secondo "2.5" duplicato. Solo attive: una campagna in pausa non è azionabile
  // ora, stessa regola già seguita dal pallino di Dettaglio campagne.
  const campagneFrequenzaAlta = useMemo(() => {
    if (!dati) return [];
    return dati.campagne
      .filter((c) => c.stato === "ACTIVE")
      .map((c) => ({ nomeCampagna: c.nomeCampagna, frequenza: frequenzaPerCampagna[c.campaignId] ?? null }))
      .filter((c): c is { nomeCampagna: string; frequenza: number } => c.frequenza !== null && c.frequenza > SOGLIA_FREQUENZA);
  }, [dati, frequenzaPerCampagna]);

  // Inserzioni outlier (blocco 4, controllo qualità) — il CPL medio di campagna può essere nella
  // norma pur nascondendo una singola inserzione che sta bruciando budget, vedi
  // trovaInserzioniOutlier in inserzioniOutlier.ts. Target CPL della sede corrente, come il resto
  // dei giudizi CPL già in uso (valutazioneCampagna.ts).
  const inserzioniOutlier = useMemo(
    () =>
      trovaInserzioniOutlier(
        // Solo le inserzioni delle campagne considerate: un'inserzione di una campagna non gestita
        // dall'agenzia non deve generare un avviso "da spegnere".
        campagneSelezionate ? inserzioni.filter((i) => campagneSelezionate.has(i.campaignId)) : inserzioni,
        dati?.sede.targetCpl ?? null
      ),
    [inserzioni, dati, campagneSelezionate]
  );

  // Dati per le colonne commerciali e la vista "Per singola inserzione" della tabella Dettaglio
  // (blocco 7) — memoizzati perché DettaglioCampagneEsteso ci costruisce sopra i suoi useMemo: un
  // oggetto nuovo a ogni render li ricalcolerebbe ogni volta. "assente" anche sul link pubblico
  // `code` (clienteId assente): GHL lì non arriva mai.
  const ghlDettaglio = useMemo<DettaglioGhl>(() => {
    if (!clienteId || !haConnessioneGhl || (ghlDati !== null && !ghlDati.connesso)) return { stato: "assente" };
    if (ghlErrore) return { stato: "errore" };
    if (!ghlDati?.connesso) return { stato: "caricamento" };
    return {
      stato: "ok",
      fonte: ghlDati.fonte ?? "ghl",
      perCampagna: ghlDati.perCampagna,
      perInserzione: ghlDati.perInserzione ?? {},
      totale: risultatiDaBreakdown(ghlDati),
    };
  }, [clienteId, haConnessioneGhl, ghlDati, ghlErrore]);
  const inserzioniDettaglio = useMemo<DettaglioInserzioni>(
    () => ({ stato: inserzioniExtra.stato, righe: inserzioni, altre: inserzioniExtra.altre }),
    [inserzioni, inserzioniExtra]
  );

  // Target commerciali (Fase 1 roadmap, blocco 4) — confronta i 4 target di sede con l'andamento
  // reale del periodo selezionato, vedi confrontaTargetCommerciali in targetCommerciali.ts. Stessa
  // fonte fatturato di SintesiTessere (overlayGhl se connesso, altrimenti RisultatiCommerciali) — mai un
  // confronto contro un fatturato diverso da quello già mostrato nelle tessere sopra.
  const confrontoTarget = useMemo(() => {
    if (!dati) return { budgetMensile: null, leadSettimana: null, appuntamentiSettimana: null, fatturatoMensile: null };
    return confrontaTargetCommerciali({
      targetBudgetMensile: dati.sede.targetBudgetMensile ?? null,
      targetLeadSettimana: dati.sede.targetLeadSettimana ?? null,
      targetAppuntamentiSettimana: dati.sede.targetAppuntamentiSettimana ?? null,
      targetFatturatoMensile: dati.sede.targetFatturatoMensile ?? null,
      investimentoPeriodo: dati.totale.investimento,
      fatturatoPeriodo: overlayGhl?.fatturato.valore ?? dati.totale.fatturato,
      // Un intervallo di giorni qualsiasi non ha un numero intero di mesi: mesiEquivalenti (durata
      // media di un mese) fa da divisore in confrontaTargetCommerciali per riportare
      // investimento/fatturato del periodo a un ritmo "per mese" comparabile col target mensile.
      numeroMesiPeriodo: mesiEquivalenti(da, a),
      serieSettimanale: trendSettimanaleConOverlay.map((s) => ({ numeroLead: s.numeroLead, appuntamentiFissati: s.appuntamentiFissati })),
    });
  }, [dati, overlayGhl, da, a, trendSettimanaleConOverlay]);

  // Blocco 4 — Avvisi operativi: si ricalcola da solo quando cambiano periodo/campagne/sede, dato
  // che tutti gli input (dati, ghlDati, frequenzaPerCampagna, attivitaInRitardoCount) sono già
  // scoped a quel contesto. Gated su Boolean(clienteId) dal chiamante sotto — mai sul link pubblico
  // `code`, mai per un ruolo commerciale (mai un clienteId per quel ruolo, vedi authz.ts).
  const avvisiOperativi = useMemo(() => {
    if (!clienteId || !dati) return [];
    return generaAvvisiOperativi({
      valutazioneSalute: calcolaSalute(dati.totale, dati.sede.targetCpa ?? null, dati.sede.targetCpl ?? null),
      attivitaInRitardoCount,
      meseSenzaRisultatiCommerciali: dati.meseSenzaRisultatiCommerciali ?? [],
      ghl: ghlDati,
      ghlAtteso: Boolean(haConnessioneGhl),
      ghlErrore,
      campagneFrequenzaAlta,
      inserzioniOutlier,
      confrontoTarget,
    });
  }, [clienteId, dati, attivitaInRitardoCount, ghlDati, haConnessioneGhl, ghlErrore, campagneFrequenzaAlta, inserzioniOutlier, confrontoTarget]);

  return (
    <div className="viz-root space-y-6">
      {/* Riga filtri: data, sede (solo se il cliente ne ha più di una — un filtro come gli altri,
          non più accostata al nome cliente come prima di questo redesign), campagne. Azione +
          relativo esito a destra. Prima cosa dentro la sezione KPI (blocco 3), sempre — anche
          durante il caricamento, mai preceduta da avvisi/banner. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Selettore periodo unico in stile Meta (preset + due calendari a giorni + confronto),
              anche sul link pubblico `code`: sostituisce il picker a mesi che già ci stava, non
              espone nessun target. Il bottone mostra già l'esatto intervallo di giorni scelto. */}
          <DateRangePicker valore={periodo} onChange={setPeriodo} />

          {dati && dati.sediDisponibili.length > 1 && (
            <Tabs
              etichetta="Sede"
              tabs={dati.sediDisponibili.map((s) => ({ id: s.sedeId, label: s.nome }))}
              attivo={dati.sede.sedeId}
              onChange={(id) => setSedeScelta({ contesto: contestoCliente, sedeId: id })}
            />
          )}

          {dati && (
            <CampagneFilter
              campagneDisponibili={dati.campagneDisponibili}
              selezionate={campagneSelezionate}
              onChange={(selezionate) => setFiltroCampagne({ contesto: contestoAttuale, scelta: selezionate ?? "tutte" })}
              predefinito={
                predefiniteSede
                  ? {
                      attivo: sceltaCampagne === "predefinito",
                      onRipristina: () => setFiltroCampagne({ contesto: contestoAttuale, scelta: "predefinito" }),
                    }
                  : undefined
              }
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Solo vista interna: sul link pubblico il cliente non inserisce nulla. */}
          {clienteId && dati && (
            <Button variant="secondary" onClick={() => setRisultatiAperti(true)} className="min-h-10 bg-surface-card py-2">
              <PencilLine size={16} aria-hidden="true" />
              Inserisci risultati
            </Button>
          )}

          {clienteId && (
            <Button variant="secondary" onClick={handleAggiornaKpi} disabled={sincronizzando} className="min-h-10 bg-surface-card py-2">
              <RefreshCw size={16} aria-hidden="true" className={sincronizzando ? "animate-spin" : ""} />
              {sincronizzando ? "Aggiornamento…" : "Aggiorna KPI"}
            </Button>
          )}

          {esitoSync && (
            <span role="status" className="text-xs text-ink-500">
              {esitoSync}
            </span>
          )}
        </div>
      </div>

      {errore && (
        <Nota tono="critico" etichetta="Dati non caricati" role="alert">
          <p>{errore}</p>
        </Nota>
      )}

      {caricamento && !dati && (
        <p role="status" className="text-sm text-ink-500">
          Caricamento…
        </p>
      )}

      {dati && (
        <div className="space-y-6" style={{ opacity: caricamento ? 0.6 : 1, transition: "opacity 150ms" }}>
          {/* Vista milestone (Fase 1 roadmap) — buona notizia, quindi per prima cosa, prima
              dell'eventuale avviso ad account sotto. Visibile anche sul link pubblico `code`. */}
          <FaseCompletataBanner fasi={fasiCompletate} />

          {/* Ad account opzionale alla creazione (vedi /api/clienti) — senza, questa sede non ha
              nessun dato Meta Ads da mostrare/sincronizzare. Mai sul link pubblico (gated su
              clienteId, mai valorizzato lì): un avviso "collega il tuo ad account" non avrebbe
              senso mostrato al cliente finale, è un'azione di configurazione del team. Resta un
              banner dedicato (non un avviso generico nel pannello sotto): è l'unico avviso che ha
              un'azione diretta inline, un messaggio di solo testo nella lista gli toglierebbe
              proprio quella. */}
          {clienteId && !dati.sede.adAccountId && (
            <Nota tono="attenzione" etichetta="Ad account non collegato">
              <p>Questa sede non ha un ad account Meta: non c&apos;è niente da sincronizzare e i numeri delle campagne restano vuoti finché non lo colleghi.</p>
              {ruoloAdmin &&
                (adAccountAperto ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      aria-label="Id dell'ad account Meta"
                      value={adAccountBozza}
                      onChange={(e) => setAdAccountBozza(e.target.value)}
                      placeholder="Solo cifre, senza act_"
                      autoFocus
                      className="w-56"
                    />
                    <Button onClick={handleSalvaAdAccount} disabled={salvandoAdAccount}>
                      {salvandoAdAccount ? "Salvataggio…" : "Salva"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setAdAccountAperto(false);
                        setErroreAdAccount(null);
                      }}
                    >
                      Annulla
                    </Button>
                  </div>
                ) : (
                  <div className="mt-2">
                    <Button variant="crea" size="sm" onClick={() => setAdAccountAperto(true)}>
                      + Aggiungi ad account
                    </Button>
                  </div>
                ))}
              {erroreAdAccount && (
                <p role="alert" className="font-semibold text-critico">
                  {erroreAdAccount}
                </p>
              )}
            </Nota>
          )}

          {/* Prima i sei numeri, poi gli avvisi (audit UX del 06/10/2026: gli avvisi spingevano i
              numeri fuori dalla prima schermata). */}
          <SintesiTessere
            totale={dati.totale}
            overlayGhl={overlayGhl}
            totalePrecedente={datiPrecedenti?.totale ?? null}
            overlayGhlPrecedente={overlayGhlPrecedente}
            fonti={fontiCommerciali}
            manualePresentePrecedente={Boolean(datiPrecedenti?.risultatiCommercialiNelPeriodo)}
            vistaCliente={Boolean(code)}
            etichettaConfronto={periodo.confronto ? `vs ${etichettaIntervallo(periodo.confronto.da, periodo.confronto.a)}` : undefined}
          />

          {/* Blocco 4 — mai sul link pubblico `code` (gated su clienteId, mai valorizzato lì). */}
          {clienteId && <AvvisiOperativi avvisi={avvisiOperativi} />}

          <BoxGrafici
            funnel={{
              numeroLead: dati.totale.numeroLead,
              appuntamentiFissati: overlayGhl?.appuntamentiFissati.valore ?? dati.totale.appuntamentiFissati,
              appuntamentiEffettuati: overlayGhl?.appuntamentiEffettuati.valore ?? dati.totale.appuntamentiEffettuati,
              numeroVendite: overlayGhl?.numeroVendite.valore ?? dati.totale.numeroVendite,
            }}
            trendSettimanaleConOverlay={trendSettimanaleConOverlay}
            // Mai sul link pubblico `code`, stesso motivo per cui dati.sede.target* non è mai
            // valorizzato lì (vedi /api/kpi route.ts, campo `internal`).
            pacing={
              clienteId
                ? {
                    clienteId,
                    sedeId: dati.sede.sedeId,
                    haConnessioneGhl: Boolean(haConnessioneGhl),
                    targetBudgetMensile: dati.sede.targetBudgetMensile ?? null,
                    targetFatturatoMensile: dati.sede.targetFatturatoMensile ?? null,
                    targetLeadSettimana: dati.sede.targetLeadSettimana ?? null,
                    targetAppuntamentiSettimana: dati.sede.targetAppuntamentiSettimana ?? null,
                  }
                : undefined
            }
            // Decide SOLO il default della tendina (richiesta utente, 22/09/2026) — vero se la sede
            // stessa o ALMENO una delle sue categorie commerciali ha un target impostato, stessa
            // condizione combinata che decide se PacingTargetChart mostra dati veri o il messaggio
            // "nessun target impostato" (vedi PacingTargetChart.tsx): un cliente come ALC stesso può
            // avere zero target di sede ma target reali per categoria, il "Target mensili" di quel
            // cliente non è affatto vuoto anche se i 4 campi sede sono null.
            pacingHaTarget={
              dati.sede.targetBudgetMensile !== null ||
              dati.sede.targetFatturatoMensile !== null ||
              dati.sede.targetLeadSettimana !== null ||
              dati.sede.targetAppuntamentiSettimana !== null ||
              (dati.sede.categorie ?? []).some(
                (c) =>
                  c.targetBudgetMensile !== null ||
                  c.targetFatturatoMensile !== null ||
                  c.targetLeadSettimana !== null ||
                  c.targetAppuntamentiSettimana !== null
              )
            }
          />

          <DettaglioCampagneEsteso
            gruppi={dati.gruppi}
            totale={dati.totale}
            campagne={dati.campagne}
            frequenzaPerCampagna={frequenzaPerCampagna}
            targetCpl={dati.sede.targetCpl ?? null}
            mostraValutazione={Boolean(clienteId)}
            ghl={ghlDettaglio}
            inserzioni={inserzioniDettaglio}
            anagraficaCampagne={dati.anagraficaCampagne ?? EMPTY_ANAGRAFICA_CAMPAGNE}
            filtroCampagne={campagneSelezionate}
          />

          {/* Blocco 8 — "Performance venditori" (Fase 2/4), spostato qui da BoxGrafici.tsx (richiesta
              utente 20/09/2026: è andamento commerciale, non un grafico ads). Mai sul link pubblico
              `code`, stesso motivo del blocco 4 sopra: i venditori/target non sono mai esposti lì. */}
          {clienteId && (
            <AndamentoCommerciale clienteId={clienteId} sedeId={dati.sede.sedeId} haConnessioneGhl={Boolean(haConnessioneGhl)} />
          )}
        </div>
      )}

      {risultatiAperti && clienteId && dati && (
        <RisultatiCommercialiModal
          // Cambiando sede con la finestra aperta non può succedere (la finestra copre i filtri), ma la
          // chiave lega comunque ciò che si inserisce alla sede per cui è stata aperta.
          key={dati.sede.sedeId}
          clienteId={clienteId}
          sedeId={dati.sede.sedeId}
          nomeSede={dati.sediDisponibili.length > 1 ? dati.sede.nome : undefined}
          tipiCampagna={tipiPerRisultati}
          fonteAutomatica={Boolean(haConnessioneGhl)}
          onClose={() => setRisultatiAperti(false)}
          // I numeri sotto si rileggono subito, senza la cache: chi ha appena salvato deve vederli.
          onSalvato={() =>
            setRefreshTick((t) => {
              const nuovo = t + 1;
              frescoPerTickRef.current = nuovo;
              return nuovo;
            })
          }
        />
      )}
    </div>
  );
}
