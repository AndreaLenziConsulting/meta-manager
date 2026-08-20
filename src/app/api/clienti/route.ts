import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { generaAccessCode, generaClienteId, generaSedeId } from "@/lib/accessCode";
import { generaAttivitaPerCliente } from "@/lib/roadmap";
import {
  aggiornaCliente,
  creaAttivitaPerCliente,
  creaCliente,
  creaSede,
  getClienti,
  getConsulenti,
  getProdotti,
  getSedi,
  getTemplateAttivita,
} from "@/lib/sheets";

export const runtime = "nodejs";

type Body = {
  nome?: string;
  adAccountId?: string;
  email?: string;
  consulenteId?: string;
  targetCpa?: number | null;
  targetCpl?: number | null;
  mostraTabExtra?: boolean;
  prodottoId?: string;
  dataInizioProgetto?: string;
};

/**
 * Crea un nuovo cliente con una prima sede "Principale" (stessi campi ad account/target che il
 * form raccoglie oggi, ora scritti su Sede) e, se è stato scelto un prodotto, genera subito la
 * roadmap. Sedi aggiuntive si aggiungono in un secondo momento da ModificaClienteModal. Solo admin.
 */
export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può aggiungere clienti" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const nome = body.nome?.trim();
  const adAccountId = body.adAccountId?.trim();
  const consulenteId = body.consulenteId?.trim();
  const prodottoId = body.prodottoId?.trim() ?? "";
  const dataInizioProgetto = body.dataInizioProgetto?.trim() || null;

  if (!nome) {
    return NextResponse.json({ error: "Nome obbligatorio" }, { status: 400 });
  }
  if (!adAccountId || !/^\d+$/.test(adAccountId)) {
    return NextResponse.json({ error: 'Ad account id non valido: solo cifre, senza il prefisso "act_"' }, { status: 400 });
  }
  if (!consulenteId) {
    return NextResponse.json({ error: "Consulente obbligatorio" }, { status: 400 });
  }
  if (prodottoId && !dataInizioProgetto) {
    return NextResponse.json({ error: "Data inizio progetto obbligatoria se scegli un prodotto" }, { status: 400 });
  }

  const [clienti, consulenti, prodotti, sedi] = await Promise.all([
    getClienti(),
    getConsulenti(),
    getProdotti(),
    getSedi(),
  ]);

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
      mostraTabExtra: !!body.mostraTabExtra,
      prodottoId,
      dataInizioProgetto,
      email: body.email?.trim(),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore nella creazione" }, { status: 409 });
  }

  // Il cliente ormai esiste: un fallimento nella creazione della sede non deve sembrare un
  // fallimento totale della richiesta — il cliente resta comunque creato, la sede si può aggiungere
  // a mano da ModificaClienteModal se questo passo fallisse (scenario raro).
  try {
    const sedeId = generaSedeId(clienteId, "Principale", new Set(sedi.map((s) => s.sedeId)));
    await creaSede({
      sedeId,
      clienteId,
      nome: "Principale",
      adAccountId,
      targetCpa: body.targetCpa ?? null,
      targetCpl: body.targetCpl ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cliente creato ma la sede non è stata salvata" },
      { status: 502 }
    );
  }

  // Il cliente ormai esiste: un fallimento qui non deve sembrare un fallimento totale, la roadmap
  // si può sempre rigenerare in un secondo momento da /api/attivita/genera.
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

  return NextResponse.json({ clienteId, accessCode, roadmapGenerata }, { status: 201 });
}

type BodyPatch = {
  clienteId?: string;
  nome?: string;
  email?: string;
  consulenteId?: string;
  mostraTabExtra?: boolean;
  attivo?: boolean;
};

/**
 * Modifica l'anagrafica di un cliente esistente (dalla Dashboard Amministratore). Aggiornamento
 * parziale: solo i campi presenti nel body vengono validati/scritti. Esclude deliberatamente
 * prodottoId/dataInizioProgetto (flusso roadmap dedicato) e accessCode (mai riassegnabile). Ad
 * account/target/tipo-conversione-lead si modificano da /api/sedi, non più da qui. Solo admin.
 */
export async function PATCH(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo l'amministratore può modificare i clienti" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as BodyPatch;
  const clienteId = body.clienteId?.trim();
  if (!clienteId) {
    return NextResponse.json({ error: "clienteId obbligatorio" }, { status: 400 });
  }

  const nome = body.nome !== undefined ? body.nome.trim() : undefined;
  if (nome !== undefined && !nome) {
    return NextResponse.json({ error: "Nome obbligatorio" }, { status: 400 });
  }

  const [clienti, consulenti] = await Promise.all([getClienti(), getConsulenti()]);
  if (!clienti.some((c) => c.clienteId === clienteId)) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }
  // A differenza della creazione (POST), qui il consulente non deve per forza essere attivo: un
  // cliente può già avere assegnato un consulente nel frattempo disattivato, e l'admin deve poter
  // salvare gli altri campi senza esserne bloccato. Se invece ne assegna uno nuovo esplicitamente,
  // la UI lo marca "(disattivato)" per guidare la scelta, ma non lo impedisce.
  if (body.consulenteId !== undefined && !consulenti.some((c) => c.consulenteId === body.consulenteId)) {
    return NextResponse.json({ error: "Consulente non valido" }, { status: 400 });
  }

  try {
    await aggiornaCliente({
      clienteId,
      nome,
      email: body.email !== undefined ? body.email.trim() : undefined,
      consulenteId: body.consulenteId,
      mostraTabExtra: body.mostraTabExtra,
      attivo: body.attivo,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore sconosciuto" }, { status: 502 });
  }
}
