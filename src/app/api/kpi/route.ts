import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { getCampagne, getClienteByAccessCode, getClienti, getFunnel, getMetaDaily } from "@/lib/sheets";
import { puoVedereCliente } from "@/lib/authz";
import { computeKpi, computeKpiPerCampagna } from "@/lib/kpi";
import type { CampagnaDisponibile, KpiResponse } from "@/types/kpi";

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
  const campagneParam = searchParams.get("campagne");
  const campagneSelezionate = campagneParam ? new Set(campagneParam.split(",").filter(Boolean)) : undefined;

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
    const sessione = await getSessione();
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

  const { gruppi, totale, trend, trendSettimanale } = computeKpi(
    clienteId,
    da,
    a,
    metaDaily,
    campagne,
    funnel,
    campagneSelezionate
  );
  const righeCampagne = computeKpiPerCampagna(clienteId, da, a, metaDaily, campagne, campagneSelezionate);

  const infoCampagna = new Map(campagne.filter((c) => c.clienteId === clienteId).map((c) => [c.campaignId, c]));
  const campagneDisponibiliMap = new Map<string, CampagnaDisponibile>();
  for (const row of metaDaily) {
    if (row.clienteId !== clienteId) continue;
    const mese = row.data.slice(0, 7);
    if (mese < da || mese > a) continue;
    if (campagneDisponibiliMap.has(row.campaignId)) continue;
    const info = infoCampagna.get(row.campaignId);
    campagneDisponibiliMap.set(row.campaignId, {
      campaignId: row.campaignId,
      nomeCampagna: info?.nomeCampagna ?? row.campaignId,
      tipoCampagna: info?.tipoCampagna || "Non classificata",
      stato: info?.stato ?? "",
    });
  }
  const campagneDisponibili = Array.from(campagneDisponibiliMap.values()).sort((a, b) =>
    a.nomeCampagna.localeCompare(b.nomeCampagna)
  );

  const response: KpiResponse = {
    cliente: { clienteId, nome: nomeCliente },
    periodo: { da, a },
    gruppi,
    totale,
    trend,
    trendSettimanale,
    campagne: righeCampagne,
    campagneDisponibili,
  };

  return NextResponse.json(response);
}
