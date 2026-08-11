import type { AttivitaClienteRow, StatoAttivita, TemplateTask } from "@/types/kpi";

export function aggiungiGiorni(dataIso: string, giorni: number): string {
  const d = new Date(`${dataIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
}

/** Lunedì (o comunque il primo giorno) della settimana N di un progetto che parte da `dataInizioProgetto`. */
export function dataInizioSettimana(dataInizioProgetto: string, settimana: number): string {
  return aggiungiGiorni(dataInizioProgetto, (settimana - 1) * 7);
}

/** Ultimo giorno della settimana N (6 giorni dopo il suo inizio). */
export function dataFineSettimana(dataInizioProgetto: string, settimana: number): string {
  return aggiungiGiorni(dataInizioProgetto, (settimana - 1) * 7 + 6);
}

/**
 * Genera lo snapshot di roadmap per un cliente a partire dal template del prodotto scelto.
 * Pura: le date sono "bruciate" da settimana a data concreta qui, una volta sola — la roadmap
 * del cliente non dipende più dal concetto di "settimana" dopo questo momento (snapshot, non
 * join a runtime: una correzione futura al template non si propaga retroattivamente).
 */
export function generaAttivitaPerCliente(
  clienteId: string,
  prodottoId: string,
  dataInizioProgetto: string,
  template: TemplateTask[]
): AttivitaClienteRow[] {
  return template
    .filter((t) => t.prodottoId === prodottoId)
    .map((t) => ({
      attivitaId: `${clienteId}::${t.taskId}`,
      clienteId,
      prodottoId,
      taskId: t.taskId,
      blocco: t.blocco,
      fase: t.fase,
      descrizione: t.descrizione,
      responsabile: t.responsabile,
      tipo: t.tipo,
      dataInizio: dataInizioSettimana(dataInizioProgetto, t.settimanaInizio),
      dataFine: dataFineSettimana(dataInizioProgetto, t.settimanaFine),
      stato: "todo" as StatoAttivita,
      notaTeam: "",
      ordine: t.ordine,
    }));
}

// "Bloccato" è un'eccezione, non una tappa del percorso: non è mai raggiunta ciclando, si imposta
// con un'azione dedicata nella UI (che richiede sempre una nota sul motivo). Cliccando su un'attività
// bloccata si "sblocca" tornando a todo, da cui riparte il ciclo normale.
const CICLO_STATO: Record<StatoAttivita, StatoAttivita> = {
  todo: "wip",
  wip: "done",
  done: "todo",
  blocked: "todo",
};

/** Prossimo stato nel ciclo a click todo → in corso → fatto → todo. */
export function prossimoStato(stato: StatoAttivita): StatoAttivita {
  return CICLO_STATO[stato];
}

export type GruppoFase = { fase: string; attivita: AttivitaClienteRow[] };

/** Raggruppa le attività per fase (corsie del Gantt), preservando l'ordine esplicito del template. */
export function raggruppaPerFase(attivita: AttivitaClienteRow[]): GruppoFase[] {
  const ordinate = [...attivita].sort((a, b) => a.ordine - b.ordine);
  const mappa = new Map<string, AttivitaClienteRow[]>();
  for (const a of ordinate) {
    const lista = mappa.get(a.fase) ?? [];
    lista.push(a);
    mappa.set(a.fase, lista);
  }
  return Array.from(mappa.entries()).map(([fase, attivita]) => ({ fase, attivita }));
}

/** Estremi (data minima/massima) di una roadmap, per dimensionare l'asse del Gantt. Null se vuota. */
export function rangeProgetto(attivita: AttivitaClienteRow[]): { minData: string; maxData: string } | null {
  if (attivita.length === 0) return null;
  let minData = attivita[0].dataInizio;
  let maxData = attivita[0].dataFine;
  for (const a of attivita) {
    if (a.dataInizio < minData) minData = a.dataInizio;
    if (a.dataFine > maxData) maxData = a.dataFine;
  }
  return { minData, maxData };
}
