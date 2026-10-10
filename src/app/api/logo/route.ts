import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { getClienteByAccessCode, getClienti } from "@/lib/archivio";
import { puoVedereCliente } from "@/lib/authz";
import { indirizzoPubblico } from "@/lib/logoCliente";
import { rifilaLogo } from "@/lib/logoRifilato";

export const runtime = "nodejs";

// Un logo più pesante di così non è un logo: non lo si scarica.
const PESO_MASSIMO = 8 * 1024 * 1024;
const ATTESA_MASSIMA_MS = 6000;

/**
 * Il logo di un cliente, rifilato dai margini vuoti (vedi src/lib/logoRifilato.ts). Come
 * /api/sintesi-cliente ha un ramo `code`, per il link pubblico del cliente, e uno per il team.
 *
 * L'indirizzo del logo non arriva mai da chi chiama: si legge dalla scheda del cliente, dove lo può
 * scrivere solo l'amministratore, e il server lo scarica solo se è un sito raggiungibile da fuori.
 *
 * Se il logo si scarica ma non si riesce a rifilare (un formato che il programma non legge), la
 * risposta rimanda all'indirizzo originale: il browser lo mostra com'è, come prima di questa
 * funzione. Se invece all'indirizzo il logo non c'è più, la risposta è 404 e la pagina mostra il solo
 * nome del cliente (vedi LogoONomeCliente.tsx).
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const clienteIdParam = req.nextUrl.searchParams.get("clienteId");

  let logoUrl: string | undefined;
  if (code) {
    const cliente = await getClienteByAccessCode(code);
    if (!cliente || !cliente.attivo) return new NextResponse(null, { status: 404 });
    logoUrl = cliente.logoUrl;
  } else {
    const sessione = await getSessione();
    if (!sessione) return new NextResponse(null, { status: 401 });
    if (!clienteIdParam) return new NextResponse(null, { status: 400 });
    const clienti = await getClienti();
    if (!puoVedereCliente(sessione, clienteIdParam, clienti)) return new NextResponse(null, { status: 403 });
    logoUrl = clienti.find((c) => c.clienteId === clienteIdParam)?.logoUrl;
  }

  if (!logoUrl || !indirizzoPubblico(logoUrl)) return new NextResponse(null, { status: 404 });

  let dati: Buffer;
  try {
    const risposta = await fetch(logoUrl, { signal: AbortSignal.timeout(ATTESA_MASSIMA_MS), headers: { "User-Agent": "Mozilla/5.0 (Meta Manager ALC)" } });
    if (!risposta.ok) return new NextResponse(null, { status: 404 });
    dati = Buffer.from(await risposta.arrayBuffer());
    if (dati.length === 0 || dati.length > PESO_MASSIMO) return new NextResponse(null, { status: 404 });
  } catch {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const rifilato = await rifilaLogo(dati);
    return new NextResponse(new Uint8Array(rifilato), {
      headers: {
        "Content-Type": "image/png",
        // Un giorno nel browser di chi guarda: l'indirizzo cambia da solo quando cambia il logo.
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return NextResponse.redirect(logoUrl, 302);
  }
}
