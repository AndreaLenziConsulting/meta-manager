import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import {
  getCampagne,
  getCategorieCommerciali,
  getClienteByAccessCode,
  getClienti,
  getRisultatiCommerciali,
  getRisultatiVenditori,
  getMetaDaily,
  getSedi,
  getUltimoCambioPerCampagna,
  getVenditori,
} from "@/lib/sheets";
import { puoVedereCliente } from "@/lib/authz";
import { chiaveCampagna, computeKpi, computeKpiPerCampagna, isPeriodoMensile } from "@/lib/kpi";
import { aggiungiGiorni } from "@/lib/roadmap";
import { mesiConSpesaSenzaRisultatiCommerciali } from "@/lib/kpiQualita";
import { aggregaRisultatiVenditori } from "@/lib/venditori";
import type { CampagnaDisponibile, Canale, KpiResponse, Sede } from "@/types/kpi";

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
  // Filtro canale (Meta/Google Ads — Fase 1 del redesign multi-canale, 12/09/2026): a differenza di
  // `campagne` sopra, non arriva come Set separato fino a computeKpi — viene tradotto qui sotto
  // (dopo aver letto `campagne`, serve per sapere quali campaignId appartengono a quali canali) in
  // un ulteriore restringimento di campagneSelezionate, così computeKpi/computeKpiPerCampagna non
  // guadagnano un nuovo parametro.
  const canaliParam = searchParams.get("canali");
  const canaliSelezionati = canaliParam ? new Set(canaliParam.split(",").filter(Boolean) as Canale[]) : undefined;
  // Bypassa la cache da 30s di sheets.ts — SOLO quando il chiamante lo chiede esplicitamente (subito
  // dopo un "Aggiorna KPI" manuale, vedi KpiSection.tsx). La cache vive per istanza serverless, mai
  // condivisa: senza questo, la lettura che segue una sincronizzazione può capitare su un'istanza
  // diversa da quella che ha scritto, mostrando dati di prima del sync per altri secondi (bug "serve
  // cliccare 2-3 volte", 11/09/2026). Mai true sulle normali navigazioni: perderebbero il beneficio
  // della cache senza un motivo reale.
  const noCache = searchParams.get("noCache") === "1";

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

  const [metaDaily, campagne, risultatiCommerciali, ultimoCambioPerCampagna, categorieCommerciali, venditoriSede, risultatiVenditori] =
    await Promise.all([
      getMetaDaily({ noCache }),
      getCampagne({ noCache }),
      getRisultatiCommerciali({ noCache }),
      getUltimoCambioPerCampagna({ noCache }),
      // Lette sempre (anche sul ramo `code`, scartate sotto se non internal): costo trascurabile,
      // stesso schema di risultatiCommerciali sopra — evita un secondo giro di fetch condizionale.
      getCategorieCommerciali({ noCache }),
      getVenditori({ noCache }),
      getRisultatiVenditori({ noCache }),
    ]);

  // Interseca il filtro canale (se presente) dentro campagneSelezionate: dopo questo punto i due
  // compute* sotto continuano a ricevere l'unico Set che già conoscevano, senza saperne nulla.
  let campagneSelezionateEffettive = campagneSelezionate;
  if (canaliSelezionati) {
    const idsNelCanale = new Set(
      campagne
        .filter((c) => c.clienteId === clienteId && c.sedeId === sede.sedeId && canaliSelezionati.has(c.canale ?? "meta"))
        .map((c) => c.campaignId)
    );
    campagneSelezionateEffettive = campagneSelezionate
      ? new Set([...campagneSelezionate].filter((id) => idsNelCanale.has(id)))
      : idsNelCanale;
  }

  const { gruppi, totale, trend, trendSettimanale } = computeKpi(
    clienteId,
    sede.sedeId,
    da,
    a,
    metaDaily,
    campagne,
    risultatiCommerciali,
    campagneSelezionateEffettive
  );
  const righeCampagne = computeKpiPerCampagna(
    clienteId,
    sede.sedeId,
    da,
    a,
    metaDaily,
    campagne,
    campagneSelezionateEffettive,
    ultimoCambioPerCampagna
  );

  const campagneSede = campagne.filter((c) => c.clienteId === clienteId && c.sedeId === sede.sedeId);
  // Chiave canale::campaignId (vedi chiaveCampagna in lib/kpi.ts), non il solo campaignId — stesso
  // motivo delle Map equivalenti in computeKpi/computeKpiPerCampagna: campagneDisponibili alimenta
  // il filtro dell'utente e non deve mai fondere due campagne di canali diversi con lo stesso id.
  const infoCampagna = new Map(campagneSede.map((c) => [chiaveCampagna(c.canale, c.campaignId), c]));
  const campaignKeysSede = new Set(campagneSede.map((c) => chiaveCampagna(c.canale, c.campaignId)));
  // Stessa doppia grana mese/settimana di computeKpi (selettore periodo a settimane, 25/09/2026):
  // `da`/`a` a 10 caratteri sono già lunedì-chiave, il range reale è lunedì di `da` -> domenica di `a`.
  const modoSettimana = !isPeriodoMensile(da);
  const fineGiornoPeriodo = modoSettimana ? aggiungiGiorni(a, 6) : null;
  const campagneDisponibiliMap = new Map<string, CampagnaDisponibile>();
  for (const row of metaDaily) {
    if (row.clienteId !== clienteId) continue;
    const chiave = chiaveCampagna(row.canale, row.campaignId);
    if (!campaignKeysSede.has(chiave)) continue;
    const nelPeriodo = modoSettimana ? row.data >= da && row.data <= fineGiornoPeriodo! : row.data.slice(0, 7) >= da && row.data.slice(0, 7) <= a;
    if (!nelPeriodo) continue;
    if (campagneDisponibiliMap.has(chiave)) continue;
    const info = infoCampagna.get(chiave);
    campagneDisponibiliMap.set(chiave, {
      campaignId: row.campaignId,
      canale: info?.canale ?? row.canale ?? "meta",
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
          categorie: categorieCommerciali.filter((c) => c.sedeId === sede.sedeId && c.attivo),
          venditori: venditoriSede.filter((v) => v.sedeId === sede.sedeId && v.attivo),
          // RisultatiVenditori resta a grana mese (fuori scope per il selettore periodo a settimane,
          // 25/09/2026, stesso limite non ancora affrontato di RisultatiCommerciali) — array vuoto in
          // modalità settimana invece di un confronto mese-vs-settimana senza senso su
          // RisultatoVenditoreRow.mese.
          risultatiVenditoriPeriodo: modoSettimana
            ? []
            : Array.from(aggregaRisultatiVenditori(risultatiVenditori, sede.sedeId, da, a).entries()).map(([venditoreId, agg]) => ({
                venditoreId,
                ...agg,
              })),
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
  // senza risultati per queste campagne" non sarebbe una domanda ben posta. Resta a grana mese anche
  // in modalità settimana (fuori scope per il selettore periodo a settimane, 25/09/2026): niente
  // avviso "settimana non compilata" in questo giro, il filtro sotto confronterebbe un mese con una
  // settimana senza senso se eseguito comunque.
  if (internal && !modoSettimana) {
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
