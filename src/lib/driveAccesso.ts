import { google } from "googleapis";
import { getGoogleOAuth2Client } from "@/lib/googleAuth";
import { idCartellaDaUrl } from "@/lib/driveNomi";
import type { Cliente, Consulente } from "@/types/kpi";

/**
 * Accesso automatico del consulente assegnato alla cartella Drive del cliente (richiesta utente
 * 09/09/2026): finora un ammin doveva condividere a mano ogni cartella col consulente giusto, un
 * passo facile da dimenticare (soprattutto in riassegnazione). Dominio diverso sia da drive.ts
 * (hand-off commerciale dei prospect nello shared drive del team) sia da appuntamentiFile.ts
 * (get-or-create di UN file dentro la cartella) — qui si tocca solo la lista permessi della
 * cartella stessa, mai il suo contenuto.
 *
 * Deliberatamente NON revoca l'accesso di un consulente precedente quando il cliente viene
 * riassegnato: l'utente ha chiesto di "dare accesso", non di toglierlo — revocare l'accesso di
 * qualcuno è un'azione più delicata da introdurre solo su richiesta esplicita.
 */

let driveCache: ReturnType<typeof google.drive> | null = null;

function getDrive() {
  if (!driveCache) driveCache = google.drive({ version: "v3", auth: getGoogleOAuth2Client() });
  return driveCache;
}

export type EsitoCondivisione = "concesso" | "già presente" | "saltato";

/**
 * Decide SE tentare la condivisione per un cliente — pura, nessuna chiamata di rete, così la
 * logica "quali clienti qualificano" resta testabile senza mock di googleapis (stesso spirito di
 * driveNomi.ts rispetto a drive.ts). Richiede sia una cartella collegata sia un'email nota per il
 * consulente assegnato (colonna Consulenti.email, la stessa già usata per l'invio Gmail — vedi
 * gmail.ts): un consulente senza email lì non può comunque ricevere un invito Drive.
 */
export function clienteDaCondividere(
  cliente: { driveFolderUrl: string; consulenteId: string },
  emailPerConsulente: Map<string, string>
): { emailConsulente: string } | null {
  if (!cliente.driveFolderUrl.trim()) return null;
  const email = emailPerConsulente.get(cliente.consulenteId)?.trim();
  if (!email) return null;
  return { emailConsulente: email };
}

/**
 * Concede l'accesso come collaboratore (ruolo Drive "writer") sulla cartella cliente all'email
 * del consulente — idempotente: se l'email ha già un permesso "writer" o "owner" su quella
 * cartella, non lo riscrive né rimanda una seconda notifica. `sendNotificationEmail: true` per
 * decisione esplicita dell'utente — il consulente deve accorgersi di aver ricevuto l'accesso.
 *
 * Best-effort per il chiamante: un errore qui (tipicamente la cartella non condivisa in scrittura
 * con l'account del team — stesso caso limite già documentato in appuntamentiFile.ts) non deve
 * mai far fallire l'operazione principale (creazione/modifica cliente) che la invoca.
 */
export async function condividiCartellaConConsulente(driveFolderUrl: string, emailConsulente: string): Promise<EsitoCondivisione> {
  const cartellaId = idCartellaDaUrl(driveFolderUrl);
  if (!cartellaId || !emailConsulente.trim()) return "saltato";

  const drive = getDrive();
  const esistenti = await drive.permissions.list({
    fileId: cartellaId,
    fields: "permissions(emailAddress,role)",
    supportsAllDrives: true,
  });
  const emailNormalizzata = emailConsulente.trim().toLowerCase();
  const giaPresente = esistenti.data.permissions?.some(
    (p) => p.emailAddress?.toLowerCase() === emailNormalizzata && (p.role === "writer" || p.role === "owner")
  );
  if (giaPresente) return "già presente";

  await drive.permissions.create({
    fileId: cartellaId,
    supportsAllDrives: true,
    sendNotificationEmail: true,
    requestBody: { type: "user", role: "writer", emailAddress: emailConsulente.trim() },
  });
  return "concesso";
}

export type RigaEsitoCondivisione = { clienteId: string; nome: string; esito: EsitoCondivisione | "errore"; dettaglio?: string };

/**
 * Backfill una tantum su tutti i clienti esistenti (a differenza dell'hook automatico in
 * /api/clienti, che copre solo creazioni/modifiche da qui in avanti) — vedi
 * /api/admin/condividi-cartelle-clienti. Un fallimento su un cliente non ferma gli altri: ogni
 * riga del report è indipendente, stesso spirito di migraAssegnatariEsistenti in sheets.ts.
 */
export async function condividiCartelleClientiEsistenti(
  clienti: Pick<Cliente, "clienteId" | "nome" | "driveFolderUrl" | "consulenteId">[],
  consulenti: Pick<Consulente, "consulenteId" | "email">[]
): Promise<RigaEsitoCondivisione[]> {
  const emailPerConsulente = new Map(consulenti.map((c) => [c.consulenteId, c.email]));
  const risultati: RigaEsitoCondivisione[] = [];

  for (const cliente of clienti) {
    const decisione = clienteDaCondividere(cliente, emailPerConsulente);
    if (!cliente.driveFolderUrl.trim()) continue; // nessuna cartella collegata: nulla da riportare
    if (!decisione) {
      risultati.push({ clienteId: cliente.clienteId, nome: cliente.nome, esito: "saltato", dettaglio: "consulente senza email nota" });
      continue;
    }
    try {
      const esito = await condividiCartellaConConsulente(cliente.driveFolderUrl, decisione.emailConsulente);
      risultati.push({ clienteId: cliente.clienteId, nome: cliente.nome, esito });
    } catch (err) {
      risultati.push({
        clienteId: cliente.clienteId,
        nome: cliente.nome,
        esito: "errore",
        dettaglio: err instanceof Error ? err.message : "errore sconosciuto",
      });
    }
  }

  return risultati;
}
