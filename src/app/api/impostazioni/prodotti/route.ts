import { NextRequest, NextResponse } from "next/server";
import { generaIdDaNome } from "@/lib/accessCode";
import { aggiornaProdotto, creaProdotto, eliminaProdotto, getAttivitaCliente, getClienti, getProdotti } from "@/lib/archivio";
import { erroreProdotto } from "@/lib/impostazioni";
import { erroreRisposta, messaggioDi, rifiutoSeNonAdmin } from "@/lib/soloAdmin";

export const runtime = "nodejs";

/** I prodotti che si possono assegnare a un cliente (ognuno col suo modello di attività, vedi ../modello). Solo amministratore. */

function nomeGiaPreso(prodotti: { prodottoId: string; nome: string }[], nome: string, tranneId?: string): boolean {
  return prodotti.some((p) => p.prodottoId !== tranneId && p.nome.trim().toLowerCase() === nome.toLowerCase());
}

type BodyPost = { nome?: string; durataSettimane?: number; note?: string };

export async function POST(req: NextRequest) {
  const rifiuto = await rifiutoSeNonAdmin("creare prodotti");
  if (rifiuto) return rifiuto;

  const body = (await req.json().catch(() => ({}))) as BodyPost;
  const nome = body.nome?.trim() ?? "";
  const durataSettimane = body.durataSettimane;
  if (durataSettimane === undefined) return erroreRisposta("La durata in settimane è obbligatoria", 400);
  const errore = erroreProdotto({ nome, durataSettimane });
  if (errore) return erroreRisposta(errore, 400);

  const prodotti = await getProdotti();
  if (nomeGiaPreso(prodotti, nome)) return erroreRisposta(`Esiste già un prodotto che si chiama "${nome}"`, 409);

  const prodottoId = generaIdDaNome(nome, new Set(prodotti.map((p) => p.prodottoId)), "prodotto");
  try {
    await creaProdotto({ prodottoId, nome, durataSettimane, note: body.note?.trim() ?? "" });
  } catch (err) {
    return erroreRisposta(messaggioDi(err, "Errore nella creazione"), 502);
  }
  return NextResponse.json({ prodottoId }, { status: 201 });
}

type BodyPatch = { prodottoId?: string; nome?: string; attivo?: boolean; durataSettimane?: number; note?: string };

export async function PATCH(req: NextRequest) {
  const rifiuto = await rifiutoSeNonAdmin("modificare i prodotti");
  if (rifiuto) return rifiuto;

  const body = (await req.json().catch(() => ({}))) as BodyPatch;
  const prodottoId = body.prodottoId?.trim();
  if (!prodottoId) return erroreRisposta("Prodotto non indicato", 400);
  const nome = body.nome?.trim();
  const errore = erroreProdotto({ nome, durataSettimane: body.durataSettimane });
  if (errore) return erroreRisposta(errore, 400);

  const prodotti = await getProdotti();
  if (!prodotti.some((p) => p.prodottoId === prodottoId)) return erroreRisposta("Prodotto non trovato", 404);
  if (nome !== undefined && nomeGiaPreso(prodotti, nome, prodottoId)) return erroreRisposta(`Esiste già un prodotto che si chiama "${nome}"`, 409);

  try {
    await aggiornaProdotto({
      prodottoId,
      nome,
      attivo: typeof body.attivo === "boolean" ? body.attivo : undefined,
      durataSettimane: body.durataSettimane,
      note: body.note?.trim(),
    });
  } catch (err) {
    return erroreRisposta(messaggioDi(err, "Errore nel salvataggio"), 502);
  }
  return NextResponse.json({ ok: true });
}

/**
 * Elimina un prodotto (e il suo modello) solo se nessun cliente lo usa e nessuna attività è nata da
 * lui: altrimenti quei clienti resterebbero con un prodotto che non esiste più. In quel caso si
 * disattiva: resta ai clienti che ce l'hanno e non si può più scegliere per i nuovi.
 */
export async function DELETE(req: NextRequest) {
  const rifiuto = await rifiutoSeNonAdmin("eliminare prodotti");
  if (rifiuto) return rifiuto;

  const prodottoId = req.nextUrl.searchParams.get("prodottoId")?.trim();
  if (!prodottoId) return erroreRisposta("Prodotto non indicato", 400);

  const [clienti, attivita] = await Promise.all([getClienti(), getAttivitaCliente()]);
  const conProdotto = new Set(clienti.filter((c) => c.prodottoId === prodottoId).map((c) => c.clienteId));
  for (const a of attivita) if (a.prodottoId === prodottoId) conProdotto.add(a.clienteId);
  if (conProdotto.size > 0) {
    return erroreRisposta(
      `${conProdotto.size === 1 ? "Un cliente usa" : `${conProdotto.size} clienti usano`} questo prodotto o hanno attività nate dal suo modello: si può solo disattivare.`,
      409
    );
  }

  try {
    await eliminaProdotto(prodottoId);
  } catch (err) {
    return erroreRisposta(messaggioDi(err, "Errore nell'eliminazione"), 404);
  }
  return NextResponse.json({ ok: true });
}
