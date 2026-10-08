import type { AttivitaClienteRow, Cliente, Prodotto } from "@/types/kpi";

/**
 * Assegnare un prodotto a un cliente che esiste già (08/10/2026). Prima il prodotto si sceglieva
 * solo creando il cliente; a un cliente nato senza lo si poteva dare soltanto dalla tabella del
 * database. Regole condivise fra l'indirizzo che lo assegna (/api/clienti/prodotto) e la scheda
 * "Prodotto" di Modifica cliente. Funzioni pure.
 *
 * Assegnare un prodotto vuol dire due cose insieme: scriverlo sul cliente con la data di inizio del
 * progetto, e far nascere la sua roadmap — le attività del modello del prodotto, con le date
 * calcolate da quella data. Per questo:
 *   - si assegna solo a chi non ha già prodotto e data: cambiare prodotto a un cliente che ha già la
 *     sua roadmap lascerebbe le attività del prodotto di prima mescolate alle nuove;
 *   - un prodotto senza modello non si assegna: non farebbe nascere nulla, e poi non si potrebbe più
 *     cambiare;
 *   - prima di confermare si vede quante attività nascono, e quante con la scadenza già passata —
 *     con una data di inizio vecchia finiscono subito fra quelle in ritardo.
 */

const GIORNO = /^\d{4}-\d{2}-\d{2}$/;

/** Un giorno che esiste davvero, scritto AAAA-MM-GG. */
export function giornoValido(giorno: string): boolean {
  if (!GIORNO.test(giorno)) return false;
  const d = new Date(`${giorno}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === giorno;
}

/** Vero se al cliente si può ancora assegnare un prodotto: gli manca il prodotto, o la data di inizio. */
export function prodottoAssegnabile(cliente: Pick<Cliente, "prodottoId" | "dataInizioProgetto">): boolean {
  return !cliente.prodottoId || !cliente.dataInizioProgetto;
}

export type ErroreAssegnazione = { errore: string; stato: 400 | 404 | 409 };

/** Perché questo prodotto non si può assegnare a questo cliente con questa data, o null se si può. */
export function erroreAssegnazioneProdotto(input: {
  cliente: Pick<Cliente, "prodottoId" | "dataInizioProgetto"> | undefined;
  prodotti: Pick<Prodotto, "prodottoId" | "nome" | "attivo">[];
  prodottoId: string;
  dataInizioProgetto: string;
}): ErroreAssegnazione | null {
  const { cliente, prodotti, prodottoId, dataInizioProgetto } = input;
  if (!cliente) return { errore: "Cliente non trovato", stato: 404 };
  if (!prodottoId) return { errore: "Scegli un prodotto", stato: 400 };
  if (!giornoValido(dataInizioProgetto)) return { errore: "Indica la data di inizio del progetto", stato: 400 };

  const nomeDi = (id: string) => prodotti.find((p) => p.prodottoId === id)?.nome ?? id;
  if (!prodottoAssegnabile(cliente)) {
    return { errore: `Il cliente ha già un prodotto (${nomeDi(cliente.prodottoId)}): da qui non si cambia`, stato: 409 };
  }
  // Prodotto già scritto ma senza data di inizio (capitava nel foglio): si può solo completarlo.
  if (cliente.prodottoId && cliente.prodottoId !== prodottoId) {
    return { errore: `Il cliente ha già il prodotto ${nomeDi(cliente.prodottoId)}: gli manca solo la data di inizio`, stato: 409 };
  }

  const prodotto = prodotti.find((p) => p.prodottoId === prodottoId);
  if (!prodotto) return { errore: "Prodotto non trovato", stato: 400 };
  if (!prodotto.attivo) return { errore: `Il prodotto ${prodotto.nome} è disattivato: si riattiva da Impostazioni`, stato: 400 };
  return null;
}

export type RiepilogoRoadmap = {
  /** Le attività che nascono: quelle del modello che il cliente non ha già. */
  nuove: number;
  /** Attività del modello che il cliente ha già (stesso identificativo): restano come sono. */
  giaPresenti: number;
  /** Primo giorno e ultima scadenza delle attività nuove; null se non ne nasce nessuna. */
  dal: string | null;
  al: string | null;
  /** Attività nuove con la scadenza già passata: compaiono subito fra quelle in ritardo. */
  giaScadute: number;
};

/** Cosa succede assegnando: quante attività nascono, in che arco di tempo, quante già scadute. */
export function riepilogoRoadmap(righe: Pick<AttivitaClienteRow, "attivitaId" | "dataInizio" | "dataFine">[], idEsistenti: Set<string>, oggi: string): RiepilogoRoadmap {
  const nuove = righe.filter((r) => !idEsistenti.has(r.attivitaId));
  return {
    nuove: nuove.length,
    giaPresenti: righe.length - nuove.length,
    dal: nuove.length > 0 ? nuove.reduce((min, r) => (r.dataInizio < min ? r.dataInizio : min), nuove[0].dataInizio) : null,
    al: nuove.length > 0 ? nuove.reduce((max, r) => (r.dataFine > max ? r.dataFine : max), nuove[0].dataFine) : null,
    giaScadute: nuove.filter((r) => r.dataFine < oggi).length,
  };
}
