import { google } from "googleapis";
import MailComposer from "nodemailer/lib/mail-composer";

/**
 * Invio email di follow-up meeting via Gmail API con delega a livello di dominio (Google
 * Workspace): un service account, autorizzato una tantum dall'admin Workspace (vedi README),
 * impersona l'indirizzo del consulente assegnato al cliente e invia "come" quella vera casella —
 * a differenza dell'OAuth2 a refresh-token già usato in sheets.ts (un solo account fisso), qui
 * serve poter "diventare" un indirizzo diverso ad ogni chiamata, da qui `subject` (l'utente da
 * impersonare) invece di un refresh token.
 */
function getGmailClient(consulenteEmail: string) {
  const email = process.env.GMAIL_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GMAIL_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !key) {
    throw new Error("Invio email non configurato (credenziali Gmail mancanti)");
  }
  const auth = new google.auth.JWT({
    email,
    // La chiave PEM va salvata in .env con "\n" letterali (non può contenere newline reali in
    // una singola riga di env var) — va sempre riconvertita in newline veri prima dell'uso.
    key: key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/gmail.send"],
    subject: consulenteEmail,
  });
  return google.gmail({ version: "v1", auth });
}

export type InvioEmailMeetingInput = {
  consulenteNome: string;
  consulenteEmail: string;
  clienteEmail: string;
  oggetto: string;
  corpo: string;
  allegatoPdf: Buffer;
  nomeAllegato: string;
};

// In copia nascosta su OGNI report automatico che passa da qui — richiesta esplicita dell'utente.
// Questa è l'unica funzione di invio email dell'app, riusata as-is sia dal follow-up meeting
// (POST /api/meeting) sia dal report commerciale (POST /api/report-commerciale): un solo punto di
// modifica copre entrambi, nessuna duplicazione. BCC e non CC: un indirizzo interno dell'agenzia
// non deve comparire nell'intestazione vista dal destinatario esterno (cliente o prospect).
const DESTINATARIO_SEMPRE_IN_COPIA = "info@andrealenziconsulting.com";

/** Costruisce le opzioni per MailComposer — pura, testabile senza I/O. */
export function costruisciOpzioniEmail(input: InvioEmailMeetingInput) {
  return {
    from: { name: input.consulenteNome, address: input.consulenteEmail },
    to: input.clienteEmail,
    bcc: DESTINATARIO_SEMPRE_IN_COPIA,
    subject: input.oggetto,
    text: input.corpo,
    attachments: [
      {
        filename: input.nomeAllegato,
        content: input.allegatoPdf,
        contentType: "application/pdf",
      },
    ],
  };
}

/**
 * Invia realmente l'email via Gmail API. Lancia sempre un errore con messaggio azionabile (mai un
 * errore Google grezzo) nei casi previsti — il chiamante (POST /api/meeting) lo cattura e lo
 * mostra così com'è, senza far fallire il salvataggio del meeting (stesso principio non bloccante
 * di appendReportOperativita).
 *
 * `message.keepBcc = true` è indispensabile, non un dettaglio, e va impostato QUI (non come opzione
 * dentro costruisciOpzioniEmail: `MailComposer` non legge affatto `mail.keepBcc`, lo ignora in
 * silenzio — verificato leggendo il suo sorgente. keepBcc esiste solo come proprietà del MimeNode
 * risultante, impostabile solo dopo `.compile()`). Nodemailer per default TOGLIE l'header Bcc dal
 * messaggio grezzo (pensato per SMTP, dove il bcc passa dall'envelope del transport, mai dal
 * messaggio stesso — altrimenti ogni destinatario lo vedrebbe). L'API Gmail però non ha un envelope
 * separato: accetta un messaggio RFC 2822 grezzo già completo e lo invia così com'è, quindi il bcc
 * DEVE stare nell'header o Gmail non saprebbe a chi inoltrarlo — è poi Gmail stesso a toglierlo
 * dalla copia recapitata al destinatario principale, lo stesso comportamento "nascosto" atteso,
 * solo ottenuto in un punto diverso della catena. Verificato dal vivo ispezionando il MIME grezzo
 * prodotto (mai un invio reale): senza questa riga l'header Bcc non compare affatto nel messaggio,
 * e il bcc sarebbe silenziosamente ignorato da Gmail.
 */
export async function inviaEmailMeeting(input: InvioEmailMeetingInput): Promise<void> {
  const message = new MailComposer(costruisciOpzioniEmail(input)).compile();
  message.keepBcc = true;
  const raw = await message.build();
  const gmail = getGmailClient(input.consulenteEmail);
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: raw.toString("base64url") },
  });
}
