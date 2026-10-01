import type { GhlBreakdownCampagna } from "@/types/ghl";
import type { AnagraficaInserzioneFuoriPeriodo } from "@/lib/inserzioniOutlier";

// Logica pura della tabella Dettaglio (DettaglioCampagneEsteso.tsx) per le colonne commerciali
// lette da GHL — "quanti appuntamenti fissati e quante vendite derivano dai lead" di ogni tipo
// campagna, singola campagna e singola inserzione (richiesta utente 01/10/2026).
//
// Regola comune alle tre viste: OGNI appuntamento/vendita del periodo deve comparire in una riga,
// mai sparire in silenzio. Un risultato del periodo può arrivare da un lead generato PRIMA del
// periodo (un contatto di due mesi fa che fissa o chiude oggi): la sua campagna/inserzione può
// quindi non avere speso nulla nel periodo scelto e non essere tra le righe Meta. In quel caso:
// - se la campagna/inserzione è nota (anagrafica) compare come riga in più "senza spesa nel
//   periodo" — è proprio l'informazione "quale inserzione produce vendite" che l'utente cerca;
// - tutto il resto (contatti organici, non tracciati, senza id inserzione) finisce in UNA riga di
//   residuo calcolata per differenza dal totale sede (residuoNonAttribuito), così il Totale in
//   fondo coincide sempre con le tessere in alto.

export type RisultatiGhl = {
  appuntamentiFissati: number;
  appuntamentiEffettuati: number;
  vendite: number;
  fatturato: number;
};

export const RISULTATI_ZERO: RisultatiGhl = { appuntamentiFissati: 0, appuntamentiEffettuati: 0, vendite: 0, fatturato: 0 };

export function risultatiDaBreakdown(b: Pick<GhlBreakdownCampagna, "appuntamenti" | "opportunita">): RisultatiGhl {
  return {
    appuntamentiFissati: b.appuntamenti.totali,
    appuntamentiEffettuati: b.appuntamenti.effettuati,
    vendite: b.opportunita.vendite,
    fatturato: b.opportunita.fatturato,
  };
}

export function sommaRisultati(elenco: RisultatiGhl[]): RisultatiGhl {
  return elenco.reduce(
    (somma, r) => ({
      appuntamentiFissati: somma.appuntamentiFissati + r.appuntamentiFissati,
      appuntamentiEffettuati: somma.appuntamentiEffettuati + r.appuntamentiEffettuati,
      vendite: somma.vendite + r.vendite,
      fatturato: somma.fatturato + r.fatturato,
    }),
    RISULTATI_ZERO
  );
}

/** true se almeno un valore è > 0 — una riga "in più" o di residuo si mostra solo in quel caso. */
export function haRisultati(r: RisultatiGhl): boolean {
  return r.appuntamentiFissati > 0 || r.appuntamentiEffettuati > 0 || r.vendite > 0 || r.fatturato > 0;
}

/**
 * Quello che il totale sede contiene e nessuna riga mostra: `totale` meno la somma delle righe.
 * Mai negativo (le righe sono insiemi disgiunti di contatti, sottoinsieme del totale — il max(0)
 * è solo una cintura di sicurezza); fatturato arrotondato al centesimo, altrimenti la sottrazione
 * in virgola mobile lascerebbe residui tipo 0,0000001 € che farebbero comparire una riga fantasma.
 */
export function residuoNonAttribuito(totale: RisultatiGhl, righe: RisultatiGhl[]): RisultatiGhl {
  const somma = sommaRisultati(righe);
  return {
    appuntamentiFissati: Math.max(0, totale.appuntamentiFissati - somma.appuntamentiFissati),
    appuntamentiEffettuati: Math.max(0, totale.appuntamentiEffettuati - somma.appuntamentiEffettuati),
    vendite: Math.max(0, totale.vendite - somma.vendite),
    fatturato: Math.max(0, Math.round((totale.fatturato - somma.fatturato) * 100) / 100),
  };
}

function ordinaPerRisultati<T extends { risultati: RisultatiGhl }>(righe: T[], nome: (r: T) => string): T[] {
  return [...righe].sort(
    (a, b) =>
      b.risultati.fatturato - a.risultati.fatturato ||
      b.risultati.vendite - a.risultati.vendite ||
      b.risultati.appuntamentiFissati - a.risultati.appuntamentiFissati ||
      nome(a).localeCompare(nome(b))
  );
}

export type CampagnaFuoriPeriodo = { campaignId: string; nomeCampagna: string; tipoCampagna: string; risultati: RisultatiGhl };

/**
 * Campagne NOTE della sede (anagrafica) che non sono tra le righe del periodo (nessuna spesa nel
 * periodo) ma a cui GHL attribuisce almeno un appuntamento/vendita del periodo. Una campagna non in
 * anagrafica (mai sincronizzata in app, o di un altro account) resta fuori: senza nome né tipo non
 * è una riga leggibile, finisce nel residuo. Con un filtro campagne attivo valgono solo le
 * campagne selezionate (il totale sede passato dal chiamante è già ristretto a quelle).
 */
