import { classificaAssegnatario } from "@/lib/assegnatari";
import { formatEuro, formatNumero, giornoMeseBreve } from "@/lib/format";
import { etichettaIntervallo, type PresetPeriodoId } from "@/lib/periodo";
import { GIORNI_FINESTRA_DA_FARE_ORA, aggiungiGiorni, attivitaDiRoadmap, giorniTra } from "@/lib/roadmap";
import type { AttivitaClienteRow, KpiGroup } from "@/types/kpi";

/**
 * La sintesi che il cliente legge in cima alla sua pagina (09/10/2026, prima voce della Fase 2 della
 * roadmap: "riepilogo chiaro e sempre aggiornato di cosa sta succedendo sul proprio account, per
 * ridurre le domande ripetute in call"). Funzioni pure.
 *
 * Scritta con regole fisse, non con l'AI (scelta dell'utente): ogni frase è composta dal codice a
 * partire dai numeri della pagina, quindi dice sempre e solo ciò che è nei dati. Dove un dato manca la
 * frase non c'è — mai uno zero al posto di un dato assente, mai un confronto con un periodo che non
 * ha numeri.
 *
 * Tre pezzi:
 *   - i numeri del periodo scelto, gli stessi delle tessere, col confronto sul periodo precedente;
 *   - a che punto sono i lavori: quante attività della roadmap fatte sul totale, e le fasi in corso;
 *   - "serve da te": le attività assegnate al cliente, non fatte, già cominciate o in scadenza.
 *
 * L'avanzamento conta solo le attività della ROADMAP del prodotto: è il piano del progetto, quello
 * che il cliente ha comprato. Le attività sparse — aggiunte a mano o nate dai meeting — sono la
 * lista delle cose da fare del team: contarle direbbe al cliente "0 attività fatte su 39" per un
 * elenco che non è un piano (caso vero visto sui dati il 09/10/2026). Un cliente senza roadmap non
 * ha quindi una frase di avanzamento. "Serve da te" invece guarda tutte le attività, da qualunque
 * parte arrivino: un compito dato al cliente in un meeting è suo quanto uno della roadmap. Le tappe
 * non sono compiti: non compaiono fra le cose da fare.
 *
 * Cosa NON arriva al cliente: delle attività del team vede solo i conteggi e i nomi delle fasi, mai
 * le singole descrizioni (restano del team, come la scheda Attività). Vede per esteso solo le
 * attività assegnate a lui.
 */

// ───────────────────────── i numeri ─────────────────────────

const PERIODO: Record<PresetPeriodoId, string> = {
  oggi: "Oggi",
  ieri: "Ieri",
  "ultimi-7-giorni": "Negli ultimi 7 giorni",
  "ultimi-14-giorni": "Negli ultimi 14 giorni",
  "ultimi-28-giorni": "Negli ultimi 28 giorni",
  "ultimi-30-giorni": "Negli ultimi 30 giorni",
  "questa-settimana": "Questa settimana",
  "settimana-scorsa": "La settimana scorsa",
  "questo-mese": "Questo mese",
  "mese-scorso": "Il mese scorso",
  "ultimi-3-mesi": "Negli ultimi 3 mesi",
  "ultimi-6-mesi": "Negli ultimi 6 mesi",
  "anno-corrente": "Quest'anno",
  "anno-precedente": "L'anno scorso",
};

/** Come comincia la frase dei numeri: "Negli ultimi 30 giorni", oppure le date per un periodo scelto a mano. */
export function inizioFrasePeriodo(preset: PresetPeriodoId | "personalizzato", da: string, a: string): string {
  return preset === "personalizzato" ? `Nel periodo ${etichettaIntervallo(da, a)}` : PERIODO[preset];
}

type Numeri = Pick<KpiGroup, "investimento" | "numeroLead" | "costoPerLead" | "appuntamentiFissati" | "appuntamentiEffettuati" | "numeroVendite" | "fatturato">;

/** "salito del 12%" / "sceso del 12%"; null se la variazione è sotto l'1% (si dice "stabile"). */
function variazione(attuale: number, precedente: number, su: string, giu: string): string | null {
  const percento = Math.round((Math.abs(attuale - precedente) / precedente) * 100);
  if (percento < 1) return null;
  return `${attuale > precedente ? su : giu} del ${percento}%`;
}

