import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import {
  getCampagne,
  getClienteByAccessCode,
  getClienti,
  getRisultatiCommerciali,
  getMetaDaily,
  getSedi,
  getUltimoCambioPerCampagna,
} from "@/lib/sheets";
import { puoVedereCliente } from "@/lib/authz";
import { computeKpi, computeKpiPerCampagna } from "@/lib/kpi";
import { mesiConSpesaSenzaRisultatiCommerciali } from "@/lib/kpiQualita";
import type { CampagnaDisponibile, KpiResponse, Sede } from "@/types/kpi";

export const runtime = "nodejs";

function meseCorrente(): string {
  return new Date().toISOString().slice(0, 7);
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const clienteIdParam = searchParams.get("clienteId");
  const sedeIdParam = searchParams.get("sedeId");
  const da = searchParams.get("da") || meseCorrente();
  const a = searchParams.get("a") || meseCorrente();
  const campagneParam = searchParams.get("campagne");
  const campagneSelezionate = campagneParam ? new Set(campagneParam.split(",").filter(Boolean)) : undefined;

  let clienteId: string;
  let nomeCliente: string;
  // Solo la richiesta interna (clienteId, sessione autenticata) valorizza i target — mai il ramo
  // `code`: il cliente sul suo link pubblico non deve mai vedere i propri target CPA/CPL.
  let internal = false;

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
    internal = true;
  }

  const tutteLeSedi = await getSedi();
  const sediCliente = tutteLeSedi
    .filter((s) => s.clienteId === clienteId && s.attivo)
    .sort((x: Sede, y: Sede) => x.nome.localeCompare(y.nome));
  if (sediCliente.length === 0) {
    return NextResponse.json({ error: "Nessuna sede attiva per questo cliente" }, { status: 404 });
  }
  const sede = (sedeIdParam && sediCliente.find((s) => s.sedeId === sedeIdParam)) || sediCliente[0];

  const [metaDaily, campagne, risultatiCommerciali, ultimoCambioPerCampagna] = await Promise.all([
    getMetaDaily(),
    getCampagne(),
    getRisultatiCommerciali(),
    getUltimoCambioPerCampagna(),
  ]);

  const { gruppi, totale, trend, trendSettimanale } = computeKpi(
    clienteId,
    sede.sedeId,
    da,
    a,
    metaDaily,
    campagne,
    risultatiCommerciali,
    campagneSelezionate
  );
  const righeCampagne = computeKpiPerCampagna(
    clienteId,
    sede.sedeId,
    da,
    a,
    metaDaily,
    campagne,
    campagneSelezionate,
    ultimoCambioPerCampagna
  );

  const campagneSede = campagne.filter((c) => c.clienteId === clienteId && c.sedeId === sede.sedeId);
  const infoCampagna = new Map(campagneSede.map((c) => [c.campaignId, c]));
  const campaignIdsSede = new Set(campagneSede.map((c) => c.campaignId));
  const campagneDisponibiliMap = new Map<string, CampagnaDisponibile>();
  for (const row of metaDaily) {
    if (row.clienteId !== clienteId) continue;
    if (!campaignIdsSede.has(row.campaignId)) continue;
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
    sede: internal
      ? {
          sedeId: sede.sedeId,
          nome: sede.nome,
          targetCpa: sede.targetCpa,
          targetCpl: sede.targetCpl,
          adAccountId: sede.adAccountId,
          targetBudgetMensile: sede.targetBudgetMensile,
          targetLeadSettimana: sede.targetLeadSettimana,
          targetAppuntamentiSettimana: sede.targetAppuntamentiSettimana,
          targetFatturatoMensile: sede.targetFatturatoMensile,
        }
      : { sedeId: sede.sedeId, nome: sede.nome },
    sediDisponibili: sediCliente.map((s) => ({ sedeId: s.sedeId, nome: s.nome })),
    periodo: { da, a },
    gruppi,
    totale,
    trend,
    trendSettimanale,
    campagne: righeCampagne,
    campagneDisponibili,
  };

  // Additivo, solo ramo interno (stesso motivo di targetCpa/targetCpl sopra) — riusa
  // metaDaily/campagne/risultatiCommerciali già in memoria per questa richiesta, nessuna lettura in
  // più. mesiConSpesaSenzaRisultatiCommerciali guarda tutta la storia della sede per costruzione
  // (vedi kpiQualita.ts): filtrato qui al periodo `da`/`a` scelto, per restare scoped come il resto
  // del pannello Avvisi operativi (blocco 4) — non filtrato per campagna selezionata: i risultati
  // commerciali sono tracciati per tipo_campagna in aggregato, non per singola campagna, "mese
  // senza risultati per queste campagne" non sarebbe una domanda ben posta.
  if (internal) {
    response.meseSenzaRisultatiCommerciali = mesiConSpesaSenzaRisultatiCommerciali(
      clienteId,
      sede.sedeId,
      metaDaily,
      campagne,
      risultatiCommerciali
    ).filter((m) => m.mese >= da && m.mese <= a);
  }

  return NextResponse.json(response);
}
