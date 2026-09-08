import type { AttivitaClienteRow, FaseCompletataRow, StatoAttivita, TemplateTask } from "@/types/kpi";

export function aggiungiGiorni(dataIso: string, giorni: number): string {
  const d = new Date(`${dataIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
}

/** Data odierna in formato ISO (YYYY-MM-DD). */
export function oggiIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Giorni tra due date ISO (b - a). Spostata qui da RoadmapGantt.tsx: serve anche fuori dal Gantt
 * (dashboard admin) per calcolare i giorni di ritardo di un'attività. */
export function giorniTra(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000);
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
 * Inverso di dataInizioSettimana/dataFineSettimana: in che settimana del progetto siamo oggi,
 * dato quando è iniziato. Serve al consulente per capire a colpo d'occhio "dove siamo" senza
 * contare a mano — utile in vista di rinnovo contratto/upsell. Clampata a 1 se il progetto non è
 * ancora iniziato (dataInizioProgetto nel futuro): mai un numero ≤ 0, che si leggerebbe come un bug.
 */
export function settimanaCorrente(dataInizioProgetto: string, oggi: string = oggiIso()): number {
  const giorni = giorniTra(dataInizioProgetto, oggi);
  return Math.max(1, Math.floor(giorni / 7) + 1);
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

export type GruppoStato = { stato: StatoAttivita; attivita: AttivitaClienteRow[] };

// Ordine deliberatamente diverso da STATI_LEGENDA (todo/wip/done/blocked) usato nel Gantt: qui
// l'obiettivo è la vista operativa "cosa guardare per primo" — attivo e bloccato prima, fatto
// per ultimo. Gruppi vuoti omessi (niente sezioni vuote in UI, coerente con lo screenshot ClickUp
// preso a riferimento).
const ORDINE_STATI_LISTA: StatoAttivita[] = ["wip", "blocked", "todo", "done"];

/** Raggruppa le attività per stato di avanzamento (vista lista, alternativa al Gantt per fase). */
export function raggruppaPerStato(attivita: AttivitaClienteRow[]): GruppoStato[] {
  const ordinate = [...attivita].sort((a, b) => a.ordine - b.ordine);
  return ORDINE_STATI_LISTA.map((stato) => ({ stato, attivita: ordinate.filter((a) => a.stato === stato) })).filter(
    (g) => g.attivita.length > 0
  );
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

/**
 * Attività non "done" la cui scadenza è già passata — segnale "lavori in ritardo" per la dashboard
 * admin. Include anche le "blocked" scadute: un blocco resta un problema da segnalare, non
 * un'eccezione che sospende il giudizio. Confronto stretto (`<`): la scadenza di oggi stesso non è
 * ancora in ritardo. Ordinate per scadenza crescente (più in ritardo prima).
 */
export function attivitaInRitardo(attivita: AttivitaClienteRow[], oggi: string = oggiIso()): AttivitaClienteRow[] {
  return attivita
    .filter((a) => a.stato !== "done" && a.dataFine < oggi)
    .sort((a, b) => (a.dataFine < b.dataFine ? -1 : a.dataFine > b.dataFine ? 1 : 0));
}

/** Raggruppa le righe di roadmap multi-cliente (come le restituisce getAttivitaCliente()) per clienteId. */
export function raggruppaAttivitaPerCliente(attivita: AttivitaClienteRow[]): Map<string, AttivitaClienteRow[]> {
  const mappa = new Map<string, AttivitaClienteRow[]>();
  for (const a of attivita) {
    const lista = mappa.get(a.clienteId) ?? [];
    lista.push(a);
    mappa.set(a.clienteId, lista);
  }
  return mappa;
}

/**
 * Una fase è "completata" quando TUTTE le sue attività sono "done" — una fase senza attività non
 * è mai completata (non ha senso raggiungere una tappa vuota). Usata da POST /api/attivita/stato
 * per rilevare la transizione "non completa -> completa" (confrontando lo stesso filtro fase/fase
 * prima e dopo l'aggiornamento) e da lì scrivere una riga in FasiCompletate — vedi FaseCompletataRow.
 */
export function faseCompletata(attivitaFase: AttivitaClienteRow[]): boolean {
  return attivitaFase.length > 0 && attivitaFase.every((a) => a.stato === "done");
}

// Finestra di "recente" per il banner di fase completata (team in AttivitaTab, cliente in
// KpiSection) — oltre questa soglia la tappa resta comunque nel Gantt (barra piena), semplicemente
// smette di comparire come notifica. 14 giorni: abbastanza da intercettare anche chi non apre la
// dashboard tutti i giorni, abbastanza poco da restare "una notizia fresca" e non un avviso stantio.
const FINESTRA_FASE_COMPLETATA_GIORNI = 14;

/**
 * Fasi completate di recente per un cliente, più recenti prima — sorgente unica per il banner
 * "🎉 Fase completata" mostrato sia al team (AttivitaTab) sia al cliente (KpiSection, versione
 * minimale solo fase+data). Filtra sia per cliente sia per finestra temporale: senza il secondo
 * filtro il banner non sparirebbe mai, restando un falso "appena successo" per sempre.
 */
export function fasiCompletateRecenti(
  fasi: FaseCompletataRow[],
  clienteId: string,
  oggi: string = oggiIso()
): FaseCompletataRow[] {
  return fasi
    .filter((f) => f.clienteId === clienteId && giorniTra(f.completataIl, oggi) <= FINESTRA_FASE_COMPLETATA_GIORNI)
    .sort((a, b) => (a.completataIl < b.completataIl ? 1 : a.completataIl > b.completataIl ? -1 : 0));
}