/**
 * Le frasi sui numeri. `precedente` è il periodo di confronto (null se non c'è o non è arrivato);
 * `confronto` dice con cosa si confronta ("al periodo precedente", "a 1 lug 2026 – 31 lug 2026").
 * `commercialiInseriti`: vero se per il periodo qualcuno ha inserito appuntamenti e vendite — solo
 * allora se ne parla (sul link del cliente quei numeri non arrivano da altre fonti).
 */
export function frasiNumeri(input: { inizio: string; totale: Numeri; precedente: Numeri | null; confronto: string; commercialiInseriti: boolean }): string[] {
  const { inizio, totale, precedente, confronto, commercialiInseriti } = input;
  const frasi: string[] = [];

  if (totale.investimento <= 0) {
    frasi.push(`${inizio} non c'è stata spesa pubblicitaria.`);
  } else if (totale.numeroLead <= 0) {
    frasi.push(`${inizio} hai investito ${formatEuro(totale.investimento)} e non sono ancora arrivati contatti.`);
  } else {
    const contatti = totale.numeroLead === 1 ? "è arrivato 1 contatto" : `sono arrivati ${formatNumero(totale.numeroLead)} contatti`;
    frasi.push(`${inizio} hai investito ${formatEuro(totale.investimento)} e ${contatti}, a ${formatEuro(totale.costoPerLead)} l'uno.`);
  }

  // Il confronto solo quando è onesto: ci sono contatti in tutti e due i periodi.
  if (precedente && totale.numeroLead > 0 && precedente.numeroLead > 0) {
    const pezzi: string[] = [];
    const contatti = variazione(totale.numeroLead, precedente.numeroLead, "saliti", "scesi");
    pezzi.push(contatti ? `i contatti sono ${contatti}` : "i contatti sono rimasti stabili");
    if (totale.costoPerLead !== null && precedente.costoPerLead !== null && precedente.costoPerLead > 0) {
      const costo = variazione(totale.costoPerLead, precedente.costoPerLead, "salito", "sceso");
      pezzi.push(costo ? `il costo per contatto è ${costo}` : "il costo per contatto è rimasto stabile");
    }
    frasi.push(`Rispetto ${confronto}, ${pezzi.join(" e ")}.`);
  }

  if (commercialiInseriti) {
    const appuntamenti =
      totale.appuntamentiFissati === 1 ? "1 appuntamento prenotato" : `${formatNumero(totale.appuntamentiFissati)} appuntamenti prenotati`;
    const effettuati = totale.appuntamentiFissati > 0 ? ` (${formatNumero(totale.appuntamentiEffettuati)} già fatti)` : "";
    const vendite =
      totale.numeroVendite === 0
        ? "nessuna vendita registrata"
        : `${totale.numeroVendite === 1 ? "1 vendita" : `${formatNumero(totale.numeroVendite)} vendite`} per ${formatEuro(totale.fatturato)}`;
    frasi.push(`Da questi contatti: ${appuntamenti}${effettuati}, ${vendite}.`);
  }
  return frasi;
}

// ───────────────────────── i lavori ─────────────────────────

/** Quante attività "serve da te" si elencano: le altre si contano soltanto. */
const DA_TE_ELENCATE = 5;
/** Quante fasi in corso si nominano. */
const FASI_NOMINATE = 3;

export type AttivitaDelCliente = { descrizione: string; scadenza: string; giorniDiRitardo: number };

export type AvanzamentoRoadmap = {
  totali: number;
  fatte: number;
  /** I nomi delle fasi cominciate e non finite, dalla più vecchia. */
  fasiInCorso: string[];
};

export type SintesiLavori = {
  /** Quanto è avanti la roadmap del prodotto; null se il cliente non ne ha una. */
  avanzamento: AvanzamentoRoadmap | null;
  /** Le attività assegnate al cliente, non fatte, già cominciate o in scadenza: prima le più urgenti. */
  serveDaTe: AttivitaDelCliente[];
  /** Quante altre ce ne sono oltre quelle elencate. */
  altreDaTe: number;
};

/** La sigla delle tappe (vedi TIPI_ATTIVITA in impostazioni.ts): segnano un traguardo, non un compito. */
const TIPO_TAPPA = "MIL";

