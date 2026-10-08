import { NextRequest, NextResponse } from "next/server";
import { assegnaProdottoACliente, getAttivitaCliente, getClienti, getProdotti, getTemplateAttivita } from "@/lib/archivio";
import { erroreAssegnazioneProdotto, riepilogoRoadmap } from "@/lib/assegnaProdotto";
import { generaAttivitaPerCliente, oggiIso } from "@/lib/roadmap";
import { erroreRisposta, messaggioDi, rifiutoSeNonAdmin } from "@/lib/soloAdmin";

export const runtime = "nodejs";

/**
 * Assegnare un prodotto a un cliente che esiste già (08/10/2026) — scheda "Prodotto" di Modifica
 * cliente. Solo amministratore, come la scelta del prodotto alla creazione e "Genera roadmap".
 * Le regole stanno in src/lib/assegnaProdotto.ts.
 */

/** I prodotti fra cui scegliere, ognuno con quante attività ha il suo modello. */
export async function GET() {
  const rifiuto = await rifiutoSeNonAdmin("assegnare un prodotto");
  if (rifiuto) return rifiuto;

  const [prodotti, modello] = await Promise.all([getProdotti(), getTemplateAttivita()]);
  return NextResponse.json({
    prodotti: prodotti.map((p) => ({
      prodottoId: p.prodottoId,
      nome: p.nome,
      attivo: p.attivo,
      attivitaNelModello: modello.filter((t) => t.prodottoId === p.prodottoId).length,
    })),
  });
}

type Body = { clienteId?: string; prodottoId?: string; dataInizioProgetto?: string; anteprima?: boolean };

/**
 * Con `anteprima: true` non scrive nulla: dice solo cosa succederebbe (quante attività nascono, in
 * che arco di tempo, quante con la scadenza già passata). Senza, assegna il prodotto e crea le
 * attività, insieme.
 */
export async function POST(req: NextRequest) {
  const rifiuto = await rifiutoSeNonAdmin("assegnare un prodotto");
  if (rifiuto) return rifiuto;

  const body = (await req.json().catch(() => ({}))) as Body;
  const clienteId = body.clienteId?.trim() ?? "";
  const prodottoId = body.prodottoId?.trim() ?? "";
  const dataInizioProgetto = body.dataInizioProgetto?.trim() ?? "";
  if (!clienteId) return erroreRisposta("clienteId mancante", 400);

  const [clienti, prodotti, modello, attivita] = await Promise.all([getClienti(), getProdotti(), getTemplateAttivita(), getAttivitaCliente()]);
  const cliente = clienti.find((c) => c.clienteId === clienteId);
  const errore = erroreAssegnazioneProdotto({ cliente, prodotti, prodottoId, dataInizioProgetto });
  if (errore) return erroreRisposta(errore.errore, errore.stato);

  const righe = generaAttivitaPerCliente(clienteId, prodottoId, dataInizioProgetto, modello);
  if (righe.length === 0) {
    const nome = prodotti.find((p) => p.prodottoId === prodottoId)?.nome ?? prodottoId;
    return erroreRisposta(`Il prodotto ${nome} non ha ancora un modello di attività: si compila da Impostazioni, in "Prodotti e modelli"`, 400);
  }
  const giaDelCliente = new Set(attivita.filter((a) => a.clienteId === clienteId).map((a) => a.attivitaId));
  const riepilogo = riepilogoRoadmap(righe, giaDelCliente, oggiIso());
  if (body.anteprima) return NextResponse.json({ riepilogo });

  try {
    const { attivitaCreate } = await assegnaProdottoACliente({ clienteId, prodottoId, dataInizioProgetto, righe });
    return NextResponse.json({ ok: true, attivitaCreate, riepilogo });
  } catch (err) {
    const messaggio = messaggioDi(err, "Errore nell'assegnazione");
    // Qualcun altro l'ha assegnato fra il controllo qui sopra e la scrittura.
    return erroreRisposta(messaggio, messaggio.includes("ha già un prodotto") ? 409 : 502);
  }
}