export function campagneFuoriPeriodoConRisultati(input: {
  perCampagna: Record<string, GhlBreakdownCampagna>;
  idMostrati: Set<string>;
  anagrafica: Map<string, { nomeCampagna: string; tipoCampagna: string }>;
  filtroCampagne: Set<string> | null;
}): CampagnaFuoriPeriodo[] {
  const righe: CampagnaFuoriPeriodo[] = [];
  for (const [campaignId, breakdown] of Object.entries(input.perCampagna)) {
    if (input.idMostrati.has(campaignId)) continue;
    if (input.filtroCampagne && !input.filtroCampagne.has(campaignId)) continue;
    const info = input.anagrafica.get(campaignId);
    if (!info) continue;
    const risultati = risultatiDaBreakdown(breakdown);
    if (!haRisultati(risultati)) continue;
    righe.push({ campaignId, nomeCampagna: info.nomeCampagna, tipoCampagna: info.tipoCampagna, risultati });
  }
  return ordinaPerRisultati(righe, (r) => r.nomeCampagna);
}

/**
 * Appuntamenti/vendite GHL per TIPO di campagna: somma, per ogni tipo, delle sue campagne del
 * periodo che hanno almeno un contatto attribuito, più le campagne fuori periodo con risultati
 * (campagneFuoriPeriodoConRisultati) — così il numero per tipo coincide sempre con la somma delle
 * righe dello stesso tipo nella vista "per singola campagna". Un tipo assente dalla mappa = nessuna
 * delle sue campagne ha un contatto attribuito: "non disponibile", mai uno zero silenzioso (stessa
 * regola di GhlRiepilogoResponse.perCampagna).
 */
export function risultatiGhlPerTipo(input: {
  perCampagna: Record<string, GhlBreakdownCampagna>;
  campagneDelPeriodo: { campaignId: string; tipoCampagna: string }[];
  fuoriPeriodo: CampagnaFuoriPeriodo[];
}): Map<string, RisultatiGhl> {
  const perTipo = new Map<string, RisultatiGhl>();
  const aggiungi = (tipo: string, r: RisultatiGhl) => perTipo.set(tipo, sommaRisultati([perTipo.get(tipo) ?? RISULTATI_ZERO, r]));
  for (const c of input.campagneDelPeriodo) {
    const breakdown = input.perCampagna[c.campaignId];
    if (breakdown) aggiungi(c.tipoCampagna, risultatiDaBreakdown(breakdown));
  }
  for (const c of input.fuoriPeriodo) aggiungi(c.tipoCampagna, c.risultati);
  return perTipo;
}

export type InserzioneFuoriPeriodo = {
  adId: string;
  // "" se l'inserzione non è nell'anagrafica Meta dell'account (archiviata/eliminata, o di un altro
  // account): la riga si mostra comunque con il solo id — il risultato è reale, manca solo il nome.
  adName: string;
  campaignId: string;
  nomeCampagna: string;
  stato: string;
  risultati: RisultatiGhl;
};

/**
 * Inserzioni che non hanno speso nel periodo (assenti dalle righe Meta) ma a cui GHL attribuisce
 * almeno un appuntamento/vendita del periodo. Nome/campagna/stato dall'anagrafica Meta quando
 * l'inserzione esiste ancora. Con un filtro campagne attivo si tengono solo le inserzioni la cui
 * campagna è selezionata — un'inserzione fuori anagrafica non ha una campagna verificabile e in
 * quel caso resta fuori (finisce nel residuo, mai attribuita a caso).
 */
export function inserzioniFuoriPeriodoConRisultati(input: {
  perInserzione: Record<string, GhlBreakdownCampagna>;
  idMostrati: Set<string>;
  anagrafica: Record<string, AnagraficaInserzioneFuoriPeriodo>;
  filtroCampagne: Set<string> | null;
}): InserzioneFuoriPeriodo[] {
  const righe: InserzioneFuoriPeriodo[] = [];
  for (const [adId, breakdown] of Object.entries(input.perInserzione)) {
    if (input.idMostrati.has(adId)) continue;
    const info = input.anagrafica[adId];
    if (input.filtroCampagne && (!info || !input.filtroCampagne.has(info.campaignId))) continue;
    const risultati = risultatiDaBreakdown(breakdown);
    if (!haRisultati(risultati)) continue;
    righe.push({
      adId,
      adName: info?.adName ?? "",
      campaignId: info?.campaignId ?? "",
      nomeCampagna: info?.nomeCampagna ?? "",
      stato: info?.stato ?? "",
      risultati,
    });
  }
  return ordinaPerRisultati(righe, (r) => r.adName || r.adId);
}
