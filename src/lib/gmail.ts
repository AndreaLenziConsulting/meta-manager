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

/** Costruisce le opzioni per MailComposer — pura, testabile senza I/O. */
export function costruisciOpzioniEmail(input: InvioEmailMeetingInput) {
  return {
    from: { name: input.consulenteNome, address: input.consulenteEmail },
    to: input.clienteEmail,
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
 */
export async function inviaEmailMeeting(input: InvioEmailMeetingInput): Promise<void> {
  const raw = await new MailComposer(costruisciOpzioniEmail(input)).compile().build();
  const gmail = getGmailClient(input.consulenteEmail);
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: raw.toString("base64url") },
  });
}
