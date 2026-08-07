import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getCampagne, getClienteByAccessCode, getClienti, getFunnel, getMetaDaily } from "@/lib/sheets";
import { puoVedereCliente } from "@/lib/authz";
import { computeKpi } from "@/lib/kpi";
import type { KpiResponse } from "@/types/kpi";

export const runtime = "nodejs";

function meseCorrente(): string {
  return new Date().toISOString().slice(0, 7);
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const clienteIdParam = searchParams.get("clienteId");
  const da = searchParams.get("da") || meseCorrente();
  const a = searchParams.get("a") || meseCorrente();

  let clienteId: string;
  let nomeCliente: string;

  if (code) {
    const cliente = await getClienteByAccessCode(code);
    if (!cliente || !cliente.attivo) {
      return NextResponse.json({ error: "Codice non valido" }, { status: 401 });
    }
    clienteId = cliente.clienteId;
    nomeCliente = cliente.nome;
  } else {
    const cookieStore = await cookies();
    const sessione = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
    if (!sessione) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }
    if (!clienteIdParam) {
      return NextResponse.json({ error: "clienteId mancante" }, { status: 400 });
    }
    const clienti = await getClienti();
    if (!puoVedereCliente(sessione, clienteIdParam, clienti)) {
      return NextResponse.json({ error: "Non autorizzato per questo cliente" }, { status: 403 });
    }
    const cliente = clienti.find((c) => c.clienteId === clienteIdParam)!;
    clienteId = cliente.clienteId;
    nomeCliente = cliente.nome;
  }

  const [metaDaily, campagne, funnel] = await Promise.all([getMetaDaily(), getCampagne(), getFunnel()]);
  const { gruppi, totale, trend } = computeKpi(clienteId, da, a, metaDaily, campagne, funnel);

  const response: KpiResponse = {
    cliente: { clienteId, nome: nomeCliente },
    periodo: { da, a },
    gruppi,
    totale,
    trend,
  };

  return NextResponse.json(response);
}
