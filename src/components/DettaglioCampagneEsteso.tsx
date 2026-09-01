"use client";

import { useMemo, useState } from "react";
import type { KpiGroup, RigaCampagna } from "@/types/kpi";
import { valutaCampagna } from "@/lib/valutazioneCampagna";
import { formatDataBreve, formatEuro, formatNumero, formatPercentuale, formatStatoCampagna } from "@/lib/format";
import { Tabs } from "@/components/Tabs";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PallinoStato } from "@/components/ui/PallinoStato";

// Solo metriche pubblicitarie Meta Ads (blocco 7 del redesign KPI) — le vecchie colonne
// Funnel/GHL (Richieste, Appuntamenti, Vendite, Tasso chiusura, Fatturato, ROAS, CPA) sono state
// tolte su richiesta esplicita: questa tabella ora parla solo di performance pubblicitaria, non
// più del funnel commerciale a valle (quello resta nelle tessere di sintesi sopra). Investimento,
// Impression, Clic e Lead non sono MAI overlay-GHL (GHL non ha questi concetti), quindi non serve
// più nessun overlayGhl qui — a differenza della vecchia KpiTable.tsx.
const COLONNE_TIPO: { key: keyof KpiGroup; label: string; format: (v: number | null) => string; evidenzia?: boolean }[] = [
  { key: "investimento", label: "Investimento", format: formatEuro },
  { key: "impressions", label: "Impression", format: formatNumero },
  { key: "cpm", label: "CPM", format: formatEuro },
  { key: "clicLink", label: "Clic sul link", format: formatNumero },
  { key: "costoPerClic", label: "Costo/clic", format: formatEuro },
  { key: "ctrClicLink", label: "CTR link", format: formatPercentuale },
  { key: "numeroLead", label: "Lead", format: formatNumero, evidenzia: true },
  { key: "costoPerLead", label: "Costo/Lead", format: formatEuro },
];

const VISTA_TABS = [
  { id: "tipo", label: "Per tipo campagna" },
  { id: "campagna", label: "Per singola campagna" },
];

