"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
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
import { formatCanale, formatDataBreve, formatDecimale, formatEuro, formatNumero, formatPercentuale, formatStatoCampagna } from "@/lib/format";
import { Tabs } from "@/components/Tabs";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PallinoStato } from "@/components/ui/PallinoStato";
import { CLASSE_TITOLO_SEZIONE } from "@/components/ui/Intestazione";

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
//
// Forma (07/10/2026): "Tabella" del Design System ALC — intestazioni in maiuscolo su `sfondo`, prima
// colonna in grassetto `inchiostro`, numeri a destra con cifre tabellari, riga di totale su
// `accento-tenue`. Le viste per campagna e per inserzione si ordinano cliccando l'intestazione di
// una colonna e si possono restringere alle sole righe con appuntamenti o vendite: con una
// cinquantina di inserzioni, di cui poche con un risultato, prima non c'era modo di trovarle.
const COLONNE_TIPO: { key: keyof KpiGroup; label: string; format: (v: number | null) => string; evidenzia?: boolean }[] = [
  { key: "investimento", label: "Investimento", format: formatEuro },
  { key: "impressions", label: "Impression", format: formatNumero },
  { key: "cpm", label: "CPM", format: formatEuro },
  { key: "clicLink", label: "Clic sul link", format: formatNumero },
  { key: "costoPerClic", label: "Costo per clic", format: formatEuro },
  { key: "ctrClicLink", label: "CTR link", format: formatPercentuale },
  { key: "numeroLead", label: "Lead", format: formatNumero, evidenzia: true },
  { key: "costoPerLead", label: "Costo per lead", format: formatEuro },
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
      // Presente se per questa sede appuntamenti e/o vendite si leggono dagli stadi di pipeline
      // (src/lib/ghlStadi.ts): la nota in testa lo dice, col limite che comporta.
      daStadi?: { appuntamenti: boolean; vendite: boolean; nonTrovati: string[] };
    };

/** Inserzioni Meta del periodo (/api/meta-inserzioni). `altre` = anagrafica delle inserzioni senza
 * spesa nel periodo, per dare un nome alle righe a cui GHL attribuisce un risultato. */
export type DettaglioInserzioni = {
  stato: "caricamento" | "ok" | "errore";
  righe: InserzioneConStato[];
  altre: Record<string, AnagraficaInserzioneFuoriPeriodo>;
};

// Tabella fitta: fino a quindici colonne. Rispetto alla "Tabella" del Design System ALC (corpo a 14px)
// il corpo è a 13px, perché qui i numeri sono tanti e a 14px si toccavano (segnalato dall'utente
// l'08/10/2026: "scritte troppo grandi e appiccicate"). Il resto è quello del sistema: intestazioni
// maiuscole piccole, numeri a destra con cifre tabellari, totale su accento tenue.
const TABELLA = "w-full border-collapse text-[13px] leading-[18px] text-ink-700";
const RIGA = "border-b border-linea";
// Spazio di ogni cella: 12px per lato, quindi 24px fra una colonna e l'altra (prima erano 20).
const CELLA = "px-3 py-2.5";
const TH_BASE = `bg-surface ${CELLA} text-[11px] leading-[14px] font-bold uppercase tracking-[.06em] text-ink-500 align-bottom`;
const TH = `${TH_BASE} text-right`;
const TH_SINISTRA = `${TH_BASE} text-left`;
// La prima colonna resta ferma mentre le altre scorrono. Per i tipi di campagna, che hanno nomi
// brevi, basta poco; per campagne e inserzioni è larga, perché i loro nomi sono lunghi e in una
// colonna stretta andavano a capo su tre o quattro righe. Su telefono resta stretta: ferma com'è,
// una colonna larga coprirebbe quasi tutto lo schermo.
const PRIMA_BASE = `${TH_BASE} pl-5 pr-4 text-left sticky left-0`;
const TH_PRIMA = `${PRIMA_BASE} min-w-[168px]`;
const TH_PRIMA_NOME = `${PRIMA_BASE} min-w-[168px] sm:min-w-[220px] lg:w-[280px] lg:min-w-[280px]`;
const TD = `text-right ${CELLA} whitespace-nowrap tabular-nums`;
const TD_LEAD = `text-right ${CELLA} whitespace-nowrap tabular-nums font-bold text-brand`;
const TD_TOTALE = `text-right ${CELLA} font-extrabold whitespace-nowrap tabular-nums text-ink-900`;
const TD_TOTALE_LEAD = `text-right ${CELLA} font-extrabold whitespace-nowrap tabular-nums text-brand`;
const TD_PRIMA = "pl-5 pr-4 py-2.5 sticky left-0 bg-surface-card text-left font-semibold text-ink-900";
const RIGA_TOTALE = "bg-brand-light";
const TD_PRIMA_TOTALE = "pl-5 pr-4 py-2.5 sticky left-0 bg-brand-light text-left font-extrabold text-ink-900";
const SOTTOTITOLO = "text-[11px] leading-[15px] text-ink-500 font-normal";

