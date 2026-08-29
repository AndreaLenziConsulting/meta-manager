"use client";

import { useEffect, useState } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { TrendChart } from "@/components/TrendChart";
import { KpiTable } from "@/components/KpiTable";
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

function meseIndietro(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 7);
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
  const [da, setDa] = useState(meseIndietro(2));
  const [a, setA] = useState(meseCorrente());
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
    const params = new URLSearchParams({ da, a });
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

  // Fatturato/Vendite/ROAS/CPA/Appuntamenti fissati mostrati sotto: da GHL se connesso (e nessun
  // filtro campagne attivo), altrimenti dal Funnel come sempre — vedi kpiGhlOverlay.ts per il
  // dettaglio di quali tessere e perché non tutte.
  const overlayGhl = dati
    ? applicaOverlayGhl(dati.totale, campagneSelezionate ? null : ghlDati, {
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
  // Stessa condizione di sospensione di applicaOverlayGhlTrend sopra: la didascalia del grafico
  // (TrendChart.tsx) deve dire il vero su quale fonte sta mostrando, mai disallinearsi dal dato reale.
  const trendFatturatoReale = Boolean(dati && campagneSelezionate === null && ghlDati?.connesso);

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
        <div className="rounded-lg bg-yellow-50 border border-yellow-100 text-yellow-800 text-xs p-3 space-y-2">
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
            <Button variant="ghost" size="sm" onClick={handleAggiornaKpi} disabled={sincronizzando} className="flex items-center gap-2 bg-surface-card shadow-sm">
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
            <SintesiTessere totale={dati.totale} overlayGhl={overlayGhl} />
            {overlayGhl?.parziale && (
              <p className="text-xs bg-yellow-50 border border-yellow-100 text-yellow-800 rounded-lg px-3 py-2.5 mt-5">
                Uno o più calendari GHL non erano raggiungibili al momento del caricamento — i numeri di
                &quot;Appuntamenti fissati/effettuati&quot;, &quot;% effettuati su fissati&quot; e &quot;Tasso di chiusura&quot;
                potrebbero essere incompleti (vendite e fatturato non sono interessati).
              </p>
            )}
          </div>

          <TrendChart trendSettimanale={trendSettimanaleConOverlay} fatturatoReale={trendFatturatoReale} />

          <KpiTable gruppi={dati.gruppi} totale={dati.totale} campagne={dati.campagne} overlayGhl={overlayGhl} />
        </div>
      )}
    </div>
  );
}
