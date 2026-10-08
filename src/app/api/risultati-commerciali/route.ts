import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { getClienti, getRisultatiCommerciali, getSedi, salvaRisultatiCommerciali } from "@/lib/archivio";
import { puoVedereCliente } from "@/lib/authz";
import { controllaRigheCommerciali, erroreSulPeriodo } from "@/lib/risultatiManuali";
import { erroreRisposta, messaggioDi } from "@/lib/soloAdmin";

export const runtime = "nodejs";

/**
 * I risultati commerciali inseriti a mano per una sede (richieste, appuntamenti, vendite, fatturato
 * per tipo di campagna), periodo per periodo. Li legge e li scrive chi segue il cliente:
 * l'amministratore e il consulente a cui è assegnato. Mai dal link pubblico del cliente.
 *
 * Fino al 07/10/2026 si scrivevano a mano in una scheda del foglio Google; con il passaggio al
 * database l'unico modo era l'editor di tabelle di Supabase.
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

  const righe = (await getRisultatiCommerciali({ noCache: true }))
    .filter((r) => r.clienteId === accesso.clienteId && r.sedeId === accesso.sedeId)
    .map((r) => ({
      periodo: r.periodo,
      tipoCampagna: r.tipoCampagna,
      richieste: r.richieste,
      appuntamentiFissati: r.appuntamentiFissati,
      appuntamentiEffettuati: r.appuntamentiEffettuati,
      vendite: r.vendite,
      fatturato: r.fatturato,
    }));
  return NextResponse.json({ righe });
}

type Body = { clienteId?: string; sedeId?: string; periodo?: string; righe?: unknown };

/** Sostituisce i risultati della sede per quel periodo. Nessuna riga = il periodo torna "non compilato". */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const accesso = await sedeAccessibile(body.clienteId?.trim(), body.sedeId?.trim());
  if (accesso instanceof NextResponse) return accesso;

  const periodo = body.periodo?.trim() ?? "";
  const controllo = controllaRigheCommerciali(body.righe);
  if (!controllo.ok) return erroreRisposta(controllo.errore, 400);

  const compilati = (await getRisultatiCommerciali({ noCache: true }))
    .filter((r) => r.clienteId === accesso.clienteId && r.sedeId === accesso.sedeId)
    .map((r) => r.periodo);
  const errore = erroreSulPeriodo(periodo, controllo.righe.length > 0, compilati);
  if (errore) return erroreRisposta(errore, 400);

  try {
    await salvaRisultatiCommerciali({ ...accesso, periodo, righe: controllo.righe });
  } catch (err) {
    return erroreRisposta(messaggioDi(err, "Errore nel salvataggio"), 502);
  }
  return NextResponse.json({ ok: true, righe: controllo.righe.length });
}
