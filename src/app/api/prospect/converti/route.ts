import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { generaAccessCode, generaClienteId, generaSedeId } from "@/lib/accessCode";
import { generaAttivitaPerCliente } from "@/lib/roadmap";
import {
  aggiornaProspect,
  creaAttivitaPerCliente,
  creaCliente,
  creaSede,
  getClienti,
  getConsulenti,
  getProdotti,
  getProspect,
  getSedi,
  getTemplateAttivita,
} from "@/lib/sheets";

export const runtime = "nodejs";

type Body = {
  prospectId?: string;
  nome?: string;
  email?: string;
  consulenteId?: string;
  prodottoId?: string;
  dataInizioProgetto?: string;
  adAccountId?: string;
  targetCpa?: number | null;
  targetCpl?: number | null;
  driveFolderUrl?: string;
  landingPageUrl?: string;
};

/**
 * Hand-off commerciale→consulente: converte un prospect "vinto" in un Cliente vero e proprio — il
 * collegamento che mancava (vedi il commento su `Prospect.clienteId` in types/prospect.ts). Crea
 * Cliente + una prima Sede "Principale" e, se scelto un prodotto, la roadmap — stessa identica
 * logica di POST /api/clienti (funzioni sheets.ts riusate, non duplicate), non quell'endpoint
 * stesso: qui in più c'è il prospect da richiudere alla fine. Solo admin, per lo stesso motivo per
 * cui lo è POST /api/clienti — un commerciale non può creare clienti, quindi nemmeno completare
 * questa conversione, anche se è lui a "proporla" aprendo il modale in UI.
 *
 * Deliberatamente NON copiato dal prospect: `targetCpa`/`targetCpl` del Cliente vivono sulla Sede e
 * sono target ADS (costo per lead/vendita); i target del prospect (`targetCpl`/
 * `targetCpaAppuntamento`) sono metriche commerciali pre-vendita — stessa unità (€), popolazioni
 * diverse. Copiarli automaticamente rischierebbe di far passare per un target ads verificato un
 * numero concordato in fase commerciale. Restano visibili come riferimento nel pannello "Dati
 * commerciali" del prospect (ProspectDatiCommerciali.tsx): l'admin li guarda e decide i target ads
 * reali da sé, non li riceve già (silenziosamente) applicati.
 */
export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può convertire un prospect in cliente" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const prospectId = body.prospectId?.trim();
  const nome = body.nome?.trim();
  const consulenteId = body.consulenteId?.trim();
  const prodottoId = body.prodottoId?.trim() ?? "";
  const dataInizioProgetto = body.dataInizioProgetto?.trim() || null;
  const adAccountId = body.adAccountId?.trim();

  if (!prospectId) {
    return NextResponse.json({ error: "prospectId obbligatorio" }, { status: 400 });
  }
  if (!nome) {
    return NextResponse.json({ error: "Nome obbligatorio" }, { status: 400 });
  }
  if (!consulenteId) {
    return NextResponse.json({ error: "Consulente di riferimento obbligatorio" }, { status: 400 });
  }
  if (adAccountId && !/^\d+$/.test(adAccountId)) {
    return NextResponse.json({ error: 'Ad account id non valido: solo cifre, senza il prefisso "act_"' }, { status: 400 });
  }
  if (prodottoId && !dataInizioProgetto) {
    return NextResponse.json({ error: "Data inizio progetto obbligatoria se scegli un prodotto" }, { status: 400 });
  }

  const [prospetti, clienti, consulenti, prodotti, sedi] = await Promise.all([
    getProspect(),
    getClienti(),
    getConsulenti(),
    getProdotti(),
    getSedi(),
  ]);

  const prospect = prospetti.find((p) => p.prospectId === prospectId);
  if (!prospect) {
    return NextResponse.json({ error: "Prospect non trovato" }, { status: 404 });
  }
  if (prospect.clienteId) {
    return NextResponse.json({ error: `Questo prospect è già stato convertito nel cliente "${prospect.clienteId}"` }, { status: 409 });
  }
  if (!consulenti.some((c) => c.consulenteId === consulenteId && c.attivo)) {
    return NextResponse.json({ error: "Consulente non valido" }, { status: 400 });
  }
  if (prodottoId && !prodotti.some((p) => p.prodottoId === prodottoId && p.attivo)) {
    return NextResponse.json({ error: "Prodotto non valido" }, { status: 400 });
  }

  const clienteId = generaClienteId(nome, new Set(clienti.map((c) => c.clienteId)));
  const codiciEsistenti = new Set(clienti.map((c) => c.accessCode));
  let accessCode = generaAccessCode();
  while (codiciEsistenti.has(accessCode)) accessCode = generaAccessCode();

  try {
    await creaCliente({
      clienteId,
      nome,
      accessCode,
      consulenteId,
      mostraTabExtra: false,
      prodottoId,
      dataInizioProgetto,
      email: body.email?.trim(),
      driveFolderUrl: body.driveFolderUrl?.trim(),
      landingPageUrl: body.landingPageUrl?.trim(),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore nella creazione del cliente" }, { status: 409 });
  }

  // Il cliente ormai esiste: un fallimento nella creazione della sede non deve sembrare un
  // fallimento totale della richiesta (stesso spirito di POST /api/clienti).
  try {
    const sedeId = generaSedeId(clienteId, "Principale", new Set(sedi.map((s) => s.sedeId)));
    await creaSede({
      sedeId,
      clienteId,
      nome: "Principale",
      adAccountId: adAccountId ?? "",
      targetCpa: body.targetCpa ?? null,
      targetCpl: body.targetCpl ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cliente creato ma la sede non è stata salvata" },
      { status: 502 }
    );
  }

  let roadmapGenerata = false;
  if (prodottoId && dataInizioProgetto) {
    try {
      const template = await getTemplateAttivita();
      const righe = generaAttivitaPerCliente(clienteId, prodottoId, dataInizioProgetto, template);
      await creaAttivitaPerCliente(righe);
      roadmapGenerata = righe.length > 0;
    } catch {
      roadmapGenerata = false;
    }
  }

  // Registra l'esito sul prospect — SOLO clienteId, mai attivo:false: prospectVisibili/
  // puoVedereProspect filtrano su `attivo`, quindi disattivarlo lo farebbe sparire da ogni lista e
  // dalla sua stessa pagina (redirect immediato) prima ancora che si possa vedere il badge
  // "Convertito in cliente" o riconsultare i vecchi report — l'esatto contrario dello scopo di
  // questo campo. Un prospect convertito resta quindi visibile come tutti gli altri, solo marcato.
  // Un fallimento qui non deve sembrare un fallimento totale — il cliente (l'esito che conta) esiste
  // già; nel peggiore dei casi il prospect resta "riconvertibile" (creerebbe un secondo cliente, non
  // un dato corrotto).
  try {
    await aggiornaProspect({ prospectId, clienteId });
  } catch (err) {
    console.error("Registrazione dell'esito della conversione sul prospect non riuscita (non bloccante):", err);
  }

  return NextResponse.json({ clienteId, accessCode, roadmapGenerata }, { status: 201 });
}
