import { verificaPassword } from "@/lib/password";
import type { CredenzialeAccesso, RuoloSquadra, Sessione } from "@/types/kpi";

/**
 * L'accesso all'app chiede solo una password, senza nome utente: è la password a dire chi sta
 * entrando. Da qui due regole:
 *   - `chiEntra`: la password digitata si confronta con quella di ogni persona attiva della squadra;
 *   - `passwordGiaUsata`: due persone non possono avere la stessa password, altrimenti entrerebbe
 *     sempre la prima.
 * I confronti passano tutti da verificaPassword (src/lib/password.ts), quindi dalle impronte.
 */

/** La sessione di chi ha quella password, o null. Una persona non attiva non entra. */
export async function chiEntra(password: string, credenziali: CredenzialeAccesso[]): Promise<Sessione | null> {
  const attive = credenziali.filter((c) => c.attivo);
  const esiti = await Promise.all(attive.map((c) => verificaPassword(password, c.password)));
  const trovata = attive[esiti.indexOf(true)];
  if (!trovata) return null;
  return trovata.ruolo === "consulente" ? { ruolo: "consulente", consulenteId: trovata.id } : { ruolo: "commerciale", commercialeId: trovata.id };
}

/**
 * Vero se la password è già di qualcun altro della squadra, attivo o no (una persona disattivata
 * oggi può essere riattivata domani). `tranne` è la persona a cui la si sta impostando.
 */
export async function passwordGiaUsata(password: string, credenziali: CredenzialeAccesso[], tranne?: { ruolo: RuoloSquadra; id: string }): Promise<boolean> {
  const altre = credenziali.filter((c) => !(tranne && c.ruolo === tranne.ruolo && c.id === tranne.id));
  const esiti = await Promise.all(altre.map((c) => verificaPassword(password, c.password)));
  return esiti.includes(true);
}