export function DettaglioCampagneEsteso({
  gruppi,
  totale,
  campagne,
  frequenzaPerCampagna,
  targetCpl,
  mostraValutazione,
}: {
  gruppi: KpiGroup[];
  totale: KpiGroup;
  campagne: RigaCampagna[];
  // Da /api/meta-frequenza — letta live sull'intero periodo, mai persistita (vedi lib/meta.ts).
  // Mappa vuota se la chiamata Meta fallisce o non è ancora arrivata: quella campagna mostra
  // Frequenza non disponibile e non contribuisce al pallino (mai un falso verde).
  frequenzaPerCampagna: Record<string, number>;
  // Sede.targetCpl — null se non impostato (pallino grigio "non-valutabile" su tutte le campagne).
  targetCpl: number | null;
  // Pallino + colonna Frequenza solo per consulente/admin (gated su Boolean(clienteId) dal
  // chiamante, mai sul link pubblico "code" — stesso principio del banner "Solo per te").
  mostraValutazione: boolean;
}) {
  const [vista, setVista] = useState<"tipo" | "campagna">("tipo");

  const totaleCampagne = useMemo(() => {
    const investimento = campagne.reduce((s, c) => s + c.investimento, 0);
    const numeroLead = campagne.reduce((s, c) => s + c.numeroLead, 0);
    const impressions = campagne.reduce((s, c) => s + c.impressions, 0);
    const clicLink = campagne.reduce((s, c) => s + c.clicLink, 0);
    return {
      investimento,
      numeroLead,
      impressions,
      clicLink,
      costoPerLead: numeroLead ? investimento / numeroLead : null,
      cpm: impressions ? (investimento / impressions) * 1000 : null,
      costoPerClic: clicLink ? investimento / clicLink : null,
      ctrClicLink: impressions ? clicLink / impressions : null,
    };
  }, [campagne]);

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-brand" />
          <h3 className="font-heading font-bold text-ink-900 text-[15px]">Dettaglio</h3>
        </div>
        <Tabs tabs={VISTA_TABS} attivo={vista} onChange={(id) => setVista(id === "campagna" ? "campagna" : "tipo")} />
      </div>

      {vista === "tipo" ? (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-xs border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-ink-300/60">
                <th className="text-left font-medium px-5 py-3 sticky left-0 bg-surface-card text-ink-500">
                  Tipo campagna
                </th>
                {COLONNE_TIPO.map((c) => (
                  <th key={c.key} className="text-right font-medium px-4 py-3 text-ink-500">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gruppi.map((g) => (
                <tr key={g.tipoCampagna} className="border-b border-ink-300/60">
                  <td className="px-5 py-3 sticky left-0 bg-surface-card text-ink-900 font-medium">{g.tipoCampagna}</td>
                  {COLONNE_TIPO.map((c) => (
                    <td
                      key={c.key}
                      className={`text-right px-4 py-3 whitespace-nowrap tabular-nums ${c.evidenzia ? "font-bold text-brand" : "text-ink-700"}`}
                    >
                      {c.format(g[c.key] as number | null)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="px-5 py-3 font-semibold sticky left-0 bg-surface-card text-ink-900">Totale</td>
                {COLONNE_TIPO.map((c) => (
                  <td
                    key={c.key}
                    className={`text-right px-4 py-3 font-semibold whitespace-nowrap tabular-nums ${c.evidenzia ? "text-brand" : "text-ink-900"}`}
                  >
                    {c.format(totale[c.key] as number | null)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-xs border-collapse min-w-[1100px]">
            <thead>
              <tr className="border-b border-ink-300/60">
                <th className="text-left font-medium px-5 py-3 sticky left-0 bg-surface-card text-ink-500">Campagna</th>
                <th className="text-left font-medium px-4 py-3 text-ink-500">Stato</th>
                <th className="text-right font-medium px-4 py-3 text-ink-500">Investimento</th>
                <th className="text-right font-medium px-4 py-3 text-ink-500">Impression</th>
                <th className="text-right font-medium px-4 py-3 text-ink-500">CPM</th>
                <th className="text-right font-medium px-4 py-3 text-ink-500">Clic sul link</th>
                <th className="text-right font-medium px-4 py-3 text-ink-500">Costo/clic</th>
                <th className="text-right font-medium px-4 py-3 text-ink-500">CTR link</th>
                {mostraValutazione && <th className="text-right font-medium px-4 py-3 text-ink-500">Frequenza</th>}
                <th className="text-right font-medium px-4 py-3 text-ink-500">Lead</th>
                <th className="text-right font-medium px-4 py-3 text-ink-500">Costo/Lead</th>
              </tr>
            </thead>
            <tbody>
              {campagne.map((c) => {
                const stato = formatStatoCampagna(c.stato);
                const attiva = c.stato === "ACTIVE";
                const frequenza = frequenzaPerCampagna[c.campaignId] ?? null;
                // Una campagna non attiva (in pausa/archiviata/eliminata) non è azionabile ora — il
                // pallino resta grigio a prescindere da CPL/Frequenza, mai un giudizio su qualcosa
                // che non si può più correggere in questo momento.
                const valutazione = !mostraValutazione
                  ? null
                  : !attiva
                    ? { livello: "non-valutabile" as const, motivo: "Campagna non attiva" }
                    : valutaCampagna({ costoPerLead: c.costoPerLead, frequenza, targetCpl });
                return (
                  <tr key={c.campaignId} className="border-b border-ink-300/60">
                    <td className="px-5 py-3 sticky left-0 bg-surface-card text-ink-900 font-medium">
                      <span className="flex items-start gap-2">
                        {valutazione && (
                          <PallinoStato
                            tono={valutazione.livello === "non-valutabile" ? "neutro" : valutazione.livello}
                            motivo={valutazione.motivo}
                            className="mt-1"
                          />
                        )}
                        <span className="flex flex-col">
                          {c.nomeCampagna}
                          <span className="text-[11px] text-ink-500 font-normal">{c.tipoCampagna}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {stato ? (
                        <>
                          <Badge classe={stato.classe}>{stato.label}</Badge>
                          {c.statoDal && (
                            <span className="block text-[11px] text-ink-500 mt-1">dal {formatDataBreve(c.statoDal)}</span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-ink-300">—</span>
                      )}
                    </td>
                    <td className="text-right px-4 py-3 whitespace-nowrap tabular-nums text-ink-700">{formatEuro(c.investimento)}</td>
                    <td className="text-right px-4 py-3 whitespace-nowrap tabular-nums text-ink-700">{formatNumero(c.impressions)}</td>
                    <td className="text-right px-4 py-3 whitespace-nowrap tabular-nums text-ink-700">{formatEuro(c.cpm)}</td>
                    <td className="text-right px-4 py-3 whitespace-nowrap tabular-nums text-ink-700">{formatNumero(c.clicLink)}</td>
                    <td className="text-right px-4 py-3 whitespace-nowrap tabular-nums text-ink-700">{formatEuro(c.costoPerClic)}</td>
                    <td className="text-right px-4 py-3 whitespace-nowrap tabular-nums text-ink-700">{formatPercentuale(c.ctrClicLink)}</td>
                    {mostraValutazione && (
                      <td className="text-right px-4 py-3 whitespace-nowrap tabular-nums text-ink-700">
                        {frequenza !== null ? frequenza.toFixed(2) : "—"}
                      </td>
                    )}
                    <td className="text-right px-4 py-3 whitespace-nowrap tabular-nums font-bold text-brand">{formatNumero(c.numeroLead)}</td>
                    <td className="text-right px-4 py-3 whitespace-nowrap tabular-nums text-ink-700">{formatEuro(c.costoPerLead)}</td>
                  </tr>
                );
              })}
              {campagne.length === 0 && (
                <tr>
                  <td colSpan={mostraValutazione ? 11 : 10} className="px-5 py-6 text-center text-ink-500">
                    Nessuna campagna nel periodo selezionato.
                  </td>
                </tr>
              )}
              {campagne.length > 0 && (
                <tr>
                  <td className="px-5 py-3 font-semibold sticky left-0 bg-surface-card text-ink-900">Totale</td>
                  <td className="px-4 py-3" />
                  <td className="text-right px-4 py-3 font-semibold whitespace-nowrap tabular-nums text-ink-900">
                    {formatEuro(totaleCampagne.investimento)}
                  </td>
                  <td className="text-right px-4 py-3 font-semibold whitespace-nowrap tabular-nums text-ink-900">
                    {formatNumero(totaleCampagne.impressions)}
                  </td>
                  <td className="text-right px-4 py-3 font-semibold whitespace-nowrap tabular-nums text-ink-900">
                    {formatEuro(totaleCampagne.cpm)}
                  </td>
                  <td className="text-right px-4 py-3 font-semibold whitespace-nowrap tabular-nums text-ink-900">
                    {formatNumero(totaleCampagne.clicLink)}
                  </td>
                  <td className="text-right px-4 py-3 font-semibold whitespace-nowrap tabular-nums text-ink-900">
                    {formatEuro(totaleCampagne.costoPerClic)}
                  </td>
                  <td className="text-right px-4 py-3 font-semibold whitespace-nowrap tabular-nums text-ink-900">
                    {formatPercentuale(totaleCampagne.ctrClicLink)}
                  </td>
                  {mostraValutazione && <td className="px-4 py-3" />}
                  <td className="text-right px-4 py-3 font-semibold whitespace-nowrap tabular-nums text-brand">
                    {formatNumero(totaleCampagne.numeroLead)}
                  </td>
                  <td className="text-right px-4 py-3 font-semibold whitespace-nowrap tabular-nums text-ink-900">
                    {formatEuro(totaleCampagne.costoPerLead)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