const delCliente = (a: AttivitaClienteRow) => a.assegnatari.some((nome) => classificaAssegnatario(nome) === "cliente");

/**
 * Lo stato dei lavori di un cliente, in ciò che il cliente può vedere. `null` se non c'è nulla da
 * dirgli: nessuna roadmap e nessun compito suo.
 */
export function sintesiLavori(tutte: AttivitaClienteRow[], oggi: string): SintesiLavori | null {
  const attivita = tutte.filter(attivitaDiRoadmap);

  // Una fase è in corso se ha qualcosa di cominciato (avviato a mano, o con la data di inizio già
  // arrivata) e non è ancora tutta fatta. Le attività senza fase non fanno una fase.
  const perFase = new Map<string, AttivitaClienteRow[]>();
  for (const a of attivita) {
    if (!a.fase.trim()) continue;
    perFase.set(a.fase, [...(perFase.get(a.fase) ?? []), a]);
  }
  const fasiInCorso = Array.from(perFase.entries())
    .filter(([, sue]) => sue.some((a) => a.stato !== "done") && sue.some((a) => a.stato === "wip" || a.stato === "done" || a.dataInizio <= oggi))
    .map(([fase, sue]) => ({ fase, inizio: sue.reduce((min, a) => (a.dataInizio < min ? a.dataInizio : min), sue[0].dataInizio) }))
    .sort((x, y) => (x.inizio < y.inizio ? -1 : x.inizio > y.inizio ? 1 : x.fase.localeCompare(y.fase)))
    .slice(0, FASI_NOMINATE)
    .map((f) => f.fase.trim());

  // Al cliente si chiede ciò che è già da fare: cominciato, oppure in scadenza entro la stessa
  // finestra della vista "Da fare ora" del team. Un compito previsto fra due mesi non è ancora suo.
  const limite = aggiungiGiorni(oggi, GIORNI_FINESTRA_DA_FARE_ORA);
  const daTe = tutte
    .filter((a) => a.stato !== "done" && a.tipo !== TIPO_TAPPA && delCliente(a) && (a.dataInizio <= oggi || a.dataFine <= limite))
    .sort((x, y) => (x.dataFine < y.dataFine ? -1 : x.dataFine > y.dataFine ? 1 : x.ordine - y.ordine));

  if (attivita.length === 0 && daTe.length === 0) return null;
  return {
    avanzamento: attivita.length > 0 ? { totali: attivita.length, fatte: attivita.filter((a) => a.stato === "done").length, fasiInCorso } : null,
    serveDaTe: daTe.slice(0, DA_TE_ELENCATE).map((a) => ({ descrizione: a.descrizione, scadenza: a.dataFine, giorniDiRitardo: Math.max(0, giorniTra(a.dataFine, oggi)) })),
    altreDaTe: Math.max(0, daTe.length - DA_TE_ELENCATE),
  };
}

/** "14 attività fatte su 22." più le fasi in corso, se ce ne sono. */
export function fraseLavori(lavori: AvanzamentoRoadmap): string {
  const avanzamento =
    lavori.fatte === lavori.totali
      ? lavori.totali === 1
        ? "L'attività prevista è stata fatta."
        : `Tutte le ${lavori.totali} attività previste sono state fatte.`
      : `${lavori.fatte === 1 ? "1 attività fatta" : `${lavori.fatte} attività fatte`} su ${lavori.totali}.`;
  if (lavori.fasiInCorso.length === 0) return avanzamento;
  return `${avanzamento} ${lavori.fasiInCorso.length === 1 ? "In corso la fase" : "In corso le fasi"}: ${lavori.fasiInCorso.join(", ")}.`;
}

/** "scaduta da 3 giorni", "scade oggi", "scadenza 12 ott" (senza articolo: "entro il 8 ott" non si può dire). */
export function quandoScade(a: AttivitaDelCliente, oggi: string): string {
  if (a.giorniDiRitardo > 0) return a.giorniDiRitardo === 1 ? "scaduta da 1 giorno" : `scaduta da ${a.giorniDiRitardo} giorni`;
  if (a.scadenza === oggi) return "scade oggi";
  return `scadenza ${giornoMeseBreve(a.scadenza)}`;
}