type Verso = "asc" | "desc";
type Ordine<K extends string> = { chiave: K; verso: Verso } | null;

/** Ordina una copia delle righe. I dati mancanti (`null`) restano sempre in fondo, in entrambi i
 * versi: una riga senza dato non è né la più alta né la più bassa. */
function ordinaRighe<T, K extends string>(righe: T[], ordine: Ordine<K>, valori: Record<K, (riga: T) => number | string | null>): T[] {
  if (!ordine) return righe;
  const leggi = valori[ordine.chiave];
  const segno = ordine.verso === "asc" ? 1 : -1;
  return righe.slice().sort((a, b) => {
    const va = leggi(a);
    const vb = leggi(b);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    if (typeof va === "string" || typeof vb === "string") return segno * String(va).localeCompare(String(vb), "it");
    return segno * (va - vb);
  });
}

/** Clic su un'intestazione: la prima volta ordina (dal più alto per i numeri, dalla A per i nomi),
 * la seconda inverte. */
function prossimoOrdine<K extends string>(attuale: Ordine<K>, chiave: K, testuale: boolean): Ordine<K> {
  if (attuale?.chiave === chiave) return { chiave, verso: attuale.verso === "asc" ? "desc" : "asc" };
  return { chiave, verso: testuale ? "asc" : "desc" };
}

function ThOrdinabile<K extends string>({
  chiave,
  ordine,
  onOrdina,
  classe = TH,
  children,
}: {
  chiave: K;
  ordine: Ordine<K>;
  onOrdina: (chiave: K) => void;
  classe?: string;
  children: ReactNode;
}) {
  const attivo = ordine?.chiave === chiave ? ordine.verso : null;
  const Icona = attivo === "asc" ? ArrowUp : attivo === "desc" ? ArrowDown : ChevronsUpDown;
  return (
    <th scope="col" aria-sort={attivo === "asc" ? "ascending" : attivo === "desc" ? "descending" : "none"} className={classe}>
      {/* La freccia sta nello spazio fra una colonna e l'altra, a sinistra dell'etichetta, e non le
          toglie larghezza: tredici frecce in fila allargavano ogni colonna di 16px e riempivano
          l'intestazione di segni. Ora si vede solo sulla colonna ordinata, e al passaggio del mouse. */}
      <button
        type="button"
        onClick={() => onOrdina(chiave)}
        title="Ordina per questa colonna"
        className={`group relative -my-1 inline-flex min-h-6 items-end py-1 text-inherit font-bold uppercase tracking-[.06em] cursor-pointer hover:text-ink-900 ${attivo ? "text-ink-900" : ""}`}
      >
        <Icona
          size={11}
          aria-hidden="true"
          className={`absolute -left-3 bottom-[5px] ${attivo ? "" : "opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-60"}`}
        />
        <span>{children}</span>
      </button>
    </th>
  );
}

const COLONNE_RISULTATI = [
  { chiave: "appuntamentiFissati", label: "App. fissati" },
  { chiave: "appuntamentiEffettuati", label: "App. effettuati" },
  { chiave: "vendite", label: "Vendite" },
  { chiave: "fatturato", label: "Fatturato" },
] as const;
type ChiaveRisultati = (typeof COLONNE_RISULTATI)[number]["chiave"];

function IntestazioniRisultati() {
  return (
    <>
      {COLONNE_RISULTATI.map((c) => (
        <th key={c.chiave} scope="col" className={TH}>
          {c.label}
        </th>
      ))}
    </>
  );
}

