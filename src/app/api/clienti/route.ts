import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { generaAccessCode, generaClienteId } from "@/lib/accessCode";
import { generaAttivitaPerCliente } from "@/lib/roadmap";
import {
  creaAttivitaPerCliente,
  creaCliente,
  getClienti,
  getConsulenti,
  getProdotti,
  getTemplateAttivita,
} from "@/lib/sheets";

export const runtime = "nodejs";

type Body = {
  nome?: string;
  adAccountId?: string;
  consulenteId?: string;
  targetCpa?: number | null;
  targetCpl?: number | null;
  mostraTabExtra?: boolean;
  prodottoId?: string;
  dataInizioProgetto?: string;
};

/** Crea un nuovo cliente e, se è stato scelto un prodotto, genera subito la roadmap. Solo admin. */
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

  const [clienti, consulenti, prodotti] = await Promise.all([getClienti(), getConsulenti(), getProdotti()]);

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
      adAccountId,
      accessCode,
      consulenteId,
      targetCpa: body.targetCpa ?? null,
      targetCpl: body.targetCpl ?? null,
      mostraTabExtra: !!body.mostraTabExtra,
      prodottoId,
      dataInizioProgetto,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore nella creazione" }, { status: 409 });
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
