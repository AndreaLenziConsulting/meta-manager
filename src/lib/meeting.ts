import { createHash } from "node:crypto";
import type { AttivitaClienteRow, StatoAttivita } from "@/types/kpi";
import type { ActionItem, MeetingCampiPubblici, MeetingDataLoose } from "@/types/meeting";
import { aggiungiGiorni } from "@/lib/roadmap";
import { formatDataBreve } from "@/lib/format";
import { ultimoGiornoDelMese } from "@/lib/kpi";

/**
 * Parsing di righe di testo libero in ActionItem — vive qui (non in estrazione.ts, dove queste due
 * funzioni sono nate) perché AttivitaLista.tsx (client component) importa già @/lib/meeting per
 * estraiMeetingIdDaTaskId: se questa logica restasse in estrazione.ts, che importa `groq-sdk`,
 * trascinerebbe quella dipendenza server-only nel bundle browser. estrazione.ts le re-esporta da
 * qui per restare compatibile con chi le importava da lì.
 *
 * Riconosce opportunisticamente il pattern "Nome: testo" (o "-"/"—" al posto di ":") riga per
 * riga — se non combacia, l'intera riga diventa `text` senza `assignee` (poi "Da assegnare" in
 * generaAttivitaDaMeeting sotto). Usata sia per taskSettimana sia, ora, per taskMese: quest'ultimo
 * però è tipicamente un obiettivo generale non per-persona (vedi commento su generaAttivitaDaMeeting),
 * quindi ci si aspetta "Da assegnare" più spesso che con taskSettimana.
 *
 * Il gruppo "nome" esclude le cifre e resta corto (max 35 caratteri): senza questi due vincoli, un
 * trattino/due-punti dentro il TESTO stesso — un range di date ("dal 15-17 settembre"), un orario
 * ("alle 15:30"), un importo — viene scambiato per il separatore "Nome: testo" e taglia la frase a
 * metà (bug reale osservato in produzione: "Aumentare il budget... a partire da metà settembre
 * (15-17 settembre)." è finito diviso in assignee="...(15" e text="17 settembre)."). Un nome vero
 * non contiene mai cifre ed è quasi sempre corto (anche una lista tipo "Orlando, Alessandro e
 * Andrea" sta sotto 35 caratteri) — se il testo prima del separatore non rispetta questo, il match
 * fallisce e l'intera riga diventa `text` senza `assignee`, esattamente come un pattern non
 * riconosciuto: meglio un falso "Da assegnare" di troppo che un testo troncato a metà.
 */
export function toActionItems(v: unknown): ActionItem[] {
  const items = Array.isArray(v) ? v : typeof v === "string" ? v.split("\n") : [];
  return items
    .map((item) => {
      if (typeof item === "string") {
        const m = item.trim().match(/^([^:\-—0-9]{1,35})[:\-—]\s*(.+)$/);
        if (m) return { text: m[2].trim(), assignee: m[1].trim() };
        return { text: item.trim() };
      }
      if (item && typeof item === "object") {
        const o = item as { text?: unknown; assignee?: unknown };
        return {
          text: typeof o.text === "string" ? o.text : "",
          assignee: typeof o.assignee === "string" && o.assignee ? o.assignee : undefined,
        };
      }
      return { text: "" };
    })
    .filter((x) => x.text);
}

/** Righe non vuote di un blocco di testo libero (taskSettimana/taskMese) -> ActionItem[], via toActionItems sopra. */
export function actionItemsFromTaskLines(testoLibero: string): ActionItem[] {
  const righe = testoLibero
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean);
  return toActionItems(righe);
}

/**
 * "DD/MM/YYYY" (anche senza zero-padding, l'LLM a monte non è garantito) -> "YYYY-MM-DD".
 * Non lancia mai: input invalido/vuoto -> null, decide il chiamante cosa fare (es. 422).
 */
export function dataItalianaAIso(dataItaliana: string | undefined): string | null {
  if (!dataItaliana) return null;
  const m = dataItaliana.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const giorno = Number(m[1]);
  const mese = Number(m[2]);
  const anno = Number(m[3]);
  if (mese < 1 || mese > 12 || giorno < 1 || giorno > 31) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = `${anno}-${pad(mese)}-${pad(giorno)}`;
  // Verifica che la data esista davvero (es. rifiuta 31/02/2026): un round-trip attraverso Date
  // normalizza gli overflow, quindi confrontare il risultato con l'input è la validazione più semplice.
  const d = new Date(`${iso}T00:00:00Z`);
  if (d.getUTCFullYear() !== anno || d.getUTCMonth() + 1 !== mese || d.getUTCDate() !== giorno) return null;
  return iso;
}

/** Scadenza di default per i task generati da un meeting: la data del meeting + 7 giorni. */
export function scadenzaTask(dataMeetingIso: string): string {
  return aggiungiGiorni(dataMeetingIso, 7);
}

/** Scadenza per i task "del mese" generati da un meeting: l'ultimo giorno di calendario del mese
 * della data del meeting — non +N giorni fissi come scadenzaTask sopra, un "task del mese" scade
 * quando finisce quel mese, non una settimana dopo il meeting. Riusa ultimoGiornoDelMese di kpi.ts. */
export function scadenzaFineMese(dataMeetingIso: string): string {
  return ultimoGiornoDelMese(dataMeetingIso.slice(0, 7));
}

