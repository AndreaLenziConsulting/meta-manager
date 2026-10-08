import { formatMeseEsteso, giornoMeseBreve } from "@/lib/format";
import { isPeriodoMensile, settimanaDiData, ultimoGiornoDelMese } from "@/lib/kpi";
import { spostaMese } from "@/lib/periodo";
import { aggiungiGiorni, oggiIso } from "@/lib/roadmap";
import type { RigaRisultatiCommerciali, RigaRisultatiVenditori } from "@/lib/archivio";

/**
 * Regole dei risultati inseriti a mano (richieste, appuntamenti, vendite, fatturato), condivise fra
 * il modulo di inserimento nella scheda cliente e l'indirizzo che li salva. Funzioni pure.
 *
 * Un periodo è un mese ("2026-10") o una settimana, indicata dal suo lunedì ("2026-10-05"): è la
 * stessa doppia forma di RisultatoCommercialeRow.periodo (src/types/kpi.ts).
 */
export type Granularita = "settimana" | "mese";

const MESE = /^\d{4}-(0[1-9]|1[0-2])$/;
const GIORNO = /^\d{4}-\d{2}-\d{2}$/;

function giornoEsistente(giorno: string): boolean {
  if (!GIORNO.test(giorno)) return false;
  const d = new Date(`${giorno}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === giorno;
}

/** Un mese vero, oppure un giorno vero che è un lunedì. */
export function periodoValido(periodo: string): boolean {
  if (MESE.test(periodo)) return true;
  return giornoEsistente(periodo) && settimanaDiData(periodo) === periodo;
}

export function granularitaDi(periodo: string): Granularita {
  return isPeriodoMensile(periodo) ? "mese" : "settimana";
}

/** Primo e ultimo giorno del periodo. */
export function intervalloDelPeriodo(periodo: string): { da: string; a: string } {
  return isPeriodoMensile(periodo) ? { da: `${periodo}-01`, a: ultimoGiornoDelMese(periodo) } : { da: periodo, a: aggiungiGiorni(periodo, 6) };
}

/** "Ottobre 2026", oppure "28 set – 4 ott 2026" per una settimana. */
export function etichettaPeriodo(periodo: string): string {
  if (isPeriodoMensile(periodo)) return formatMeseEsteso(periodo);
  const { da, a } = intervalloDelPeriodo(periodo);
  return `${giornoMeseBreve(da)} – ${giornoMeseBreve(a)} ${a.slice(0, 4)}`;
}

/** Il periodo `passi` più avanti (o indietro, se negativo), della stessa grana. */
export function spostaPeriodo(periodo: string, passi: number): string {
  return isPeriodoMensile(periodo) ? spostaMese(periodo, passi) : aggiungiGiorni(periodo, passi * 7);
}

/** L'ultimo periodo già concluso: di solito è quello di cui si conoscono i risultati. */
export function ultimoPeriodoConcluso(granularita: Granularita, oggi: string = oggiIso()): string {
  return granularita === "mese" ? spostaMese(oggi.slice(0, 7), -1) : aggiungiGiorni(settimanaDiData(oggi), -7);
}

/** Il periodo della stessa grana che contiene `giorno`. */
export function periodoDelGiorno(granularita: Granularita, giorno: string): string {
  return granularita === "mese" ? giorno.slice(0, 7) : settimanaDiData(giorno);
}

/** Un periodo che non è ancora cominciato non ha risultati da inserire. */
export function periodoFuturo(periodo: string, oggi: string = oggiIso()): boolean {
  return intervalloDelPeriodo(periodo).da > oggi;
}

/** Una settimana a cavallo di due mesi: conta solo nei periodi che la contengono tutta, quindi in nessuno dei due mesi presi da soli. */
export function settimanaACavalloDiDueMesi(periodo: string): boolean {
  if (isPeriodoMensile(periodo)) return false;
  const { da, a } = intervalloDelPeriodo(periodo);
  return da.slice(0, 7) !== a.slice(0, 7);
}

/**
 * I periodi già compilati che coprono giorni in comune con `periodo`: un mese e una settimana di
 * quel mese, per esempio. Se convivessero, in un intervallo che li contiene entrambi quei giorni
 * verrebbero contati due volte: l'inserimento li rifiuta.
 */
export function periodiSovrapposti(periodo: string, compilati: string[]): string[] {
  const { da, a } = intervalloDelPeriodo(periodo);
  return [...new Set(compilati)].filter((altro) => {
    if (altro === periodo) return false;
    const i = intervalloDelPeriodo(altro);
    return i.da <= a && da <= i.a;
  });
}

type Esito<T> = { ok: true; righe: T[] } | { ok: false; errore: string };

function conteggio(valore: unknown): number | null {
  return typeof valore === "number" && Number.isInteger(valore) && valore >= 0 && valore <= 1_000_000 ? valore : null;
}

function importo(valore: unknown): number | null {
  if (typeof valore !== "number" || !Number.isFinite(valore) || valore < 0 || valore > 1_000_000_000) return null;
  return Math.round(valore * 100) / 100;
}

const NOMI_CAMPI = {
  richieste: "le richieste",
  appuntamentiFissati: "gli appuntamenti fissati",
  appuntamentiEffettuati: "gli appuntamenti effettuati",
  vendite: "le vendite",
} as const;

/**
 * Controlla le righe ricevute per un periodo: una per tipo di campagna, conteggi interi e non
 * negativi, fatturato non negativo (arrotondato al centesimo). Restituisce le righe ripulite o il
 * primo errore, detto in modo che chi compila capisca quale campo correggere.
 */
export function controllaRigheCommerciali(righe: unknown): Esito<RigaRisultatiCommerciali> {
  if (!Array.isArray(righe)) return { ok: false, errore: "Righe dei risultati mancanti" };
  const pulite: RigaRisultatiCommerciali[] = [];
  const visti = new Set<string>();
  for (const grezza of righe as Record<string, unknown>[]) {
    const tipoCampagna = typeof grezza?.tipoCampagna === "string" ? grezza.tipoCampagna.trim() : null;
    if (tipoCampagna === null) return { ok: false, errore: "Tipo di campagna mancante in una riga" };
    const nome = tipoCampagna || "Non classificata";
    if (visti.has(tipoCampagna)) return { ok: false, errore: `"${nome}" compare due volte` };
    visti.add(tipoCampagna);
    const riga = { tipoCampagna, richieste: 0, appuntamentiFissati: 0, appuntamentiEffettuati: 0, vendite: 0, fatturato: 0 };
    for (const campo of Object.keys(NOMI_CAMPI) as (keyof typeof NOMI_CAMPI)[]) {
      const v = conteggio(grezza[campo]);
      if (v === null) return { ok: false, errore: `${nome}: ${NOMI_CAMPI[campo]} devono essere un numero intero, da zero in su` };
      riga[campo] = v;
    }
    const fatturato = importo(grezza.fatturato);
    if (fatturato === null) return { ok: false, errore: `${nome}: il fatturato deve essere un importo da zero in su` };
    riga.fatturato = fatturato;
    pulite.push(riga);
  }
  return { ok: true, righe: pulite };
}

/** Come controllaRigheCommerciali, per i risultati mensili dei venditori: `venditoriSede` sono gli id ammessi. */
export function controllaRigheVenditori(righe: unknown, venditoriSede: Set<string>): Esito<RigaRisultatiVenditori> {
  if (!Array.isArray(righe)) return { ok: false, errore: "Righe dei risultati mancanti" };
  const pulite: RigaRisultatiVenditori[] = [];
  const visti = new Set<string>();
  for (const grezza of righe as Record<string, unknown>[]) {
    const venditoreId = typeof grezza?.venditoreId === "string" ? grezza.venditoreId : "";
    if (!venditoriSede.has(venditoreId)) return { ok: false, errore: "Un venditore indicato non appartiene a questa sede" };
    if (visti.has(venditoreId)) return { ok: false, errore: "Lo stesso venditore compare due volte" };
    visti.add(venditoreId);
    const appuntamentiFissati = conteggio(grezza.appuntamentiFissati);
    const vendite = conteggio(grezza.vendite);
    const fatturato = importo(grezza.fatturato);
    if (appuntamentiFissati === null) return { ok: false, errore: "Gli appuntamenti fissati devono essere un numero intero, da zero in su" };
    if (vendite === null) return { ok: false, errore: "Le vendite devono essere un numero intero, da zero in su" };
    if (fatturato === null) return { ok: false, errore: "Il fatturato deve essere un importo da zero in su" };
    pulite.push({ venditoreId, appuntamentiFissati, vendite, fatturato });
  }
  return { ok: true, righe: pulite };
}

/**
 * Perché questo periodo non si può salvare, o null se si può. `compilati` sono i periodi che la
 * stessa sede ha già. Svuotare un periodo (nessuna riga) è sempre permesso.
 */
export function erroreSulPeriodo(periodo: string, haRighe: boolean, compilati: string[], oggi: string = oggiIso()): string | null {
  if (!periodoValido(periodo)) return "Periodo non valido: serve un mese oppure il lunedì di una settimana";
  if (!haRighe) return null;
  if (periodoFuturo(periodo, oggi)) return `${etichettaPeriodo(periodo)} non è ancora cominciato: non ci sono risultati da inserire`;
  const sovrapposti = periodiSovrapposti(periodo, compilati);
  if (sovrapposti.length > 0) {
    const elenco = sovrapposti.sort().map(etichettaPeriodo).join(", ");
    return isPeriodoMensile(periodo)
      ? `Per ${etichettaPeriodo(periodo)} ci sono già risultati inseriti a settimane (${elenco}): contarli anche nel mese li raddoppierebbe. Svuota prima quelle settimane, oppure continua a settimane.`
      : `La settimana ${etichettaPeriodo(periodo)} cade in un mese già compilato per intero (${elenco}): contarla a parte la raddoppierebbe. Svuota prima il mese, oppure correggi quello.`;
  }
  return null;
}
