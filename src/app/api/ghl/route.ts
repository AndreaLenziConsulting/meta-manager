import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { getClienti, getGhlConnessioni, getSedi } from "@/lib/sheets";
import { puoVedereCliente } from "@/lib/authz";
import {
  appuntamentiGhlPerSettimana,
  breakdownGhlPerCampagna,
  fatturatoGhlPerSettimana,
  fetchAppuntamenti,
  fetchOpportunita,
  mappaCampagnaPerContatto,
  primoAppuntamentoPerContatto,
  riepilogoAppuntamenti,
  riepilogoOpportunita,
} from "@/lib/ghl";
import type { GhlRiepilogoResponse } from "@/types/ghl";

export const runtime = "nodejs";

function meseCorrente(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Riepilogo "vendite e appuntamenti" da GHL/Squadd per una sede — Fase 1, sola lettura. Mai sul
 * link pubblico cliente (nessun ramo `code`, a differenza di /api/kpi): dato non ancora validato
 * quanto RisultatiCommerciali, resta un pannello solo per il team — vedi src/lib/ghl.ts. Se la sede non ha
 * una GhlConnessione attiva, torna { connesso: false } con status 200 (non è un errore, è lo
 * stato normale finché nessuno l'ha collegata).
 *
 * Gli appuntamenti contano sempre e solo il primo per contatto (vedi primoAppuntamentoPerContatto)
 * e `perCampagna`/`campagneAttribuibili` nella risposta portano l'attribuzione a campagna Meta
 * reale (join contatto->opportunità->attributions, vedi mappaCampagnaPerContatto) — decisione
 * esplicita dell'utente (08/09/2026). Il query param opzionale `campagne` (stesso formato del
 * filtro campagne di /api/kpi: campaignId separati da virgola) restringe appuntamenti/opportunità/
 * trend ai soli contatti attribuiti a quelle campagne, invece di disattivare il pannello come
 * faceva prima di questa feature.
 */
export async function GET(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const clienteId = searchParams.get("clienteId");
  const sedeIdParam = searchParams.get("sedeId");
  // da/a in formato YYYY-MM (mese), stesso formato di /api/kpi — non YYYY-MM-DD: il pannello ora
  // ha un vero selettore di periodo (MonthRangePicker, come il tab KPI) invece del solo mese
  // corrente fisso della Fase 1 iniziale.
  const da = searchParams.get("da") || meseCorrente();
  const a = searchParams.get("a") || meseCorrente();
  // Stesso parametro/formato del filtro campagne di /api/kpi (campaignId separati da virgola) —
  // qui scoped appuntamenti/opportunità ai soli contatti attribuiti a queste campagne (vedi
  // mappaCampagnaPerContatto), invece di disattivare il pannello GHL come prima di questa feature.
  const campagneParam = searchParams.get("campagne");
  const campagneFiltro = campagneParam ? new Set(campagneParam.split(",").filter(Boolean)) : null;

  if (!clienteId) {
    return NextResponse.json({ error: "clienteId mancante" }, { status: 400 });
  }
  const clienti = await getClienti();
  if (!puoVedereCliente(sessione, clienteId, clienti)) {
    return NextResponse.json({ error: "Non autorizzato per questo cliente" }, { status: 403 });
  }

  const tutteLeSedi = await getSedi();
  const sediCliente = tutteLeSedi.filter((s) => s.clienteId === clienteId && s.attivo);
  if (sediCliente.length === 0) {
    return NextResponse.json({ error: "Nessuna sede attiva per questo cliente" }, { status: 404 });
  }
  const sede = (sedeIdParam && sediCliente.find((s) => s.sedeId === sedeIdParam)) || sediCliente[0];

  const connessioni = await getGhlConnessioni();
  const connessione = connessioni.find((c) => c.sedeId === sede.sedeId && c.attivo);
  if (!connessione) {
    const risposta: GhlRiepilogoResponse = { connesso: false };
    return NextResponse.json(risposta);
  }

  const startMs = new Date(`${da}-01T00:00:00Z`).getTime();
  // Fine dell'ultimo giorno del mese `a`: primo istante del mese successivo meno 1ms, corretto per
  // qualunque lunghezza di mese senza bisogno di sapere quanti giorni ha.
  const [annoA, meseANum] = a.split("-").map(Number);
  const endMs = Date.UTC(annoA, meseANum, 1) - 1;

  try {
    const [{ appuntamenti, calendariFalliti }, opportunitaGrezze] = await Promise.all([
      fetchAppuntamenti(connessione.locationId, connessione.privateToken, connessione.calendarIds, startMs, endMs),
      // Nessun filtro status server-side (a differenza di prima di questa feature): serve TUTTA la
      // location per costruire mappaCampagna sotto — un contatto con appuntamento ma opportunità
      // ancora "open" (non vinta) porterebbe comunque la sua attribuzione, persa se si fetchasse
      // solo "won". riepilogoOpportunita/fatturatoGhlPerSettimana filtrano "won" lato client come
      // già facevano, quindi il comportamento di vendite/fatturato non cambia.
      fetchOpportunita(connessione.locationId, connessione.privateToken, {}),
    ]);

    // Sempre applicata, non un filtro opzionale — vedi il commento su primoAppuntamentoPerContatto.
    const appuntamentiPrimi = primoAppuntamentoPerContatto(appuntamenti);
    const opportunitaVinte = opportunitaGrezze.filter((o) => o.status === "won");
    const mappaCampagna = mappaCampagnaPerContatto(opportunitaGrezze);
    // Sempre calcolato (non solo quando `campagne` è in query): alimenta la tabella "per singola
    // campagna" di DettaglioCampagneEsteso, che può essere aperta indipendentemente dal filtro
    // campagne delle tessere.
    const perCampagna = breakdownGhlPerCampagna(appuntamentiPrimi, opportunitaVinte, mappaCampagna, startMs, endMs);
    const campagneAttribuibili = Object.keys(perCampagna).length > 0;

    // Scoping per le tessere/grafici: se è stato richiesto un sottoinsieme di campagne, si restringe
    // ai soli contatti la cui mappaCampagna cade in quel sottoinsieme — altrimenti tutta la sede,
    // comportamento identico a prima di questa feature.
    const appartieneAlFiltro = (contactId: string) => {
      if (!campagneFiltro) return true;
      const campaignId = mappaCampagna.get(contactId);
      return campaignId !== undefined && campagneFiltro.has(campaignId);
    };
    const appuntamentiScoped = campagneFiltro ? appuntamentiPrimi.filter((a) => appartieneAlFiltro(a.contactId)) : appuntamentiPrimi;
    const opportunitaScoped = campagneFiltro ? opportunitaVinte.filter((o) => appartieneAlFiltro(o.contactId)) : opportunitaVinte;

    const risposta: GhlRiepilogoResponse = {
      connesso: true,
      calendariConfigurati: connessione.calendarIds.length > 0,
      appuntamenti: riepilogoAppuntamenti(appuntamentiScoped, startMs, endMs),
      opportunita: riepilogoOpportunita(opportunitaScoped, startMs, endMs),
      fatturatoPerSettimana: fatturatoGhlPerSettimana(opportunitaScoped, startMs, endMs),
      // Vuoto se calendari non ancora scelti — stesso motivo di appuntamenti sopra (0 non sarebbe
      // un dato vero), vedi il commento su appuntamentiPerSettimana in types/ghl.ts.
      appuntamentiPerSettimana:
        connessione.calendarIds.length > 0 ? appuntamentiGhlPerSettimana(appuntamentiScoped, startMs, endMs) : [],
      calendariFalliti,
      perCampagna,
      campagneAttribuibili,
    };
    return NextResponse.json(risposta);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: `Errore dal collegamento GHL: ${msg}` }, { status: 502 });
  }
}
