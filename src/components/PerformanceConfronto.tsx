"use client";

import { useEffect, useState } from "react";
import { formatEuro, formatNumero, formatPercentuale, formatRoas } from "@/lib/format";
import { applicaOverlayGhl } from "@/lib/kpiGhlOverlay";
import {
  calcolaRigaMedia,
  funnelPerMese,
  METRICHE_COMPETITIVE,
  serieCostoMensileRipetutaPerSettimana,
  trovaSediMigliori,
  type RigaConfrontoSede,
} from "@/lib/kpiConfronto";
import { serieCostoPerLead, type PuntoSettimanale } from "@/lib/kpiSettimanale";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FunnelStepChart } from "@/components/FunnelStepChart";
import { SmallMultiplesCosto } from "@/components/SmallMultiplesCosto";
import type { FunnelRow, KpiResponse } from "@/types/kpi";
import type { GhlRiepilogoResponse } from "@/types/ghl";

type Props = {
  clienteId: string;
  sediDisponibili: { sedeId: string; nome: string }[];
  da: string;
  a: string;
  campagneSelezionate: Set<string> | null;
};

type RisultatoSede = {
  sedeId: string;
  nome: string;
  riga: RigaConfrontoSede;
  numeroRichieste: number; // primo stadio del funnel (mai overlay-aware, resta 100% Funnel — vedi FunnelStepChart)
  costoPerLeadSerie: PuntoSettimanale[];
  costoAppuntamentoSerie: PuntoSettimanale[];
  costoAppuntamentoEffettuatoSerie: PuntoSettimanale[];
  cpaSerie: PuntoSettimanale[];
};

type ChiaveMetrica = keyof RigaConfrontoSede;

const COLONNE: { chiave: ChiaveMetrica; label: string; format: (v: number | null) => string; competitiva: boolean }[] = [
  { chiave: "investimento", label: "Investimento", format: formatEuro, competitiva: false },
  { chiave: "numeroLead", label: "Lead", format: formatNumero, competitiva: false },
  { chiave: "costoPerLead", label: "Costo/Lead", format: formatEuro, competitiva: true },
  { chiave: "appuntamentiFissati", label: "App. fissati", format: formatNumero, competitiva: false },
  { chiave: "appuntamentiEffettuati", label: "App. effettuati", format: formatNumero, competitiva: false },
  { chiave: "percentualeEffettuatiSuFissati", label: "% effettuati", format: formatPercentuale, competitiva: true },
  { chiave: "numeroVendite", label: "Vendite", format: formatNumero, competitiva: false },
  { chiave: "tassoDiChiusura", label: "Tasso chiusura", format: formatPercentuale, competitiva: true },
  { chiave: "fatturato", label: "Fatturato", format: formatEuro, competitiva: false },
  { chiave: "roas", label: "ROAS", format: formatRoas, competitiva: true },
  { chiave: "cpa", label: "CPA", format: formatEuro, competitiva: true },
];

/**
 * Tab "Confronto fra sedi" della tab "KPI (nuovo)": una riga per metrica (COLONNE sopra), una
 * colonna per sede più "Media" e "Chi è avanti" — orientamento scelto perché l'evidenziazione del
 * vincitore (vedi sotto) è naturalmente "questa cella, in questa metrica, per questa sede", e la
 * colonna "Chi è avanti" ha un solo significato per riga (una metrica alla volta), non per sede.
 */
