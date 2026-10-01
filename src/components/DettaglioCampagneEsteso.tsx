"use client";

import { useMemo, useState } from "react";
import type { KpiGroup, RigaCampagna } from "@/types/kpi";
import type { GhlBreakdownCampagna } from "@/types/ghl";
import type { AnagraficaInserzioneFuoriPeriodo, InserzioneConStato } from "@/lib/inserzioniOutlier";
import {
  campagneFuoriPeriodoConRisultati,
  haRisultati,
  inserzioniFuoriPeriodoConRisultati,
  residuoNonAttribuito,
  risultatiDaBreakdown,
  risultatiGhlPerTipo,
  type RisultatiGhl,
} from "@/lib/dettaglioGhl";
import { valutaCampagna } from "@/lib/valutazioneCampagna";
import { formatCanale, formatDataBreve, formatEuro, formatNumero, formatPercentuale, formatStatoCampagna } from "@/lib/format";
import { Tabs } from "@/components/Tabs";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PallinoStato } from "@/components/ui/PallinoStato";
import { DatoNonDisponibile } from "@/components/DatoNonDisponibile";

// Tabella Dettaglio (blocco 7 del redesign KPI). Tre viste: per tipo campagna, per singola
// campagna, per singola inserzione (quest'ultima solo per consulente/admin).
//
// Colonne pubblicitarie (Investimento, Impression, Clic, Lead...): sempre e solo Meta Ads, mai
// overlay-GHL (GHL non ha questi concetti).
//
// Colonne commerciali (App. fissati, App. effettuati, Vendite, Fatturato) — richiesta utente
// 01/10/2026: "quanti appuntamenti fissati e quante vendite derivano dai lead dei vari tipi
// campagna e singola campagna", più la vista per inserzione "per capire quale inserzione produce
// appuntamenti e vendite". Con GHL connesso sono un dato REALE in tutte e tre le viste: ogni
// contatto è legato alla campagna e all'inserzione Meta che lo ha generato (join
// contatto->opportunità->attributions, vedi mappaCampagnaPerContatto/mappaInserzionePerContatto in
// lib/ghl.ts); il tipo campagna è la somma delle sue campagne. Prima di questa data le colonne
// esistevano solo nella vista "per singola campagna". Senza GHL, la sola vista "per tipo" mostra i
// Risultati Commerciali inseriti a mano (sono compilati proprio per tipo campagna), le altre due
// non hanno un dato a quella granularità e non mostrano le colonne. Tutta la logica di
// riconciliazione (righe "senza spesa nel periodo", riga di residuo, totale = totale sede) è in
// lib/dettaglioGhl.ts, vedi il commento in cima a quel file.
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

type Vista = "tipo" | "campagna" | "inserzione";

const TAB_TIPO = { id: "tipo", label: "Per tipo campagna" };
const TAB_CAMPAGNA = { id: "campagna", label: "Per singola campagna" };
const TAB_INSERZIONE = { id: "inserzione", label: "Per singola inserzione" };

/** Dati GHL per le colonne commerciali. "assente" = sede non connessa a GHL (o link pubblico
 * `code`, dove GHL non arriva mai); "caricamento"/"errore" = connessa ma il dato non c'è (ancora):
 * le colonne restano nascoste con una nota esplicita, mai zeri al posto di un dato mancante. */
export type DettaglioGhl =
  | { stato: "assente" | "caricamento" | "errore" }
  | {
      stato: "ok";
      // "foglio" = numeri dal file contatti del cliente (sede senza GHL), vedi lib/foglioContatti.ts:
      // cambia solo la nota in testa, la tabella è identica.
      fonte: "ghl" | "foglio";
      perCampagna: Record<string, GhlBreakdownCampagna>;
      perInserzione: Record<string, GhlBreakdownCampagna>;
      // Totale sede del periodo (già ristretto alle campagne selezionate se un filtro è attivo) —
      // la riga Totale della tabella, e la base da cui si calcola il residuo non attribuito.
      totale: RisultatiGhl;
    };

/** Inserzioni Meta del periodo (/api/meta-inserzioni). `altre` = anagrafica delle inserzioni senza
 * spesa nel periodo, per dare un nome alle righe a cui GHL attribuisce un risultato. */