/** Le 4 celle commerciali di una riga. `risultati` null = nessun contatto attribuito a quella riga:
 * lo dice una sola cella larga quattro colonne, con il motivo scritto — mai uno zero silenzioso, e
 * non più quattro "?" da interrogare col mouse (120 su una pagina di inserzioni). */
function CelleRisultati({ risultati, motivoAssente, classe = TD }: { risultati: RisultatiGhl | null; motivoAssente?: string; classe?: string }) {
  if (!risultati) {
    return (
      <td colSpan={4} className={`${CELLA} text-right text-xs text-ink-500`}>
        {motivoAssente ?? "Dato non disponibile"}
      </td>
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
        <td key={i} className={`text-right ${CELLA} text-ink-500`}>
          —
        </td>
      ))}
    </>
  );
}

function RigaResiduo({ titolo, spiegazione, celleMeta, residuo }: { titolo: string; spiegazione: string; celleMeta: number; residuo: RisultatiGhl }) {
  return (
    <tr className={RIGA}>
      <th scope="row" className={TD_PRIMA}>
        <span className="flex flex-col">
          {titolo}
          <span className={SOTTOTITOLO}>{spiegazione}</span>
        </span>
      </th>
      <CelleSenzaDatoMeta quante={celleMeta} />
      <CelleRisultati risultati={residuo} />
    </tr>
  );
}

type ChiaveCampagna =
  | "nome"
  | "investimento"
  | "impressions"
  | "cpm"
  | "clicLink"
  | "costoPerClic"
  | "ctrClicLink"
  | "frequenza"
  | "numeroLead"
  | "costoPerLead"
  | ChiaveRisultati;
type RigaVistaCampagna = { campagna: RigaCampagna; frequenza: number | null; risultati: RisultatiGhl | null };

const VALORI_CAMPAGNA: Record<ChiaveCampagna, (r: RigaVistaCampagna) => number | string | null> = {
  nome: (r) => r.campagna.nomeCampagna,
  investimento: (r) => r.campagna.investimento,
  impressions: (r) => r.campagna.impressions,
  cpm: (r) => r.campagna.cpm,
  clicLink: (r) => r.campagna.clicLink,
  costoPerClic: (r) => r.campagna.costoPerClic,
  ctrClicLink: (r) => r.campagna.ctrClicLink,
  frequenza: (r) => r.frequenza,
  numeroLead: (r) => r.campagna.numeroLead,
  costoPerLead: (r) => r.campagna.costoPerLead,
  appuntamentiFissati: (r) => r.risultati?.appuntamentiFissati ?? null,
  appuntamentiEffettuati: (r) => r.risultati?.appuntamentiEffettuati ?? null,
  vendite: (r) => r.risultati?.vendite ?? null,
  fatturato: (r) => r.risultati?.fatturato ?? null,
};

type ChiaveInserzione = "nome" | "spesa" | "lead" | "costoPerLead" | ChiaveRisultati;
type RigaVistaInserzione = { inserzione: InserzioneConStato; costoPerLead: number | null; risultati: RisultatiGhl | null };

