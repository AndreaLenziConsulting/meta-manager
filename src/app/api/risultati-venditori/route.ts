import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { getClienti, getRisultatiVenditori, getSedi, getVenditori, salvaRisultatiVenditori } from "@/lib/archivio";
import { puoVedereCliente } from "@/lib/authz";
import { controllaRigheVenditori, granularitaDi, periodoFuturo, periodoValido } from "@/lib/risultatiManuali";
import { erroreRisposta, messaggioDi } from "@/lib/soloAdmin";

export const runtime = "nodejs";

/**
 * I risultati mensili dei venditori di una sede (appuntamenti fissati, vendite, fatturato), inseriti
 * a mano. Stesse regole di /api/risultati-commerciali: li legge e li scrive chi segue il cliente.
 */
async function sedeAccessibile(clienteId: string | undefined, sedeId: string | undefined): Promise<NextResponse | { clienteId: string; sedeId: string }> {
  const sessione = await getSessione();
  if (!sessione) return erroreRisposta("Non autenticato", 401);
  if (!clienteId || !sedeId) return erroreRisposta("Cliente o sede non indicati", 400);
  if (!puoVedereCliente(sessione, clienteId, await getClienti())) return erroreRisposta("Non autorizzato per questo cliente", 403);
  if (!(await getSedi()).some((s) => s.sedeId === sedeId && s.clienteId === clienteId)) return erroreRisposta("Sede non trovata per questo cliente", 404);
  return { clienteId, sedeId };
}

export async function GET(req: NextRequest) {
  const accesso = await sedeAccessibile(req.nextUrl.searchParams.get("clienteId") ?? undefined, req.nextUrl.searchParams.get("sedeId") ?? undefined);
  if (accesso instanceof NextResponse) return accesso;

  const [venditori, risultati] = await Promise.all([getVenditori({ noCache: true }), getRisultatiVenditori({ noCache: true })]);
  return NextResponse.json({
    venditori: venditori.filter((v) => v.sedeId === accesso.sedeId).map((v) => ({ venditoreId: v.venditoreId, nome: v.nome, attivo: v.attivo })),
    righe: risultati
      .filter((r) => r.sedeId === accesso.sedeId)
      .map((r) => ({ mese: r.mese, venditoreId: r.venditoreId, appuntamentiFissati: r.appuntamentiFissati, vendite: r.vendite, fatturato: r.fatturato })),
  });
}

type Body = { clienteId?: string; sedeId?: string; mese?: string; righe?: unknown };

/** Sostituisce i risultati dei venditori della sede per quel mese. Nessuna riga = il mese torna vuoto. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const accesso = await sedeAccessibile(body.clienteId?.trim(), body.sedeId?.trim());
  if (accesso instanceof NextResponse) return accesso;

  const mese = body.mese?.trim() ?? "";
  if (!periodoValido(mese) || granularitaDi(mese) !== "mese") return erroreRisposta("Mese non valido", 400);

  const venditoriSede = new Set((await getVenditori({ noCache: true })).filter((v) => v.sedeId === accesso.sedeId).map((v) => v.venditoreId));
  const controllo = controllaRigheVenditori(body.righe, venditoriSede);
  if (!controllo.ok) return erroreRisposta(controllo.errore, 400);
  if (controllo.righe.length > 0 && periodoFuturo(mese)) return erroreRisposta("Quel mese non è ancora cominciato: non ci sono risultati da inserire", 400);

  try {
    await salvaRisultatiVenditori({ sedeId: accesso.sedeId, mese, righe: controllo.righe });
  } catch (err) {
    return erroreRisposta(messaggioDi(err, "Errore nel salvataggio"), 502);
  }
  return NextResponse.json({ ok: true, righe: controllo.righe.length });
}
