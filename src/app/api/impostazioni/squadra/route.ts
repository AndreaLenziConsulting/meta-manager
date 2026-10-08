import { NextRequest, NextResponse } from "next/server";
import { generaIdDaNome } from "@/lib/accessCode";
import { passwordGiaUsata } from "@/lib/accesso";
import {
  aggiornaMembroSquadra,
  creaMembroSquadra,
  eliminaMembroSquadra,
  getClienti,
  getCommerciali,
  getConsulenti,
  getCredenzialiAccesso,
  getProspect,
} from "@/lib/archivio";
import { squadraCambiata, verifyTeamPassword } from "@/lib/auth";
import { erroreAnagraficaPersona, errorePasswordNuova } from "@/lib/impostazioni";
import { creaImpronta } from "@/lib/password";
import { erroreRisposta, messaggioDi, rifiutoSeNonAdmin } from "@/lib/soloAdmin";
import type { RuoloSquadra } from "@/types/kpi";

export const runtime = "nodejs";

/**
 * Consulenti e commerciali: chi sono, se possono entrare, con quale password. Solo amministratore.
 *
 * La password arriva qui in chiaro una volta sola, quando viene impostata: nell'archivio finisce la
 * sua impronta (src/lib/password.ts) e da lì in poi non la può rileggere nessuno, nemmeno
 * l'amministratore. Per questo nessuna risposta di questo indirizzo contiene password.
 */

function ruoloDa(valore: unknown): RuoloSquadra | null {
  return valore === "consulente" || valore === "commerciale" ? valore : null;
}

async function personeDelRuolo(ruolo: RuoloSquadra): Promise<{ id: string; nome: string }[]> {
  return ruolo === "consulente"
    ? (await getConsulenti()).map((c) => ({ id: c.consulenteId, nome: c.nome }))
    : (await getCommerciali()).map((c) => ({ id: c.commercialeId, nome: c.nome }));
}

/** Due consulenti con lo stesso nome non si distinguerebbero fra gli assegnatari delle attività. */
function nomeGiaPreso(persone: { id: string; nome: string }[], nome: string, tranneId?: string): boolean {
  return persone.some((p) => p.id !== tranneId && p.nome.trim().toLowerCase() === nome.toLowerCase());
}

/** Una password vale per una persona sola: è l'unica cosa che l'app chiede per entrare. */
async function errorePasswordNonLibera(password: string, tranne?: { ruolo: RuoloSquadra; id: string }): Promise<string | null> {
  if (verifyTeamPassword(password)) return "Questa è la password dell'amministratore: scegline un'altra";
  if (await passwordGiaUsata(password, await getCredenzialiAccesso(), tranne)) return "Questa password è già di un'altra persona della squadra: scegline un'altra";
  return null;
}

type BodyPost = { ruolo?: string; nome?: string; email?: string; password?: string };

export async function POST(req: NextRequest) {
  const rifiuto = await rifiutoSeNonAdmin("aggiungere persone alla squadra");
  if (rifiuto) return rifiuto;

  const body = (await req.json().catch(() => ({}))) as BodyPost;
  const ruolo = ruoloDa(body.ruolo);
  if (!ruolo) return erroreRisposta("Ruolo non valido", 400);
  const nome = body.nome?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";

  const errore = erroreAnagraficaPersona({ nome, email }) ?? errorePasswordNuova(password);
  if (errore) return erroreRisposta(errore, 400);

  const persone = await personeDelRuolo(ruolo);
  if (nomeGiaPreso(persone, nome)) return erroreRisposta(`Esiste già un ${ruolo} che si chiama "${nome}"`, 409);
  const nonLibera = await errorePasswordNonLibera(password);
  if (nonLibera) return erroreRisposta(nonLibera, 409);

  const id = generaIdDaNome(nome, new Set(persone.map((p) => p.id)), ruolo);
  try {
    await creaMembroSquadra({ ruolo, id, nome, email, password: await creaImpronta(password) });
  } catch (err) {
    return erroreRisposta(messaggioDi(err, "Errore nella creazione"), 502);
  }
  squadraCambiata();
  return NextResponse.json({ id }, { status: 201 });
}

type BodyPatch = { ruolo?: string; id?: string; nome?: string; email?: string; attivo?: boolean; password?: string };

