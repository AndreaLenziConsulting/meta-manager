import { createHash } from "node:crypto";
import type { AttivitaClienteRow, StatoAttivita } from "@/types/kpi";
import type { ActionItem, MeetingCampiPubblici, MeetingDataLoose } from "@/types/meeting";
import { aggiungiGiorni } from "@/lib/roadmap";
import { formatDataBreve } from "@/lib/format";

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
 */
export function generaAttivitaDaMeeting(
  clienteId: string,
  meetingId: string,
  dataMeetingIso: string,
  titolo: string,
  actionItems: ActionItem[]
): AttivitaClienteRow[] {
  const fase = `Meeting: ${titolo} (${formatDataBreve(dataMeetingIso)})`;
  const dataFine = scadenzaTask(dataMeetingIso);
  const ordineBase = Number(dataMeetingIso.replaceAll("-", "")) * 100;

  return actionItems.map((item, indice) => {
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
      dataFine,
      stato: "todo" as StatoAttivita,
      notaTeam: "",
      ordine: ordineBase + indice,
    };
  });
}

/**
 * Inverso parziale di `generaAttivitaDaMeeting`: da un taskId `m-${meetingId}-${indice}` risale al
 * meetingId originale (per il link "vai al meeting" nella vista Attività). `meetingId` stesso è
 * `${clienteId}::${hash}` (mai un trattino finale seguito solo da cifre), quindi l'ultimo trattino
 * nella stringa separa sempre l'indice, indipendentemente da quante cifre ha. Null se il taskId non
 * è nel formato atteso (attività da roadmap prodotto, non da meeting).
 */
export function estraiMeetingIdDaTaskId(taskId: string): string | null {
  if (!taskId.startsWith("m-")) return null;
  const senzaPrefisso = taskId.slice(2);
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