const VALORI_INSERZIONE: Record<ChiaveInserzione, (r: RigaVistaInserzione) => number | string | null> = {
  nome: (r) => r.inserzione.adName || r.inserzione.adId,
  spesa: (r) => r.inserzione.spesa,
  lead: (r) => r.inserzione.lead,
  costoPerLead: (r) => r.costoPerLead,
  appuntamentiFissati: (r) => r.risultati?.appuntamentiFissati ?? null,
  appuntamentiEffettuati: (r) => r.risultati?.appuntamentiEffettuati ?? null,
  vendite: (r) => r.risultati?.vendite ?? null,
  fatturato: (r) => r.risultati?.fatturato ?? null,
};

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
  // Ordinamento scelto cliccando un'intestazione — null = ordine di partenza (campagne come
  // arrivano dal server, inserzioni per spesa).
  const [ordineCampagne, setOrdineCampagne] = useState<Ordine<ChiaveCampagna>>(null);
  const [ordineInserzioni, setOrdineInserzioni] = useState<Ordine<ChiaveInserzione>>(null);
  // "Solo con appuntamenti o vendite": nasconde le righe senza nessun risultato commerciale. Vale
  // per le viste per campagna e per inserzione; i totali restano quelli dell'intera sede.
  const [soloConRisultati, setSoloConRisultati] = useState(false);

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

  // Righe della vista "per singola campagna": la campagna con la sua frequenza e i suoi risultati
  // GHL, poi ordinate e ristrette secondo le scelte fatte in tabella.
  const righeCampagne = useMemo(() => {
    const tutte: RigaVistaCampagna[] = campagne.map((campagna) => {
      const breakdown = ghl.stato === "ok" ? ghl.perCampagna[campagna.campaignId] : undefined;
      return { campagna, frequenza: frequenzaPerCampagna[campagna.campaignId] ?? null, risultati: breakdown ? risultatiDaBreakdown(breakdown) : null };
    });
    const visibili = soloConRisultati && ghl.stato === "ok" ? tutte.filter((r) => r.risultati && haRisultati(r.risultati)) : tutte;
    return { righe: ordinaRighe(visibili, ordineCampagne, VALORI_CAMPAGNA), nascoste: tutte.length - visibili.length };
  }, [campagne, ghl, frequenzaPerCampagna, soloConRisultati, ordineCampagne]);

  // Vista "per singola inserzione": inserzioni Meta del periodo (per spesa finché non si sceglie un
  // altro ordine, ristrette alle campagne selezionate se c'è un filtro) + inserzioni senza spesa nel
  // periodo con risultati GHL.
  const vistaInserzioni = useMemo(() => {
    const delPeriodo = (filtroCampagne ? inserzioni.righe.filter((i) => filtroCampagne.has(i.campaignId)) : inserzioni.righe)
      .slice()
      .sort((a, b) => b.spesa - a.spesa);
    const spesa = delPeriodo.reduce((s, i) => s + i.spesa, 0);
    const lead = delPeriodo.reduce((s, i) => s + i.lead, 0);
    const totaleMeta = { spesa, lead, costoPerLead: lead ? spesa / lead : null };
    const tutte: RigaVistaInserzione[] = delPeriodo.map((inserzione) => {
      const breakdown = ghl.stato === "ok" ? ghl.perInserzione[inserzione.adId] : undefined;
      return {
        inserzione,
        costoPerLead: inserzione.lead ? inserzione.spesa / inserzione.lead : null,
        risultati: breakdown ? risultatiDaBreakdown(breakdown) : null,
      };
    });
    const visibili = soloConRisultati && ghl.stato === "ok" ? tutte.filter((r) => r.risultati && haRisultati(r.risultati)) : tutte;
    const righe = ordinaRighe(visibili, ordineInserzioni, VALORI_INSERZIONE);
    const nascoste = tutte.length - visibili.length;
    if (ghl.stato !== "ok") return { righe, nascoste, totaleMeta, fuoriPeriodo: [], residuo: null, totaleGhl: null };
    const fuoriPeriodo = inserzioniFuoriPeriodoConRisultati({
      perInserzione: ghl.perInserzione,
      idMostrati: new Set(delPeriodo.map((i) => i.adId)),
      anagrafica: inserzioni.altre,
      filtroCampagne,
    });
    const attribuiti = [...tutte.flatMap((r) => (r.risultati ? [r.risultati] : [])), ...fuoriPeriodo.map((i) => i.risultati)];
    return { righe, nascoste, totaleMeta, fuoriPeriodo, residuo: residuoNonAttribuito(ghl.totale, attribuiti), totaleGhl: ghl.totale };
  }, [ghl, inserzioni, filtroCampagne, soloConRisultati, ordineInserzioni]);

  const mostraRisultatiTipo = ghlCampagne !== null || manualePerTipo;
  // Colonne fra il nome e le colonne commerciali nella vista "per singola campagna": Stato + 6
  // metriche + (Frequenza) + Lead + Costo per lead.
  const colonneMetaCampagna = mostraValutazione ? 10 : 9;

  const ordinaCampagne = (chiave: ChiaveCampagna) => setOrdineCampagne((o) => prossimoOrdine(o, chiave, chiave === "nome"));
  const ordinaInserzioni = (chiave: ChiaveInserzione) => setOrdineInserzioni((o) => prossimoOrdine(o, chiave, chiave === "nome"));

  const nota =
    ghl.stato === "caricamento" ? (
      <p role="status" className="px-5 mt-3 text-xs text-ink-500">
        Appuntamenti e vendite in caricamento…
      </p>
    ) : ghl.stato === "errore" ? (
      <p role="alert" className="px-5 mt-3 text-xs font-semibold text-critico">
        Dati commerciali non disponibili al momento: appuntamenti e vendite non sono mostrati.
      </p>
    ) : ghl.stato === "ok" && ghl.fonte === "foglio" ? (
      <p className="px-5 mt-3 text-xs text-ink-500">
        Appuntamenti e vendite arrivano dal file contatti del cliente e sono collegati alla campagna e all&apos;inserzione del modulo
        compilato. Contano i contatti arrivati nel periodo, nello stato in cui si trovano oggi nel file.
      </p>
    ) : ghl.stato === "ok" && ghl.daStadi ? (
      <div className="px-5 mt-3 space-y-1 text-xs text-ink-500">
        <p>
          {/* Una stringa sola: scritto come testo dopo la parentesi graffa, lo spazio fra soggetto e verbo spariva. */}
          {`${ghl.daStadi.appuntamenti && ghl.daStadi.vendite ? "Appuntamenti e vendite" : ghl.daStadi.appuntamenti ? "Gli appuntamenti" : "Le vendite"} si leggono dagli stadi della pipeline su GHL, e sono attribuiti alla campagna e all'inserzione da cui è nato il contatto. Ogni contatto conta una volta, alla data del suo ultimo spostamento di stadio: GHL non conserva i passaggi precedenti, quindi i numeri di un periodo passato possono calare quando i contatti avanzano.`}
        </p>
        {ghl.daStadi.nonTrovati.length > 0 && (
          <p className="font-semibold text-attenzione">
            In queste pipeline uno stadio scelto non esiste, e lì non si conta: {ghl.daStadi.nonTrovati.join("; ")}. Si corregge da Modifica cliente, nella connessione GHL della sede.
          </p>
        )}
      </div>
    ) : ghl.stato === "ok" ? (
      <p className="px-5 mt-3 text-xs text-ink-500">
        Appuntamenti e vendite arrivano da GHL e sono attribuiti alla campagna e all&apos;inserzione da cui è nato il contatto. Contano
        quelli fissati o chiusi nel periodo, anche quando il lead è arrivato prima.
      </p>
    ) : manualePerTipo && vista === "tipo" ? (
      <p className="px-5 mt-3 text-xs text-ink-500">Appuntamenti e vendite arrivano dai Risultati Commerciali inseriti a mano per tipo campagna.</p>
    ) : null;

  // Solo dove ha senso: viste con molte righe e colonne commerciali presenti.
  const filtroRisultati = ghl.stato === "ok" && vista !== "tipo" && (
    <label className="mx-5 mt-3 inline-flex min-h-8 items-center gap-2 text-sm text-ink-700 cursor-pointer">
      <input
        type="checkbox"
        checked={soloConRisultati}
        onChange={(e) => setSoloConRisultati(e.target.checked)}
        className="h-[18px] w-[18px] accent-[var(--brand-primary)] cursor-pointer"
      />
      Solo con appuntamenti o vendite
    </label>
  );

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 flex-wrap gap-3">
        <h3 className={CLASSE_TITOLO_SEZIONE}>Dettaglio</h3>
        <Tabs
          etichetta="Livello di dettaglio"
          tabs={tabs}
          attivo={vista}
          onChange={(id) => setVista(id === "campagna" ? "campagna" : id === "inserzione" ? "inserzione" : "tipo")}
        />
      </div>
      {nota}
      {filtroRisultati}

      {vista === "tipo" && (
        <div className="overflow-x-auto mt-4">
          <table className={`${TABELLA} ${mostraRisultatiTipo ? "min-w-[1040px]" : "min-w-[760px]"}`}>
            <thead>
              <tr className={RIGA}>
                <th scope="col" className={TH_PRIMA}>
                  Tipo campagna
                </th>
                {COLONNE_TIPO.map((c) => (
                  <th key={c.key} scope="col" className={TH}>
                    {c.label}
                  </th>
                ))}
                {mostraRisultatiTipo && <IntestazioniRisultati />}
              </tr>
            </thead>
            <tbody>
              {gruppi.map((g) => (
                <tr key={g.tipoCampagna} className={RIGA}>
                  <th scope="row" className={TD_PRIMA}>
                    {g.tipoCampagna}
                  </th>
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
                  <th scope="row" className={TD_PRIMA}>
                    <span className="flex flex-col">
                      {t.tipo}
                      <span className={SOTTOTITOLO}>senza spesa nel periodo</span>
                    </span>
                  </th>
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
                <th scope="row" className={TD_PRIMA_TOTALE}>
                  Totale
                </th>
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
        <div className="overflow-x-auto mt-4">
          <table className={`${TABELLA} ${ghlCampagne ? "min-w-[1320px]" : "min-w-[1040px]"}`}>
            <thead>
              <tr className={RIGA}>
                <ThOrdinabile chiave="nome" ordine={ordineCampagne} onOrdina={ordinaCampagne} classe={TH_PRIMA_NOME}>
                  Campagna
                </ThOrdinabile>
                <th scope="col" className={TH_SINISTRA}>
                  Stato
                </th>
                <ThOrdinabile chiave="investimento" ordine={ordineCampagne} onOrdina={ordinaCampagne}>
                  Investimento
                </ThOrdinabile>
                <ThOrdinabile chiave="impressions" ordine={ordineCampagne} onOrdina={ordinaCampagne}>
                  Impression
                </ThOrdinabile>
                <ThOrdinabile chiave="cpm" ordine={ordineCampagne} onOrdina={ordinaCampagne}>
                  CPM
                </ThOrdinabile>
                <ThOrdinabile chiave="clicLink" ordine={ordineCampagne} onOrdina={ordinaCampagne}>
                  Clic sul link
                </ThOrdinabile>
                <ThOrdinabile chiave="costoPerClic" ordine={ordineCampagne} onOrdina={ordinaCampagne}>
                  Costo per clic
                </ThOrdinabile>
                <ThOrdinabile chiave="ctrClicLink" ordine={ordineCampagne} onOrdina={ordinaCampagne}>
                  CTR link
                </ThOrdinabile>
                {mostraValutazione && (
                  <ThOrdinabile chiave="frequenza" ordine={ordineCampagne} onOrdina={ordinaCampagne}>
                    Frequenza
                  </ThOrdinabile>
                )}
                <ThOrdinabile chiave="numeroLead" ordine={ordineCampagne} onOrdina={ordinaCampagne}>
                  Lead
                </ThOrdinabile>
                <ThOrdinabile chiave="costoPerLead" ordine={ordineCampagne} onOrdina={ordinaCampagne}>
                  Costo per lead
                </ThOrdinabile>
                {ghlCampagne &&
                  COLONNE_RISULTATI.map((col) => (
                    <ThOrdinabile key={col.chiave} chiave={col.chiave} ordine={ordineCampagne} onOrdina={ordinaCampagne}>
                      {col.label}
                    </ThOrdinabile>
                  ))}
              </tr>
            </thead>
            <tbody>
              {righeCampagne.righe.map(({ campagna: c, frequenza, risultati }) => {
                const stato = formatStatoCampagna(c.stato);
                const attiva = c.stato === "ACTIVE";
                // Una campagna non attiva (in pausa/archiviata/eliminata) non è azionabile ora — il
                // pallino resta grigio a prescindere da CPL/Frequenza, mai un giudizio su qualcosa
                // che non si può più correggere in questo momento.
                const valutazione = !mostraValutazione
                  ? null
                  : !attiva
                    ? { livello: "non-valutabile" as const, motivo: "Campagna non attiva" }
                    : valutaCampagna({ costoPerLead: c.costoPerLead, frequenza, targetCpl });
                return (
                  <tr key={`${c.canale ?? "meta"}::${c.campaignId}`} className={RIGA}>
                    <th scope="row" className={TD_PRIMA}>
                      <span className="flex items-start gap-2">
                        {valutazione && (
                          <PallinoStato
                            tono={valutazione.livello === "non-valutabile" ? "neutro" : valutazione.livello}
                            motivo={valutazione.motivo}
                            className="mt-2"
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
                    </th>
                    <td className={`${CELLA} whitespace-nowrap`}>
                      {stato ? (
                        <>
                          <Badge classe={stato.classe}>{stato.label}</Badge>
                          {c.statoDal && <span className="mt-1 block text-[11px] leading-[15px] text-ink-500">dal {formatDataBreve(c.statoDal)}</span>}
                        </>
                      ) : (
                        <span className="text-xs text-ink-500">—</span>
                      )}
                    </td>
                    <td className={TD}>{formatEuro(c.investimento)}</td>
                    <td className={TD}>{formatNumero(c.impressions)}</td>
                    <td className={TD}>{formatEuro(c.cpm)}</td>
                    <td className={TD}>{formatNumero(c.clicLink)}</td>
                    <td className={TD}>{formatEuro(c.costoPerClic)}</td>
                    <td className={TD}>{formatPercentuale(c.ctrClicLink)}</td>
                    {mostraValutazione && <td className={TD}>{formatDecimale(frequenza)}</td>}
                    <td className={TD_LEAD}>{formatNumero(c.numeroLead)}</td>
                    <td className={TD}>{formatEuro(c.costoPerLead)}</td>
                    {ghlCampagne && <CelleRisultati risultati={risultati} motivoAssente="Nessun contatto attribuito" />}
                  </tr>
                );
              })}
              {ghlCampagne?.fuoriPeriodo.map((c) => (
                <tr key={`fuori-periodo::${c.campaignId}`} className={RIGA}>
                  <th scope="row" className={TD_PRIMA}>
                    <span className="flex flex-col">
                      {c.nomeCampagna}
                      <span className={SOTTOTITOLO}>{c.tipoCampagna} · senza spesa nel periodo</span>
                    </span>
                  </th>
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
              {righeCampagne.nascoste > 0 && (
                <RigaNascoste colonne={1 + colonneMetaCampagna + 4} quante={righeCampagne.nascoste} cosa={["campagna nascosta", "campagne nascoste"]} />
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
                  <th scope="row" className={TD_PRIMA_TOTALE}>
                    Totale
                  </th>
                  <td className={CELLA} />
                  <td className={TD_TOTALE}>{formatEuro(totaleCampagne.investimento)}</td>
                  <td className={TD_TOTALE}>{formatNumero(totaleCampagne.impressions)}</td>
                  <td className={TD_TOTALE}>{formatEuro(totaleCampagne.cpm)}</td>
                  <td className={TD_TOTALE}>{formatNumero(totaleCampagne.clicLink)}</td>
                  <td className={TD_TOTALE}>{formatEuro(totaleCampagne.costoPerClic)}</td>
                  <td className={TD_TOTALE}>{formatPercentuale(totaleCampagne.ctrClicLink)}</td>
                  {mostraValutazione && <td className={CELLA} />}
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
          <p role="status" className="px-5 py-6 text-sm text-ink-500">
            Caricamento inserzioni…
          </p>
        ) : inserzioni.stato === "errore" ? (
          <p role="alert" className="px-5 py-6 text-sm font-semibold text-critico">
            Dati Meta sulle inserzioni non disponibili al momento: Meta non ha risposto alla richiesta. Riprova tra poco.
          </p>
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className={`${TABELLA} ${vistaInserzioni.totaleGhl ? "min-w-[1040px]" : "min-w-[720px]"}`}>
              <thead>
                <tr className={RIGA}>
                  <ThOrdinabile chiave="nome" ordine={ordineInserzioni} onOrdina={ordinaInserzioni} classe={TH_PRIMA_NOME}>
                    Inserzione
                  </ThOrdinabile>
                  <th scope="col" className={TH_SINISTRA}>
                    Stato
                  </th>
                  <ThOrdinabile chiave="spesa" ordine={ordineInserzioni} onOrdina={ordinaInserzioni}>
                    Investimento
                  </ThOrdinabile>
                  <ThOrdinabile chiave="lead" ordine={ordineInserzioni} onOrdina={ordinaInserzioni}>
                    Lead
                  </ThOrdinabile>
                  <ThOrdinabile chiave="costoPerLead" ordine={ordineInserzioni} onOrdina={ordinaInserzioni}>
                    Costo per lead
                  </ThOrdinabile>
                  {vistaInserzioni.totaleGhl &&
                    COLONNE_RISULTATI.map((col) => (
                      <ThOrdinabile key={col.chiave} chiave={col.chiave} ordine={ordineInserzioni} onOrdina={ordinaInserzioni}>
                        {col.label}
                      </ThOrdinabile>
                    ))}
                </tr>
              </thead>
              <tbody>
                {vistaInserzioni.righe.map(({ inserzione: i, costoPerLead, risultati }) => {
                  const stato = formatStatoCampagna(i.stato);
                  return (
                    <tr key={i.adId} className={RIGA}>
                      <th scope="row" className={TD_PRIMA}>
                        <span className="flex flex-col">
                          {i.adName || `Inserzione ${i.adId}`}
                          <span className={SOTTOTITOLO}>{i.nomeCampagna}</span>
                        </span>
                      </th>
                      <td className={`${CELLA} whitespace-nowrap`}>
                        {stato ? <Badge classe={stato.classe}>{stato.label}</Badge> : <span className="text-xs text-ink-500">—</span>}
                      </td>
                      <td className={TD}>{formatEuro(i.spesa)}</td>
                      <td className={TD_LEAD}>{formatNumero(i.lead)}</td>
                      <td className={TD}>{formatEuro(costoPerLead)}</td>
                      {vistaInserzioni.totaleGhl && <CelleRisultati risultati={risultati} motivoAssente="Nessun contatto attribuito" />}
                    </tr>
                  );
                })}
                {vistaInserzioni.fuoriPeriodo.map((i) => {
                  const stato = formatStatoCampagna(i.stato);
                  return (
                    <tr key={`fuori-periodo::${i.adId}`} className={RIGA}>
                      <th scope="row" className={TD_PRIMA}>
                        <span className="flex flex-col">
                          {i.adName || `Inserzione ${i.adId}`}
                          <span className={SOTTOTITOLO}>
                            {i.adName
                              ? `${i.nomeCampagna ? `${i.nomeCampagna} · ` : ""}senza spesa nel periodo`
                              : "non trovata nell'account Meta (archiviata o eliminata) · senza spesa nel periodo"}
                          </span>
                        </span>
                      </th>
                      <td className={`${CELLA} whitespace-nowrap`}>
                        {stato ? <Badge classe={stato.classe}>{stato.label}</Badge> : <span className="text-xs text-ink-500">—</span>}
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
                {vistaInserzioni.nascoste > 0 && (
                  <RigaNascoste colonne={9} quante={vistaInserzioni.nascoste} cosa={["inserzione nascosta", "inserzioni nascoste"]} />
                )}
                {vistaInserzioni.righe.length === 0 && vistaInserzioni.nascoste === 0 && vistaInserzioni.fuoriPeriodo.length === 0 && (
                  <tr>
                    <td colSpan={5 + (vistaInserzioni.totaleGhl ? 4 : 0)} className="px-5 py-6 text-center text-ink-500">
                      Nessuna inserzione con spesa nel periodo selezionato.
                    </td>
                  </tr>
                )}
                {(vistaInserzioni.righe.length > 0 || vistaInserzioni.nascoste > 0 || vistaInserzioni.fuoriPeriodo.length > 0) && (
                  <tr className={RIGA_TOTALE}>
                    <th scope="row" className={TD_PRIMA_TOTALE}>
                      Totale
                    </th>
                    <td className={CELLA} />
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

/** Riga che dichiara quante righe il filtro "Solo con appuntamenti o vendite" sta nascondendo: il
 * totale sotto resta quello di tutta la sede, e chi legge deve sapere perché non è la somma delle
 * righe che vede. */
function RigaNascoste({ colonne, quante, cosa }: { colonne: number; quante: number; cosa: [string, string] }) {
  return (
    <tr className={RIGA}>
      <td colSpan={colonne} className="px-5 py-3 text-xs text-ink-500">
        {quante} {quante === 1 ? cosa[0] : cosa[1]} perché senza appuntamenti né vendite. Il totale le comprende.
      </td>
    </tr>
  );
}