export type DettaglioInserzioni = {
  stato: "caricamento" | "ok" | "errore";
  righe: InserzioneConStato[];
  altre: Record<string, AnagraficaInserzioneFuoriPeriodo>;
};

const RIGA = "border-b border-[var(--glass-border-soft)]";
const TH = "text-right font-medium px-4 py-3 text-ink-500";
const TH_SINISTRA = "text-left font-medium px-4 py-3 text-ink-500";
const TH_PRIMA = "text-left font-medium px-5 py-3 sticky left-0 bg-surface-card text-ink-500";
const TD = "text-right px-4 py-3 whitespace-nowrap tabular-nums text-ink-700";
const TD_LEAD = "text-right px-4 py-3 whitespace-nowrap tabular-nums font-bold text-brand";
const TD_TOTALE = "text-right px-4 py-3 font-semibold whitespace-nowrap tabular-nums text-ink-900";
const TD_TOTALE_LEAD = "text-right px-4 py-3 font-semibold whitespace-nowrap tabular-nums text-brand";
const TD_PRIMA = "px-5 py-3 sticky left-0 bg-surface-card text-ink-900 font-medium";
const RIGA_TOTALE = "bg-[var(--glass-content-strong)]";
const TD_PRIMA_TOTALE = "px-5 py-3 font-semibold sticky left-0 bg-[var(--glass-content-strong)] text-ink-900";
const SOTTOTITOLO = "text-[11px] text-ink-500 font-normal";

function IntestazioniRisultati() {
  return (
    <>
      <th className={TH}>App. fissati</th>
      <th className={TH}>App. effettuati</th>
      <th className={TH}>Vendite</th>
      <th className={TH}>Fatturato</th>
    </>
  );
}

/** Le 4 celle commerciali di una riga. `risultati` null = nessun contatto attribuito a quella riga:
 * "non disponibile" con il motivo, mai uno zero silenzioso. */
function CelleRisultati({ risultati, motivoAssente, classe = TD }: { risultati: RisultatiGhl | null; motivoAssente?: string; classe?: string }) {
  if (!risultati) {
    return (
      <>
        {[0, 1, 2, 3].map((i) => (
          <td key={i} className="text-right px-4 py-3">
            <DatoNonDisponibile motivo={motivoAssente} className="ml-auto" />
          </td>
        ))}
      </>
    );
  }
  return (
    <>
      <td className={classe}>{formatNumero(risultati.appuntamentiFissati)}</td>
      <td className={classe}>{formatNumero(risultati.appuntamentiEffettuati)}</td>
      <td className={classe}>{formatNumero(risultati.vendite)}</td>
      <td className={classe}>{formatEuro(risultati.fatturato)}</td>
    </>
  );
}

/** Celle pubblicitarie di una riga che non ha dati Meta nel periodo (riga "senza spesa nel
 * periodo" o riga di residuo): un trattino, non uno zero — la riga esiste per i suoi risultati
 * commerciali, non per la spesa. */
function CelleSenzaDatoMeta({ quante }: { quante: number }) {
  return (
    <>
      {Array.from({ length: quante }, (_, i) => (
        <td key={i} className="text-right px-4 py-3 text-ink-300">
          —
        </td>
      ))}
    </>
  );
}

function RigaResiduo({ titolo, spiegazione, celleMeta, residuo }: { titolo: string; spiegazione: string; celleMeta: number; residuo: RisultatiGhl }) {
  return (
    <tr className={RIGA}>
      <td className={TD_PRIMA}>
        <span className="flex flex-col">
          {titolo}
          <span className={SOTTOTITOLO}>{spiegazione}</span>
        </span>
      </td>
      <CelleSenzaDatoMeta quante={celleMeta} />
      <CelleRisultati risultati={residuo} />
    </tr>
  );
}