export function PerformanceConfronto({ clienteId, sediDisponibili, da, a, campagneSelezionate }: Props) {
  const [risultati, setRisultati] = useState<RisultatoSede[] | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    // Una sede sola per volta: KPI (con eventuale filtro campagne) + GHL, in parallelo. Un fallimento
    // di uno dei due non deve far perdere l'altro; un fallimento del KPI scarta l'intera sede dal
    // confronto (senza il totale non c'è riga da costruire), un fallimento del GHL degrada
    // silenziosamente a "solo Funnel" (applicaOverlayGhl gestisce già ghl=null).
    async function caricaSede(sede: { sedeId: string; nome: string }): Promise<RisultatoSede | null> {
      const paramsKpi = new URLSearchParams({ clienteId, sedeId: sede.sedeId, da, a });
      if (campagneSelezionate) paramsKpi.set("campagne", Array.from(campagneSelezionate).join(","));
      const paramsGhl = new URLSearchParams({ clienteId, sedeId: sede.sedeId, da, a });

      const [kpiEsito, ghlEsito] = await Promise.allSettled([
        fetch(`/api/kpi?${paramsKpi.toString()}`, { signal: controller.signal }).then(async (res) => {
          if (!res.ok) throw new Error(`KPI non disponibili per la sede ${sede.nome}`);
          return (await res.json()) as KpiResponse;
        }),
        fetch(`/api/ghl?${paramsGhl.toString()}`, { signal: controller.signal }).then(async (res) => {
          if (!res.ok) throw new Error(`GHL non disponibile per la sede ${sede.nome}`);
          return (await res.json()) as GhlRiepilogoResponse;
        }),
      ]);

      if (kpiEsito.status === "rejected") {
        // Warning silenzioso: una sede scartata non deve bloccare le altre né mostrare un errore in
        // UI. Un AbortError (richiesta superata da un nuovo cambio di filtri) non è nemmeno un vero
        // fallimento, non merita un log.
        if (!(kpiEsito.reason instanceof DOMException && kpiEsito.reason.name === "AbortError")) {
          console.warn(`Confronto sedi: KPI non disponibili per ${sede.nome}`, kpiEsito.reason);
        }
        return null;
      }

      const kpiResponse = kpiEsito.value;
      const ghlResponse = ghlEsito.status === "fulfilled" ? ghlEsito.value : null;

      const overlay = applicaOverlayGhl(kpiResponse.totale, campagneSelezionate ? null : ghlResponse, {
        filtroCampagneAttivo: campagneSelezionate !== null,
      });

      const riga: RigaConfrontoSede = {
        sedeId: sede.sedeId,
        nome: sede.nome,
        investimento: kpiResponse.totale.investimento,
        numeroLead: kpiResponse.totale.numeroLead,
        costoPerLead: kpiResponse.totale.costoPerLead,
        appuntamentiFissati: overlay.appuntamentiFissati.valore,
        appuntamentiEffettuati: overlay.appuntamentiEffettuati.valore,
        percentualeEffettuatiSuFissati: overlay.percentualeEffettuatiSuFissati.valore,
        numeroVendite: overlay.numeroVendite.valore,
        tassoDiChiusura: overlay.tassoDiChiusura.valore,
        fatturato: overlay.fatturato.valore,
        roas: overlay.roas.valore,
        cpa: overlay.cpa.valore,
      };

      // /api/kpi non espone mai le righe Funnel grezze (solo `totale`, aggregato sull'intero
      // periodo da-a), quindi non c'è modo di popolare funnelPerMese con dati mensili reali lato
      // client. Si costruisce una riga sintetica per ogni mese presente in trend, con lo stesso
      // aggregato ripetuto — stesso spirito del valore mensile ripetuto su ogni settimana in
      // serieCostoMensileRipetutaPerSettimana, un livello più in alto (qui manca la granularità
      // mensile stessa, non solo quella settimanale all'interno del mese).
      const mesiTrend = Array.from(new Set(kpiResponse.trend.map((t) => t.mese)));
      const funnelSintetico: FunnelRow[] = mesiTrend.map((mese) => ({
        mese,
        clienteId,
        sedeId: sede.sedeId,
        tipoCampagna: "",
        richieste: kpiResponse.totale.numeroRichieste,
        appuntamentiFissati: overlay.appuntamentiFissati.valore,
        appuntamentiEffettuati: overlay.appuntamentiEffettuati.valore,
        vendite: overlay.numeroVendite.valore,
        fatturato: overlay.fatturato.valore,
      }));
      const funnelPerMeseMap = funnelPerMese(clienteId, sede.sedeId, funnelSintetico);

      return {
        sedeId: sede.sedeId,
        nome: sede.nome,
        riga,
        numeroRichieste: kpiResponse.totale.numeroRichieste,
        costoPerLeadSerie: serieCostoPerLead(kpiResponse.trendSettimanale),
        costoAppuntamentoSerie: serieCostoMensileRipetutaPerSettimana(
          kpiResponse.trendSettimanale,
          kpiResponse.trend,
          funnelPerMeseMap,
          "appuntamentiFissati"
        ),
        costoAppuntamentoEffettuatoSerie: serieCostoMensileRipetutaPerSettimana(
          kpiResponse.trendSettimanale,
          kpiResponse.trend,
          funnelPerMeseMap,
          "appuntamentiEffettuati"
        ),
        cpaSerie: serieCostoMensileRipetutaPerSettimana(
          kpiResponse.trendSettimanale,
          kpiResponse.trend,
          funnelPerMeseMap,
          "numeroVendite"
        ),
      };
    }

    // Promise.resolve().then() per il primo setState sincrono — stesso workaround già in uso in
    // KpiDashboard.tsx (regola react-hooks/set-state-in-effect).
    Promise.resolve()
      .then(() => {
        setCaricamento(true);
        setErrore(null);
        if (sediDisponibili.length <= 1) return [];
        return Promise.all(sediDisponibili.map((sede) => caricaSede(sede)));
      })
      .then((esiti) => {
        if (controller.signal.aborted) return;
        const validi = esiti.filter((r): r is RisultatoSede => r !== null);
        setRisultati(validi);
        if (sediDisponibili.length > 1 && validi.length === 0) {
          setErrore("Impossibile caricare i dati per il confronto.");
        }
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setErrore(err instanceof Error ? err.message : "Errore sconosciuto nel confronto sedi");
        setRisultati([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCaricamento(false);
      });

    return () => controller.abort();
  }, [clienteId, sediDisponibili, da, a, campagneSelezionate]);

  if (sediDisponibili.length <= 1) {
    return <p className="text-sm text-ink-500">Serve più di una sede per il confronto.</p>;
  }

  if (caricamento && !risultati) {
    return <p className="text-sm text-ink-500">Caricamento confronto sedi…</p>;
  }

  if (errore) {
    return <p className="text-sm text-red-600">{errore}</p>;
  }

  if (!risultati || risultati.length === 0) {
    return <p className="text-sm text-ink-500">Nessun dato disponibile per il confronto.</p>;
  }

  const righe = risultati.map((r) => r.riga);
  const media = calcolaRigaMedia(righe);
  const numeroSediMancanti = sediDisponibili.length - risultati.length;

  // Sede/i migliore/i per ciascuna metrica competitiva — calcolate una sola volta, mai sulla riga
  // Media (calcolaRigaMedia non partecipa al confronto con se stessa).
  const vincitoriPerMetrica: Partial<Record<ChiaveMetrica, string[]>> = {};
  for (const m of METRICHE_COMPETITIVE) {
    vincitoriPerMetrica[m.chiave] = trovaSediMigliori(
      righe.map((r) => ({ sedeId: r.sedeId, valore: r[m.chiave] })),
      m.direzione
    );
  }

  const sediFunnel = risultati.map((r) => ({
    sedeId: r.sedeId,
    nome: r.nome,
    conteggi: [r.numeroRichieste, r.riga.appuntamentiEffettuati, r.riga.numeroVendite] as [number, number, number],
  }));

  const metricheSmallMultiples = [
    {
      chiave: "costoPerLead",
      titolo: "Costo/Lead",
      formato: (v: number) => formatEuro(v),
      perSede: risultati.map((r) => ({ sedeId: r.sedeId, nome: r.nome, serie: r.costoPerLeadSerie })),
    },
    {
      chiave: "costoAppuntamento",
      titolo: "Costo/Appuntamento",
      formato: (v: number) => formatEuro(v),
      perSede: risultati.map((r) => ({ sedeId: r.sedeId, nome: r.nome, serie: r.costoAppuntamentoSerie })),
    },
    {
      chiave: "costoAppuntamentoEffettuato",
      titolo: "Costo/Appuntamento effettuato",
      formato: (v: number) => formatEuro(v),
      perSede: risultati.map((r) => ({ sedeId: r.sedeId, nome: r.nome, serie: r.costoAppuntamentoEffettuatoSerie })),
    },
    {
      chiave: "cpa",
      titolo: "CPA",
      formato: (v: number) => formatEuro(v),
      perSede: risultati.map((r) => ({ sedeId: r.sedeId, nome: r.nome, serie: r.cpaSerie })),
    },
  ];

  return (
    <div className="space-y-6">
      {numeroSediMancanti > 0 && (
        <p className="text-xs text-ink-500">
          {numeroSediMancanti === 1
            ? "1 sede non è stata caricata correttamente ed è esclusa dal confronto."
            : `${numeroSediMancanti} sedi non sono state caricate correttamente e sono escluse dal confronto.`}
        </p>
      )}

      <Card padding="none" className="overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-5">
          <div className="w-1 h-5 rounded-full bg-brand" />
          <h3 className="font-heading font-bold text-ink-900 text-[15px]">Confronto fra sedi</h3>
        </div>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-ink-300/60">
                <th className="text-left font-medium px-5 py-3 sticky left-0 bg-surface-card text-ink-500">Metrica</th>
                {righe.map((r) => (
                  <th key={r.sedeId} className="text-right font-medium px-4 py-3 whitespace-nowrap text-ink-500">
                    {r.nome}
                  </th>
                ))}
                <th className="text-right font-medium px-4 py-3 whitespace-nowrap text-ink-500">Media</th>
                <th className="text-left font-medium px-4 py-3 whitespace-nowrap text-ink-500">Chi è avanti</th>
              </tr>
            </thead>
            <tbody>
              {COLONNE.map((col) => {
                const vincitori = col.competitiva ? vincitoriPerMetrica[col.chiave] ?? [] : [];
                return (
                  <tr key={col.chiave} className="border-b border-ink-300/60">
                    <td className="px-5 py-3 sticky left-0 bg-surface-card text-ink-900 font-medium whitespace-nowrap">
                      {col.label}
                    </td>
                    {righe.map((r) => {
                      const vince = col.competitiva && vincitori.includes(r.sedeId);
                      return (
                        <td
                          key={r.sedeId}
                          className={`text-right px-4 py-3 whitespace-nowrap tabular-nums ${
                            vince ? "font-semibold text-ink-900" : "text-ink-700"
                          }`}
                        >
                          {col.format(r[col.chiave] as number | null)}
                        </td>
                      );
                    })}
                    <td className="text-right px-4 py-3 whitespace-nowrap tabular-nums font-semibold text-ink-900">
                      {col.format(media[col.chiave] as number | null)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {col.competitiva ? (
                        vincitori.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {vincitori.map((sedeId) => (
                              <Badge key={sedeId} tono="successo">
                                {righe.find((r) => r.sedeId === sedeId)?.nome ?? sedeId}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-ink-300">—</span>
                        )
                      ) : (
                        <span className="text-xs text-ink-500">dipende dalla spesa</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <FunnelStepChart sedi={sediFunnel} />

      <SmallMultiplesCosto metriche={metricheSmallMultiples} />
    </div>
  );
}
