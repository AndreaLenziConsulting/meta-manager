"use client";

import { useEffect, useState } from "react";
import { MonthRangePicker } from "@/components/MonthRangePicker";
import { Tabs } from "@/components/Tabs";
import { PerformanceSedeCorrente } from "@/components/PerformanceSedeCorrente";
import { PerformanceConfronto } from "@/components/PerformanceConfronto";
import { PerformancePrevisionale } from "@/components/PerformancePrevisionale";
import { applicaOverlayGhl, applicaOverlayGhlTrend, type KpiConOverlayGhl } from "@/lib/kpiGhlOverlay";
import { scenarioDaDatiReali, type InputScenarioReale } from "@/lib/kpiPrevisionale";
import type { KpiGroup, KpiResponse } from "@/types/kpi";
import type { GhlRiepilogoResponse } from "@/types/ghl";

function meseCorrente(): string {
  return new Date().toISOString().slice(0, 7);
}

function meseIndietro(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 7);
}

/** Numero di mesi fra `da` e `a` (entrambi YYYY-MM), estremi inclusi — minimo 1. */
function numeroMesiPeriodo(da: string, a: string): number {
  const [annoDa, meseDa] = da.split("-").map(Number);
  const [annoA, meseA] = a.split("-").map(Number);
  return Math.max(1, (annoA - annoDa) * 12 + (meseA - meseDa) + 1);
}

/**
 * Sostituisce nel totale "da sempre" (kpiCumulato.ts) i campi che l'overlay GHL (kpiGhlOverlay.ts)
 * ha risolto — stesso principio delle tessere del periodo in KpiDashboard.tsx, applicato qui al
 * totaleCumulato: PerformanceSedeCorrente.tsx legge quei campi direttamente da `dati.totaleCumulato`
 * (non riceve un overlay separato per il cumulato), quindi il merge va fatto qui, a monte, prima di
 * passargli `dati`. investimento/numeroLead/numeroRichieste/costoPerLead/costoPerRichiesta restano
 * sempre quelli del totale originale: GHL non ha questi concetti (overlay non li tocca mai).
 */
function totaleCumulatoConOverlay(totale: KpiGroup, overlay: KpiConOverlayGhl): KpiGroup {
  return {
    ...totale,
    fatturato: overlay.fatturato.valore,
    numeroVendite: overlay.numeroVendite.valore,
    roas: overlay.roas.valore,
    cpa: overlay.cpa.valore,
    appuntamentiFissati: overlay.appuntamentiFissati.valore,
    appuntamentiEffettuati: overlay.appuntamentiEffettuati.valore,
    percentualeEffettuatiSuFissati: overlay.percentualeEffettuatiSuFissati.valore,
    costoPerAppuntamentoEffettuato: overlay.costoPerAppuntamentoEffettuato.valore,
    tassoDiChiusura: overlay.tassoDiChiusura.valore,
  };
}

type Props = { code?: string; clienteId?: string; haConnessioneGhl?: boolean; ruoloAdmin?: boolean };

type SubVista = "sede" | "confronto" | "previsionale";

/**
 * Tab "KPI (nuovo)" — orchestratore della vista "Performance": stesso pattern di stato/fetch di
 * KpiDashboard.tsx (vedi quel file), ma sempre con `cumulato=1` e con una sotto-navigazione propria
 * (Sede corrente / Confronto fra sedi / Previsionale) invece della singola vista piatta. Montato
 * SOLO quando `clienteId` è presente (responsabilità del chiamante, SchedaCliente.tsx) — `code` è
 * accettato solo per compatibilità di tipo con KpiDashboard, senza alcuna logica su quel branch:
 * questa vista non esiste sul link pubblico cliente.
 */