export function DettaglioCampagneEsteso({
  gruppi,
  totale,
  campagne,
  frequenzaPerCampagna,
  targetCpl,
  mostraValutazione,
  ghl,
  inserzioni,
  anagraficaCampagne,
  filtroCampagne,
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
  // Pallino + colonna Frequenza + vista "Per singola inserzione" solo per consulente/admin (gated
  // su Boolean(clienteId) dal chiamante, mai sul link pubblico "code" — stesso principio del banner
  // "Solo per te").
  mostraValutazione: boolean;
  ghl: DettaglioGhl;
  inserzioni: DettaglioInserzioni;
  // Tutte le campagne note della sede (KpiResponse.anagraficaCampagne) — [] sul link pubblico.
  anagraficaCampagne: { campaignId: string; nomeCampagna: string; tipoCampagna: string }[];
  // Filtro campagne attivo nelle tessere (stessi campaignId passati a /api/kpi e /api/ghl), null =
  // nessun filtro. Serve solo a restringere inserzioni e righe "senza spesa nel periodo": gruppi/
  // campagne/ghl.totale arrivano già filtrati dal server.
  filtroCampagne: Set<string> | null;
}) {
  const [vista, setVista] = useState<Vista>("tipo");
  const tabs = mostraValutazione ? [TAB_TIPO, TAB_CAMPAGNA, TAB_INSERZIONE] : [TAB_TIPO, TAB_CAMPAGNA];

  // Etichetta canale accanto al tipo_campagna nella vista "per singola campagna" — SOLO quando è
  // davvero presente più di un canale (Meta/Google Ads), stesso principio "invisibile con un solo
  // valore" di CampagneFilter.tsx: con un solo canale la vista resta identica a prima di questo campo.
  const mostraCanale = useMemo(() => new Set(campagne.map((c) => c.canale ?? "meta")).size > 1, [campagne]);

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

  // Colonne commerciali da GHL per le viste "tipo" e "campagna": stesse righe sotto (le campagne
  // del periodo + quelle senza spesa nel periodo ma con risultati), quindi stesso residuo.
  const ghlCampagne = useMemo(() => {
    if (ghl.stato !== "ok") return null;
    const fuoriPeriodo = campagneFuoriPeriodoConRisultati({
      perCampagna: ghl.perCampagna,
      idMostrati: new Set(campagne.map((c) => c.campaignId)),
      anagrafica: new Map(anagraficaCampagne.map((c) => [c.campaignId, c])),
      filtroCampagne,
    });
    const perTipo = risultatiGhlPerTipo({ perCampagna: ghl.perCampagna, campagneDelPeriodo: campagne, fuoriPeriodo });
    const tipiDelPeriodo = new Set(gruppi.map((g) => g.tipoCampagna));
    // Tipi campagna senza spesa nel periodo ma con un risultato del periodo (solo da campagne
    // "fuori periodo"): righe in più nella vista per tipo, altrimenti quel risultato sparirebbe.
    const tipiFuoriPeriodo = Array.from(perTipo.entries())
      .filter(([tipo, r]) => !tipiDelPeriodo.has(tipo) && haRisultati(r))
      .map(([tipo, risultati]) => ({ tipo, risultati }));
    const righe = [
      ...campagne.flatMap((c) => (ghl.perCampagna[c.campaignId] ? [risultatiDaBreakdown(ghl.perCampagna[c.campaignId])] : [])),
      ...fuoriPeriodo.map((c) => c.risultati),
    ];
    return { fuoriPeriodo, perTipo, tipiFuoriPeriodo, residuo: residuoNonAttribuito(ghl.totale, righe), totale: ghl.totale };
  }, [ghl, campagne, gruppi, anagraficaCampagne, filtroCampagne]);

  // Vista "per tipo" senza GHL: i Risultati Commerciali inseriti a mano sono compilati proprio per
  // tipo campagna (KpiGroup li porta già). Mostrati solo se nel periodo ce n'è almeno uno — una
  // sede che non li compila (o il link pubblico di una sede che usa GHL) vedrebbe solo falsi zeri.
  const manualePerTipo =
    ghl.stato === "assente" &&
    (totale.appuntamentiFissati > 0 || totale.appuntamentiEffettuati > 0 || totale.numeroVendite > 0 || totale.fatturato > 0);

  // Vista "per singola inserzione": inserzioni Meta del periodo (ordinate per spesa, ristrette alle
  // campagne selezionate se c'è un filtro) + inserzioni senza spesa nel periodo con risultati GHL.
  const vistaInserzioni = useMemo(() => {
    const righe = (filtroCampagne ? inserzioni.righe.filter((i) => filtroCampagne.has(i.campaignId)) : inserzioni.righe)
      .slice()
      .sort((a, b) => b.spesa - a.spesa);
    const spesa = righe.reduce((s, i) => s + i.spesa, 0);
    const lead = righe.reduce((s, i) => s + i.lead, 0);
    const totaleMeta = { spesa, lead, costoPerLead: lead ? spesa / lead : null };
    if (ghl.stato !== "ok") return { righe, totaleMeta, fuoriPeriodo: [], residuo: null, totaleGhl: null };
    const fuoriPeriodo = inserzioniFuoriPeriodoConRisultati({
      perInserzione: ghl.perInserzione,
      idMostrati: new Set(righe.map((i) => i.adId)),
      anagrafica: inserzioni.altre,
      filtroCampagne,
    });
    const attribuiti = [
      ...righe.flatMap((i) => (ghl.perInserzione[i.adId] ? [risultatiDaBreakdown(ghl.perInserzione[i.adId])] : [])),
      ...fuoriPeriodo.map((i) => i.risultati),
    ];
    return { righe, totaleMeta, fuoriPeriodo, residuo: residuoNonAttribuito(ghl.totale, attribuiti), totaleGhl: ghl.totale };
  }, [ghl, inserzioni, filtroCampagne]);

  const mostraRisultatiTipo = ghlCampagne !== null || manualePerTipo;
  // Colonne fra il nome e le colonne commerciali nella vista "per singola campagna": Stato + 6
  // metriche + (Frequenza) + Lead + Costo/Lead.
  const colonneMetaCampagna = mostraValutazione ? 10 : 9;

  const nota =
    ghl.stato === "caricamento" ? (
      <p className="px-5 mt-3 text-xs text-ink-500">Appuntamenti e vendite in caricamento…</p>
    ) : ghl.stato === "errore" ? (
      <p className="px-5 mt-3 text-xs text-red-600">Dati commerciali non disponibili al momento: appuntamenti e vendite non sono mostrati.</p>
    ) : ghl.stato === "ok" && ghl.fonte === "foglio" ? (
      <p className="px-5 mt-3 text-xs text-ink-500">
        Appuntamenti e vendite arrivano dal file contatti del cliente e sono collegati alla campagna e all&apos;inserzione del modulo
        compilato. Contano i contatti arrivati nel periodo, nello stato in cui si trovano oggi nel file.
      </p>
    ) : ghl.stato === "ok" ? (
      <p className="px-5 mt-3 text-xs text-ink-500">
        Appuntamenti e vendite arrivano da GHL e sono attribuiti alla campagna e all&apos;inserzione da cui è nato il contatto. Contano
        quelli fissati o chiusi nel periodo, anche quando il lead è arrivato prima.
      </p>
    ) : manualePerTipo && vista === "tipo" ? (
      <p className="px-5 mt-3 text-xs text-ink-500">Appuntamenti e vendite arrivano dai Risultati Commerciali inseriti a mano per tipo campagna.</p>
    ) : null;

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-brand" />
          <h3 className="font-heading font-bold text-ink-900 text-[15px]">Dettaglio</h3>
        </div>
        <Tabs
          tabs={tabs}
          attivo={vista}
          onChange={(id) => setVista(id === "campagna" ? "campagna" : id === "inserzione" ? "inserzione" : "tipo")}
        />
      </div>
      {nota}

      {vista === "tipo" && (
        <div className="overflow-x-auto mt-3">
          <table className={`w-full text-xs border-collapse ${mostraRisultatiTipo ? "min-w-[1150px]" : "min-w-[800px]"}`}>
            <thead>
              <tr className={RIGA}>
                <th className={TH_PRIMA}>Tipo campagna</th>
                {COLONNE_TIPO.map((c) => (
                  <th key={c.key} className={TH}>
                    {c.label}
                  </th>
                ))}
                {mostraRisultatiTipo && <IntestazioniRisultati />}
              </tr>
            </thead>
            <tbody>
              {gruppi.map((g) => (
                <tr key={g.tipoCampagna} className={RIGA}>
                  <td className={TD_PRIMA}>{g.tipoCampagna}</td>
                  {COLONNE_TIPO.map((c) => (
                    <td key={c.key} className={c.evidenzia ? TD_LEAD : TD}>
                      {c.format(g[c.key] as number | null)}
                    </td>
                  ))}
                  {ghlCampagne ? (
                    <CelleRisultati
                      risultati={ghlCampagne.perTipo.get(g.tipoCampagna) ?? null}
                      motivoAssente="Nessun contatto attribuito alle campagne di questo tipo"
                    />
                  ) : manualePerTipo ? (
                    <CelleRisultati
                      risultati={{
                        appuntamentiFissati: g.appuntamentiFissati,
                        appuntamentiEffettuati: g.appuntamentiEffettuati,
                        vendite: g.numeroVendite,
                        fatturato: g.fatturato,
                      }}
                    />
                  ) : null}
                </tr>
              ))}
              {ghlCampagne?.tipiFuoriPeriodo.map((t) => (
                <tr key={`fuori-periodo::${t.tipo}`} className={RIGA}>
                  <td className={TD_PRIMA}>
                    <span className="flex flex-col">
                      {t.tipo}
                      <span className={SOTTOTITOLO}>senza spesa nel periodo</span>
                    </span>
                  </td>
                  <CelleSenzaDatoMeta quante={COLONNE_TIPO.length} />
                  <CelleRisultati risultati={t.risultati} />
                </tr>
              ))}
              {ghlCampagne && haRisultati(ghlCampagne.residuo) && (
                <RigaResiduo
                  titolo="Non attribuiti a una campagna"
                  spiegazione="contatti organici, non tracciati o da campagne non presenti in app"
                  celleMeta={COLONNE_TIPO.length}
                  residuo={ghlCampagne.residuo}
                />
              )}
              <tr className={RIGA_TOTALE}>
                <td className={TD_PRIMA_TOTALE}>Totale</td>
                {COLONNE_TIPO.map((c) => (
                  <td key={c.key} className={c.evidenzia ? TD_TOTALE_LEAD : TD_TOTALE}>
                    {c.format(totale[c.key] as number | null)}
                  </td>
                ))}
                {ghlCampagne ? (
                  <CelleRisultati risultati={ghlCampagne.totale} classe={TD_TOTALE} />
                ) : manualePerTipo ? (
                  <CelleRisultati
                    risultati={{
                      appuntamentiFissati: totale.appuntamentiFissati,
                      appuntamentiEffettuati: totale.appuntamentiEffettuati,
                      vendite: totale.numeroVendite,
                      fatturato: totale.fatturato,
                    }}
                    classe={TD_TOTALE}
                  />
                ) : null}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {vista === "campagna" && (
        <div className="overflow-x-auto mt-3">
          <table className={`w-full text-xs border-collapse ${ghlCampagne ? "min-w-[1450px]" : "min-w-[1100px]"}`}>
            <thead>
              <tr className={RIGA}>
                <th className={TH_PRIMA}>Campagna</th>
                <th className={TH_SINISTRA}>Stato</th>
                <th className={TH}>Investimento</th>
                <th className={TH}>Impression</th>
                <th className={TH}>CPM</th>
                <th className={TH}>Clic sul link</th>
                <th className={TH}>Costo/clic</th>
                <th className={TH}>CTR link</th>
                {mostraValutazione && <th className={TH}>Frequenza</th>}
                <th className={TH}>Lead</th>
                <th className={TH}>Costo/Lead</th>
                {ghlCampagne && <IntestazioniRisultati />}
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
                const breakdown = ghl.stato === "ok" ? ghl.perCampagna[c.campaignId] : undefined;
                return (
                  <tr key={`${c.canale ?? "meta"}::${c.campaignId}`} className={RIGA}>
                    <td className={TD_PRIMA}>
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
                          <span className={SOTTOTITOLO}>
                            {c.tipoCampagna}
                            {mostraCanale ? ` · ${formatCanale(c.canale)}` : ""}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {stato ? (
                        <>
                          <Badge classe={stato.classe}>{stato.label}</Badge>
                          {c.statoDal && <span className="block text-[11px] text-ink-500 mt-1">dal {formatDataBreve(c.statoDal)}</span>}
                        </>
                      ) : (
                        <span className="text-xs text-ink-300">—</span>
                      )}
                    </td>
                    <td className={TD}>{formatEuro(c.investimento)}</td>
                    <td className={TD}>{formatNumero(c.impressions)}</td>
                    <td className={TD}>{formatEuro(c.cpm)}</td>
                    <td className={TD}>{formatNumero(c.clicLink)}</td>
                    <td className={TD}>{formatEuro(c.costoPerClic)}</td>
                    <td className={TD}>{formatPercentuale(c.ctrClicLink)}</td>
                    {mostraValutazione && <td className={TD}>{frequenza !== null ? frequenza.toFixed(2) : "—"}</td>}
                    <td className={TD_LEAD}>{formatNumero(c.numeroLead)}</td>
                    <td className={TD}>{formatEuro(c.costoPerLead)}</td>
                    {ghlCampagne && (
                      <CelleRisultati
                        risultati={breakdown ? risultatiDaBreakdown(breakdown) : null}
                        motivoAssente="Nessun contatto attribuito a questa campagna"
                      />
                    )}
                  </tr>
                );
              })}
              {ghlCampagne?.fuoriPeriodo.map((c) => (
                <tr key={`fuori-periodo::${c.campaignId}`} className={RIGA}>
                  <td className={TD_PRIMA}>
                    <span className="flex flex-col">
                      {c.nomeCampagna}
                      <span className={SOTTOTITOLO}>{c.tipoCampagna} · senza spesa nel periodo</span>
                    </span>
                  </td>
                  <CelleSenzaDatoMeta quante={colonneMetaCampagna} />
                  <CelleRisultati risultati={c.risultati} />
                </tr>
              ))}
              {ghlCampagne && haRisultati(ghlCampagne.residuo) && (
                <RigaResiduo
                  titolo="Non attribuiti a una campagna"
                  spiegazione="contatti organici, non tracciati o da campagne non presenti in app"
                  celleMeta={colonneMetaCampagna}
                  residuo={ghlCampagne.residuo}
                />
              )}
              {campagne.length === 0 && !ghlCampagne?.fuoriPeriodo.length && (
                <tr>
                  <td colSpan={1 + colonneMetaCampagna + (ghlCampagne ? 4 : 0)} className="px-5 py-6 text-center text-ink-500">
                    Nessuna campagna nel periodo selezionato.
                  </td>
                </tr>
              )}
              {(campagne.length > 0 || Boolean(ghlCampagne?.fuoriPeriodo.length)) && (
                <tr className={RIGA_TOTALE}>
                  <td className={TD_PRIMA_TOTALE}>Totale</td>
                  <td className="px-4 py-3" />
                  <td className={TD_TOTALE}>{formatEuro(totaleCampagne.investimento)}</td>
                  <td className={TD_TOTALE}>{formatNumero(totaleCampagne.impressions)}</td>
                  <td className={TD_TOTALE}>{formatEuro(totaleCampagne.cpm)}</td>
                  <td className={TD_TOTALE}>{formatNumero(totaleCampagne.clicLink)}</td>
                  <td className={TD_TOTALE}>{formatEuro(totaleCampagne.costoPerClic)}</td>
                  <td className={TD_TOTALE}>{formatPercentuale(totaleCampagne.ctrClicLink)}</td>
                  {mostraValutazione && <td className="px-4 py-3" />}
                  <td className={TD_TOTALE_LEAD}>{formatNumero(totaleCampagne.numeroLead)}</td>
                  <td className={TD_TOTALE}>{formatEuro(totaleCampagne.costoPerLead)}</td>
                  {ghlCampagne && <CelleRisultati risultati={ghlCampagne.totale} classe={TD_TOTALE} />}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {vista === "inserzione" &&
        (inserzioni.stato === "caricamento" ? (
          <p className="px-5 py-6 text-sm text-ink-500">Caricamento inserzioni…</p>
        ) : inserzioni.stato === "errore" ? (
          <p className="px-5 py-6 text-sm text-red-600">
            Dati Meta sulle inserzioni non disponibili al momento: Meta non ha risposto alla richiesta. Riprova tra poco.
          </p>
        ) : (
          <div className="overflow-x-auto mt-3">
            <table className={`w-full text-xs border-collapse ${vistaInserzioni.totaleGhl ? "min-w-[1100px]" : "min-w-[750px]"}`}>
              <thead>
                <tr className={RIGA}>
                  <th className={TH_PRIMA}>Inserzione</th>
                  <th className={TH_SINISTRA}>Stato</th>
                  <th className={TH}>Investimento</th>
                  <th className={TH}>Lead</th>
                  <th className={TH}>Costo/Lead</th>
                  {vistaInserzioni.totaleGhl && <IntestazioniRisultati />}
                </tr>
              </thead>
              <tbody>
                {vistaInserzioni.righe.map((i) => {
                  const stato = formatStatoCampagna(i.stato);
                  const breakdown = ghl.stato === "ok" ? ghl.perInserzione[i.adId] : undefined;
                  return (
                    <tr key={i.adId} className={RIGA}>
                      <td className={TD_PRIMA}>
                        <span className="flex flex-col">
                          {i.adName || `Inserzione ${i.adId}`}
                          <span className={SOTTOTITOLO}>{i.nomeCampagna}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {stato ? <Badge classe={stato.classe}>{stato.label}</Badge> : <span className="text-xs text-ink-300">—</span>}
                      </td>
                      <td className={TD}>{formatEuro(i.spesa)}</td>
                      <td className={TD_LEAD}>{formatNumero(i.lead)}</td>
                      <td className={TD}>{formatEuro(i.lead ? i.spesa / i.lead : null)}</td>
                      {vistaInserzioni.totaleGhl && (
                        <CelleRisultati
                          risultati={breakdown ? risultatiDaBreakdown(breakdown) : null}
                          motivoAssente="Nessun contatto attribuito a questa inserzione"
                        />
                      )}
                    </tr>
                  );
                })}
                {vistaInserzioni.fuoriPeriodo.map((i) => {
                  const stato = formatStatoCampagna(i.stato);
                  return (
                    <tr key={`fuori-periodo::${i.adId}`} className={RIGA}>
                      <td className={TD_PRIMA}>
                        <span className="flex flex-col">
                          {i.adName || `Inserzione ${i.adId}`}
                          <span className={SOTTOTITOLO}>
                            {i.adName
                              ? `${i.nomeCampagna ? `${i.nomeCampagna} · ` : ""}senza spesa nel periodo`
                              : "non trovata nell'account Meta (archiviata o eliminata) · senza spesa nel periodo"}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {stato ? <Badge classe={stato.classe}>{stato.label}</Badge> : <span className="text-xs text-ink-300">—</span>}
                      </td>
                      <CelleSenzaDatoMeta quante={3} />
                      <CelleRisultati risultati={i.risultati} />
                    </tr>
                  );
                })}
                {vistaInserzioni.residuo && haRisultati(vistaInserzioni.residuo) && (
                  <RigaResiduo
                    titolo="Senza inserzione riconoscibile"
                    spiegazione="contatti organici o non tracciati, oppure lead arrivati senza l'id dell'inserzione"
                    celleMeta={4}
                    residuo={vistaInserzioni.residuo}
                  />
                )}
                {vistaInserzioni.righe.length === 0 && vistaInserzioni.fuoriPeriodo.length === 0 && (
                  <tr>
                    <td colSpan={5 + (vistaInserzioni.totaleGhl ? 4 : 0)} className="px-5 py-6 text-center text-ink-500">
                      Nessuna inserzione con spesa nel periodo selezionato.
                    </td>
                  </tr>
                )}
                {(vistaInserzioni.righe.length > 0 || vistaInserzioni.fuoriPeriodo.length > 0) && (
                  <tr className={RIGA_TOTALE}>
                    <td className={TD_PRIMA_TOTALE}>Totale</td>
                    <td className="px-4 py-3" />
                    <td className={TD_TOTALE}>{formatEuro(vistaInserzioni.totaleMeta.spesa)}</td>
                    <td className={TD_TOTALE_LEAD}>{formatNumero(vistaInserzioni.totaleMeta.lead)}</td>
                    <td className={TD_TOTALE}>{formatEuro(vistaInserzioni.totaleMeta.costoPerLead)}</td>
                    {vistaInserzioni.totaleGhl && <CelleRisultati risultati={vistaInserzioni.totaleGhl} classe={TD_TOTALE} />}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ))}
    </Card>
  );
}
