import { NextRequest, NextResponse } from "next/server";
import { generaAccessCodeNuovo } from "@/lib/accessCode";
import { cambiaAccessCodeCliente, getClienti } from "@/lib/archivio";
import { erroreRisposta, messaggioDi, rifiutoSeNonAdmin } from "@/lib/soloAdmin";

export const runtime = "nodejs";

/**
 * Rigenera il link pubblico di un cliente (09/10/2026): gli dà un codice nuovo, e il link di prima
 * smette di funzionare nello stesso momento — /report/[code] e gli indirizzi che accettano `code`
 * cercano il cliente per codice a ogni richiesta, senza memoria intermedia. Serve quando un link è
 * finito a chi non doveva averlo, o quando il codice è debole (i primi clienti ne avevano di scritti
 * a mano). Prima un codice si poteva cambiare solo dalla tabella del database.
 *
 * Solo amministratore. Il codice lo sceglie sempre il server, a caso: chi chiama non può proporne uno.
 */
export async function POST(req: NextRequest) {
  const rifiuto = await rifiutoSeNonAdmin("rigenerare il link pubblico di un cliente");
  if (rifiuto) return rifiuto;

  const body = (await req.json().catch(() => ({}))) as { clienteId?: string };
  const clienteId = body.clienteId?.trim();
  if (!clienteId) return erroreRisposta("clienteId mancante", 400);

  const clienti = await getClienti();
  if (!clienti.some((c) => c.clienteId === clienteId)) return erroreRisposta("Cliente non trovato", 404);

  const accessCode = generaAccessCodeNuovo(new Set(clienti.map((c) => c.accessCode)));
  try {
    await cambiaAccessCodeCliente(clienteId, accessCode);
  } catch (err) {
    return erroreRisposta(messaggioDi(err, "Errore nel cambio del link"), 502);
  }
  return NextResponse.json({ accessCode });
}