export function PerformanceDashboard({ clienteId, haConnessioneGhl }: Props) {
  const [da, setDa] = useState(meseIndietro(2));
  const [a, setA] = useState(meseCorrente());
  const [dati, setDati] = useState<KpiResponse | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [ghlDati, setGhlDati] = useState<GhlRiepilogoResponse | null>(null);
  const [ghlCumulato, setGhlCumulato] = useState<GhlRiepilogoResponse | null>(null);

  // Contesto = quale cliente sto guardando, indipendente da sede/sotto-vista — stesso pattern id di
  // KpiDashboard.tsx (vedi commento lì): sede e sotto-vista si azzerano da sole passando a un altro
  // cliente, senza bisogno di un effect dedicato.
  const contestoCliente = clienteId ?? "";
  const [sedeScelta, setSedeScelta] = useState<{ contesto: string; sedeId: string | null }>({
    contesto: contestoCliente,
    sedeId: null,
  });
  const sedeId = sedeScelta.contesto === contestoCliente ? sedeScelta.sedeId : null;

  const [subVistaScelta, setSubVistaScelta] = useState<{ contesto: string; vista: SubVista }>({
    contesto: contestoCliente,
    vista: "sede",
  });
  const subVista = subVistaScelta.contesto === contestoCliente ? subVistaScelta.vista : "sede";

  // Fetch principale — sempre con cumulato=1 (a differenza del tab KPI esistente): questa vista
  // mostra sempre il riepilogo "da sempre" nella tab Sede corrente.
  useEffect(() => {
    if (!clienteId) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ clienteId, da, a, cumulato: "1" });
    if (sedeId) params.set("sedeId", sedeId);

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
        // Una richiesta abortita (perché ne è già partita una più recente) non è un errore da
        // mostrare — stesso motivo di KpiDashboard.tsx.
        if (err instanceof DOMException && err.name === "AbortError") return;
        setErrore(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCaricamento(false);
      });

    return () => controller.abort();
  }, [clienteId, sedeId, da, a]);

  // GHL del periodo — stesse condizioni di guardia di KpiDashboard.tsx (clienteId + haConnessioneGhl
  // + sede risolta dal server, mai lo stato locale sedeId ancora null al primo render). Nessun
  // controllo su un filtro campagne: questa tab non ne ha mai uno (vedi PerformanceConfronto sotto,
  // sempre chiamato con campagneSelezionate=null).
  const sedeGhl = dati?.sede?.sedeId;
  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve()
      .then(() => {
        if (!clienteId || !haConnessioneGhl || !sedeGhl) {
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
  }, [clienteId, haConnessioneGhl, sedeGhl, da, a]);

  // GHL "da sempre" — secondo fetch, solo quando /api/kpi ha risolto una primaData (la sede ha
  // almeno un dato storico) e il fetch del periodo sopra ha già confermato che QUESTA sede è
  // davvero connessa (non solo che il cliente ne ha una da qualche parte, come dice il più
  // generico haConnessioneGhl): alimenta il riepilogo "Il periodo in sintesi — da sempre" di
  // PerformanceSedeCorrente.tsx, sullo stesso range esteso dalla prima data disponibile a oggi.
  const primaDataMese = dati?.primaData ? dati.primaData.slice(0, 7) : null;
  const sedeConnessaGhl = ghlDati !== null && ghlDati.connesso;
  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve()
      .then(() => {
        if (!clienteId || !sedeGhl || !primaDataMese || !sedeConnessaGhl) {
          setGhlCumulato(null);
          return undefined;
        }
        const params = new URLSearchParams({ clienteId, sedeId: sedeGhl, da: primaDataMese, a: meseCorrente() });
        return fetch(`/api/ghl?${params.toString()}`, { signal: controller.signal })
          .then((res) => (res.ok ? res.json() : null))
          .then((body: GhlRiepilogoResponse | null) => setGhlCumulato(body));
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setGhlCumulato(null);
      });
    return () => controller.abort();
  }, [clienteId, sedeGhl, primaDataMese, sedeConnessaGhl]);

  // Overlay GHL: mai un filtro campagne attivo in questa tab (a differenza di KpiDashboard.tsx),
  // quindi filtroCampagneAttivo è sempre false qui.
  const overlayGhl = dati ? applicaOverlayGhl(dati.totale, ghlDati, { filtroCampagneAttivo: false }) : null;
  const overlayCumulato =
    dati?.totaleCumulato ? applicaOverlayGhl(dati.totaleCumulato, ghlCumulato, { filtroCampagneAttivo: false }) : null;

  // Trend settimanale con lo stesso overlay del grafico in KpiDashboard.tsx — necessario perché
  // PerformanceSedeCorrente.tsx ne deriva la tessera "Fatturato" quando la sede è connessa a GHL.
  // Il fatturato del Funnel grezzo può essere null (mese senza nessun dato, vedi kpi.ts); la prop
  // di PerformanceSedeCorrente lo dichiara invece sempre number, quindi si riconduce a 0 qui.
  const trendSettimanaleConOverlay = dati
    ? applicaOverlayGhlTrend(dati.trendSettimanale, ghlDati, { filtroCampagneAttivo: false })
    : [];
  const trendSettimanalePerSede = trendSettimanaleConOverlay.map((t) => ({ ...t, fatturato: t.fatturato ?? 0 }));

  // Input per il Simulatore ROI previsionale, derivato dai dati reali del periodo selezionato —
  // numeroLead resta sempre dal Funnel/Meta (GHL non ha questo concetto, l'overlay non lo tocca).
  const inputScenario: InputScenarioReale | null = dati
    ? {
        investimentoTotalePeriodo: dati.totale.investimento,
        numeroMesiPeriodo: numeroMesiPeriodo(da, a),
        numeroLead: dati.totale.numeroLead,
        appuntamentiFissati: overlayGhl?.appuntamentiFissati.valore ?? dati.totale.appuntamentiFissati,
        appuntamentiEffettuati: overlayGhl?.appuntamentiEffettuati.valore ?? dati.totale.appuntamentiEffettuati,
        numeroVendite: overlayGhl?.numeroVendite.valore ?? dati.totale.numeroVendite,
        fatturato: overlayGhl?.fatturato.valore ?? dati.totale.fatturato,
      }
    : null;

  const subTabs = [
    { id: "sede", label: "Sede corrente" },
    ...(dati && dati.sediDisponibili.length > 1 ? [{ id: "confronto", label: "Confronto fra sedi" }] : []),
    { id: "previsionale", label: "Previsionale" },
  ];

  if (!clienteId) {
    return <p className="text-sm text-ink-500">Nessun cliente selezionato.</p>;
  }

  return (
    <div className="viz-root space-y-6">
      {dati && (
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="font-heading font-bold text-2xl text-ink-900">{dati.cliente.nome}</h2>
          {/* Solo se il cliente ha più di una sede — stesso pattern del tab KPI esistente. */}
          {dati.sediDisponibili.length > 1 && (
            <Tabs
              tabs={dati.sediDisponibili.map((s) => ({ id: s.sedeId, label: s.nome }))}
              attivo={dati.sede.sedeId}
              onChange={(id) => setSedeScelta({ contesto: contestoCliente, sedeId: id })}
            />
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
        <Tabs
          tabs={subTabs}
          attivo={subVista}
          onChange={(id) => setSubVistaScelta({ contesto: contestoCliente, vista: id as SubVista })}
        />
      </div>

      {errore && <p className="text-sm text-red-600">{errore}</p>}

      {caricamento && !dati && <p className="text-sm text-ink-500">Caricamento…</p>}

      {dati && inputScenario && (
        <div style={{ opacity: caricamento ? 0.6 : 1, transition: "opacity 150ms" }}>
          {subVista === "sede" && (
            <PerformanceSedeCorrente
              dati={
                dati.totaleCumulato && overlayCumulato
                  ? { ...dati, totaleCumulato: totaleCumulatoConOverlay(dati.totaleCumulato, overlayCumulato) }
                  : dati
              }
              trendSettimanale={trendSettimanalePerSede}
              overlayGhl={overlayGhl}
              ghlDati={ghlDati}
              // /api/kpi non espone al client le righe grezze MetaDaily/Campagna/Funnel richieste da
              // mesiConSpesaSenzaFunnel (kpiQualita.ts) — solo aggregati. Fuori scope per questo
              // fetch: nessun flag "mese senza Funnel" mostrato qui (gli altri flag di qualità,
              // calendari falliti/non configurati, restano attivi perché derivano solo da ghlDati).
              meseSenzaFunnel={[]}
            />
          )}

          {subVista === "confronto" && (
            <PerformanceConfronto
              clienteId={clienteId}
              sediDisponibili={dati.sediDisponibili}
              da={da}
              a={a}
              campagneSelezionate={null}
            />
          )}

          {subVista === "previsionale" && <PerformancePrevisionale seed={scenarioDaDatiReali(inputScenario)} />}
        </div>
      )}
    </div>
  );
}
