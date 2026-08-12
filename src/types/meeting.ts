/**
 * Contratto DATI PROPRIO di Meta Manager ALC per i meeting estratti da Fast Report — NON un mirror
 * del tipo `MeetingData` di Fast Report (repo separato, il cui template cambierà a breve). Tutti i
 * campi sono opzionali/con default: se Fast Report rinomina o rimuove un campo, il peggio che può
 * succedere è che arrivi vuoto, mai un crash a runtime.
 */
export type ActionItem = {
  text: string;
  assignee?: string;
};

export type MeetingDataLoose = {
  title?: string;
  date?: string; // "DD/MM/YYYY", come prodotto oggi da Fast Report
  duration?: string;
  participants?: string[];
  summary?: string;
  highlights?: string[];
  actionItems?: ActionItem[];
  rawUrl?: string;

  cliente?: string; // testo libero da Fast Report — SEMPRE ignorato: il cliente è già noto dal contesto
  referente?: string;
  dataConsulenza?: string;
  taskSettimana?: string;
  taskMese?: string;
  programmaTrimestre?: string;
  sentiment?: string;
  kpiReali?: string;
  kpiStorico?: string;
  kpiTargetMarketing?: string;
  kpiTargetCommerciali?: string;
};

/** Riga così com'è persistita/letta dalla tab MeetingCliente. */
export type MeetingClienteRow = {
  meetingId: string;
  clienteId: string;
  data: string; // YYYY-MM-DD (data del meeting, non del salvataggio)
  titolo: string;
  sentiment: string;
  aggiornatoIl: string; // ISO datetime dell'ultimo salvataggio
  dati: MeetingDataLoose;
};

/** Sottoinsieme "sicuro" mostrato al cliente pubblico — whitelist POSITIVA, mai una blacklist. */
export type MeetingCampiPubblici = {
  meetingId: string;
  titolo: string;
  data: string;
  durata?: string;
  partecipanti: string[];
  riassunto: string;
  azioni: { testo: string; assegnatario?: string }[];
};