/** Id deterministico: stesso cliente + stesso link -> stesso meetingId (rende il salvataggio un upsert naturale). */
export function hashMeetingId(clienteId: string, rawUrl: string): string {
  const hash = createHash("sha1").update(rawUrl).digest("hex").slice(0, 8);
  return `${clienteId}::${hash}`;
}

/**
 * Una riga Attività per ogni action item del meeting, prodottoId "meeting" (distinto dai prodotti
 * reali) così da finire in corsie dedicate nel Gantt esistente, senza toccarne la UI. `ordine` è
 * derivato dalla data del meeting: sempre più grande di qualunque `ordine` di template prodotto
 * (piccoli interi), così le corsie meeting appaiono in coda, in ordine cronologico tra loro.
 *
 * `taskMese` (opzionale) genera righe aggiuntive nella STESSA corsia/fase, con scadenza fine mese
 * invece di +7 giorni (scadenzaFineMese sopra) e taskId prefissato "tm-" invece di "m-" (mai lo
 * stesso prefisso: estraiMeetingIdDaTaskId sotto deve poterli distinguere). A differenza degli
 * action item di taskSettimana — quasi sempre assegnati a una persona — le righe di taskMese sono
 * più spesso obiettivi generali ("Mantenere attive le campagne ad agosto") senza un assegnatario
 * naturale: aspettarsi più "Da assegnare" qui che sugli action item veri e propri è normale, non un
 * segno che l'estrazione ha perso un nome (comportamento distinto e deliberato, non lo stesso "bug
 * dati mancanti" per cui taskMese/programmaTrimestre restano tuttora esclusi da `actionItems`).
 */
export function generaAttivitaDaMeeting(
  clienteId: string,
  meetingId: string,
  dataMeetingIso: string,
  titolo: string,
  actionItems: ActionItem[],
  taskMese?: string
): AttivitaClienteRow[] {
  const fase = `Meeting: ${titolo} (${formatDataBreve(dataMeetingIso)})`;
  const ordineBase = Number(dataMeetingIso.replaceAll("-", "")) * 100;

  const righeSettimana = actionItems.map((item, indice) => {
    const taskId = `m-${meetingId}-${indice}`;
    return {
      attivitaId: `${clienteId}::${taskId}`,
      clienteId,
      prodottoId: "meeting",
      taskId,
      blocco: "meeting",
      fase,
      descrizione: item.text,
      responsabile: item.assignee || "Da assegnare",
      tipo: "",
      dataInizio: dataMeetingIso,
      dataFine: scadenzaTask(dataMeetingIso),
      stato: "todo" as StatoAttivita,
      notaTeam: "",
      ordine: ordineBase + indice,
    };
  });

  const itemsMese = taskMese ? actionItemsFromTaskLines(taskMese) : [];
  const righeMese = itemsMese.map((item, indice) => {
    const taskId = `tm-${meetingId}-${indice}`;
    return {
      attivitaId: `${clienteId}::${taskId}`,
      clienteId,
      prodottoId: "meeting",
      taskId,
      blocco: "meeting",
      fase,
      descrizione: item.text,
      responsabile: item.assignee || "Da assegnare",
      tipo: "",
      dataInizio: dataMeetingIso,
      dataFine: scadenzaFineMese(dataMeetingIso),
      stato: "todo" as StatoAttivita,
      notaTeam: "",
      // Dopo i task settimanali nella stessa corsia (mai sovrapposti: righeSettimana.length come offset).
      ordine: ordineBase + righeSettimana.length + indice,
    };
  });

  return [...righeSettimana, ...righeMese];
}

/**
 * Inverso parziale di `generaAttivitaDaMeeting`: da un taskId `m-${meetingId}-${indice}` (task
 * settimana) o `tm-${meetingId}-${indice}` (task mese) risale al meetingId originale (per il link
 * "vai al meeting" nella vista Attività). `meetingId` stesso è `${clienteId}::${hash}` (mai un
 * trattino finale seguito solo da cifre), quindi l'ultimo trattino nella stringa separa sempre
 * l'indice, indipendentemente da quante cifre ha. Null se il taskId non è nel formato atteso
 * (attività da roadmap prodotto, non da meeting).
 */
export function estraiMeetingIdDaTaskId(taskId: string): string | null {
  const prefisso = taskId.startsWith("tm-") ? "tm-" : taskId.startsWith("m-") ? "m-" : null;
  if (!prefisso) return null;
  const senzaPrefisso = taskId.slice(prefisso.length);
  const idx = senzaPrefisso.lastIndexOf("-");
  if (idx === -1) return null;
  return senzaPrefisso.slice(0, idx);
}

/** Whitelist POSITIVA per la vista cliente pubblico: elenca solo ciò che entra, mai ciò che esclude. */
export function campiVisibiliCliente(meetingId: string, data: string, meeting: MeetingDataLoose): MeetingCampiPubblici {
  return {
    meetingId,
    titolo: meeting.title ?? "",
    data,
    durata: meeting.duration,
    partecipanti: Array.isArray(meeting.participants) ? meeting.participants : [],
    riassunto: meeting.summary ?? "",
    azioni: (Array.isArray(meeting.actionItems) ? meeting.actionItems : []).map((a) => ({
      testo: a?.text ?? "",
      assegnatario: a?.assignee,
    })),
  };
}