export async function PATCH(req: NextRequest) {
  const rifiuto = await rifiutoSeNonAdmin("modificare la squadra");
  if (rifiuto) return rifiuto;

  const body = (await req.json().catch(() => ({}))) as BodyPatch;
  const ruolo = ruoloDa(body.ruolo);
  const id = body.id?.trim();
  if (!ruolo || !id) return erroreRisposta("Persona non indicata", 400);
  const nome = body.nome?.trim();
  const email = body.email?.trim();
  const attivo = typeof body.attivo === "boolean" ? body.attivo : undefined;
  const password = body.password;

  const errore = erroreAnagraficaPersona({ nome, email }) ?? (password !== undefined ? errorePasswordNuova(password) : null);
  if (errore) return erroreRisposta(errore, 400);

  const persone = await personeDelRuolo(ruolo);
  if (!persone.some((p) => p.id === id)) return erroreRisposta("Persona non trovata", 404);
  if (nome !== undefined && nomeGiaPreso(persone, nome, id)) return erroreRisposta(`Esiste già un ${ruolo} che si chiama "${nome}"`, 409);
  if (password !== undefined) {
    const nonLibera = await errorePasswordNonLibera(password, { ruolo, id });
    if (nonLibera) return erroreRisposta(nonLibera, 409);
  }

  try {
    await aggiornaMembroSquadra({ ruolo, id, nome, email, attivo, password: password === undefined ? undefined : await creaImpronta(password) });
  } catch (err) {
    return erroreRisposta(messaggioDi(err, "Errore nel salvataggio"), 502);
  }
  squadraCambiata();
  return NextResponse.json({ ok: true });
}

/**
 * Elimina una persona solo se non ha nulla di assegnato: clienti (e prospect per cui è il consulente
 * proposto) per un consulente, prospect per un commerciale. Altrimenti quei clienti resterebbero
 * intestati a qualcuno che non esiste più: prima vanno passati a un altro, oppure la persona si
 * disattiva e basta.
 */
export async function DELETE(req: NextRequest) {
  const rifiuto = await rifiutoSeNonAdmin("eliminare persone dalla squadra");
  if (rifiuto) return rifiuto;

  const ruolo = ruoloDa(req.nextUrl.searchParams.get("ruolo"));
  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!ruolo || !id) return erroreRisposta("Persona non indicata", 400);

  if (ruolo === "consulente") {
    const [clienti, prospect] = await Promise.all([getClienti(), getProspect()]);
    const suoi = clienti.filter((c) => c.consulenteId === id);
    if (suoi.length > 0) {
      return erroreRisposta(`Ha ${suoi.length === 1 ? "un cliente assegnato" : `${suoi.length} clienti assegnati`} (${elenco(suoi.map((c) => c.nome))}): assegnali a un altro consulente, oppure disattivalo.`, 409);
    }
    const proposti = prospect.filter((p) => p.consulenteSuggeritoId === id);
    if (proposti.length > 0) {
      return erroreRisposta(`È il consulente proposto per ${proposti.length === 1 ? "un prospect" : `${proposti.length} prospect`} (${elenco(proposti.map((p) => p.ragioneSociale))}): cambia la proposta, oppure disattivalo.`, 409);
    }
  } else {
    const suoi = (await getProspect()).filter((p) => p.commercialeId === id);
    if (suoi.length > 0) {
      return erroreRisposta(`Ha ${suoi.length === 1 ? "un prospect" : `${suoi.length} prospect`} (${elenco(suoi.map((p) => p.ragioneSociale))}): finché ci sono si può solo disattivare.`, 409);
    }
  }

  try {
    await eliminaMembroSquadra(ruolo, id);
  } catch (err) {
    return erroreRisposta(messaggioDi(err, "Errore nell'eliminazione"), 404);
  }
  squadraCambiata();
  return NextResponse.json({ ok: true });
}

/** I primi tre nomi, poi "e altri N": abbastanza per riconoscerli senza riempire il messaggio. */
function elenco(nomi: string[]): string {
  const primi = nomi.slice(0, 3).join(", ");
  return nomi.length > 3 ? `${primi} e altri ${nomi.length - 3}` : primi;
}
