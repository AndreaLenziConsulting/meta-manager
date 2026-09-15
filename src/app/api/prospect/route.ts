import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { aggiornaProspect, getCommerciali, getConsulenti, getProspect } from "@/lib/sheets";
import { puoVedereProspect } from "@/lib/authz";
import { condividiCartellaConConsulente, prospectDaCondividere } from "@/lib/driveAccesso";
import { creaProspectConCartellaDrive } from "@/lib/prospectCreazione";
import type { CalcolatoreBudgetInput } from "@/types/prospect";

export const runtime = "nodejs";

type Body = {
  ragioneSociale?: string;
  tipoBusiness?: string;
  fatturato?: string;
  sedi?: string;
  email?: string;
  // Solo per l'admin: quale commerciale possiede il prospect (per un commerciale è sempre e solo
  // sé stesso, vedi sotto — il campo qui viene ignorato in quel caso).
  commercialeId?: string;
};

/**
 * Crea un nuovo prospect. Un commerciale lo assegna sempre a sé stesso (comportamento originale,
 * invariato); l'admin può crearne uno per conto di un commerciale specifico, scelto esplicitamente
 * nel form (mai un default implicito: un prospect senza commerciale assegnato non comparirebbe a
 * nessuno in prospectVisibili).
 */
export async function POST(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "commerciale" && sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo un commerciale o l'amministratore possono creare un prospect" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const ragioneSociale = body.ragioneSociale?.trim();
  if (!ragioneSociale) {
    return NextResponse.json({ error: "Ragione sociale obbligatoria" }, { status: 400 });
  }

  const commerciali = await getCommerciali();

  let commercialeId: string;
  if (sessione.ruolo === "commerciale") {
    if (!sessione.commercialeId) {
      return NextResponse.json({ error: "Sessione commerciale non valida" }, { status: 401 });
    }
    commercialeId = sessione.commercialeId;
  } else {
    const richiesto = body.commercialeId?.trim();
    if (!richiesto) {
      return NextResponse.json({ error: "Commerciale di riferimento obbligatorio" }, { status: 400 });
    }
    if (!commerciali.some((c) => c.commercialeId === richiesto && c.attivo)) {
      return NextResponse.json({ error: "Commerciale non valido" }, { status: 400 });
    }
    commercialeId = richiesto;
  }

  let prospectId: string;
  try {
    prospectId = await creaProspectConCartellaDrive(
      {
        ragioneSociale,
        tipoBusiness: body.tipoBusiness?.trim(),
        fatturato: body.fatturato?.trim(),
        sedi: body.sedi?.trim(),
        email: body.email?.trim(),
        commercialeId,
      },
      commerciali
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore nella creazione" }, { status: 502 });
  }

  return NextResponse.json({ prospectId }, { status: 201 });
}

type BodyPatch = {
  prospectId?: string;
  driveFolderUrl?: string;
  mediaBudgetMensile?: number | null;
  targetCpl?: number | null;
  targetCpaAppuntamento?: number | null;
  targetLeadSettimana?: number | null;
  targetAppuntamentiSettimana?: number | null;
  targetFatturatoMensile?: number | null;
  targetMargineVenditaPct?: number | null;
  // Proposta di conversione (vedi Prospect.consulenteSuggeritoId) — un commerciale la imposta sui
  // propri prospect, "" per ritirarla. Non basta a creare il Cliente: solo un suggerimento, la
  // conversione vera resta un'azione admin (POST /api/prospect/converti).
  consulenteSuggeritoId?: string;
  // Calcolatore Budget del prospect (sezione a parte, vedi /dashboard/commerciale/[prospectId]/calcolatore
  // e CalcolatoreBudgetProspect.tsx) — un oggetto intero sovrascritto ogni volta (mai un merge
  // parziale campo per campo come i numeri sopra), stesso schema di salvaReportCommerciale per
  // ReportCommerciale.dati. `null` esplicito cancella il calcolatore compilato.
  calcolatoreBudget?: CalcolatoreBudgetInput | null;
};

const CAMPI_NUMERICI = [
  "mediaBudgetMensile",
  "targetCpl",
  "targetCpaAppuntamento",
  "targetLeadSettimana",
  "targetAppuntamentiSettimana",
  "targetFatturatoMensile",
  "targetMargineVenditaPct",
] as const;

const CAMPI_CALCOLATORE = ["fatturatoMensile", "ticketMedio", "margine", "cpl", "tassoAppuntamento", "tassoChiusura", "variazioneStagionale"] as const;

/** True se `v` ha la forma di CalcolatoreBudgetInput — solo le chiavi attese, ognuna number|null. */
function isCalcolatoreBudgetValido(v: unknown): v is CalcolatoreBudgetInput {
  if (v === null || typeof v !== "object") return false;
  const obj = v as Record<string, unknown>;
  return CAMPI_CALCOLATORE.every((campo) => obj[campo] === null || typeof obj[campo] === "number");
}

/**
 * Modifica i dati commerciali di un prospect esistente (cartella Drive + parametri target, vedi
 * types/prospect.ts) — l'anagrafica vera e propria (ragioneSociale/tipoBusiness/fatturato/sedi)
 * resta gestita solo dall'estrazione automatica del report (vedi POST /api/report-commerciale),
 * non da questa route. Un commerciale può modificare solo i propri prospect, l'admin qualsiasi.
 */
export async function PATCH(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (sessione.ruolo !== "commerciale" && sessione.ruolo !== "admin") {
    return NextResponse.json({ error: "Solo un commerciale o l'amministratore possono modificare un prospect" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as BodyPatch;
  const prospectId = body.prospectId?.trim();
  if (!prospectId) {
    return NextResponse.json({ error: "prospectId obbligatorio" }, { status: 400 });
  }

  const tutti = await getProspect();
  if (!puoVedereProspect(sessione, prospectId, tutti)) {
    return NextResponse.json({ error: "Prospect non trovato" }, { status: 404 });
  }

  for (const campo of CAMPI_NUMERICI) {
    const v = body[campo];
    if (v !== undefined && v !== null && !Number.isFinite(v)) {
      return NextResponse.json({ error: `${campo} non valido` }, { status: 400 });
    }
  }
  if (body.targetMargineVenditaPct != null && (body.targetMargineVenditaPct < 0 || body.targetMargineVenditaPct > 100)) {
    return NextResponse.json({ error: "targetMargineVenditaPct deve essere tra 0 e 100" }, { status: 400 });
  }
  if (body.calcolatoreBudget !== undefined && body.calcolatoreBudget !== null && !isCalcolatoreBudgetValido(body.calcolatoreBudget)) {
    return NextResponse.json({ error: "calcolatoreBudget non valido" }, { status: 400 });
  }
  const consulenteSuggeritoId = body.consulenteSuggeritoId !== undefined ? body.consulenteSuggeritoId.trim() : undefined;
  if (consulenteSuggeritoId) {
    const consulenti = await getConsulenti();
    if (!consulenti.some((c) => c.consulenteId === consulenteSuggeritoId && c.attivo)) {
      return NextResponse.json({ error: "Consulente suggerito non valido" }, { status: 400 });
    }
  }

  const driveFolderUrlNuovo = body.driveFolderUrl !== undefined ? body.driveFolderUrl.trim() : undefined;

  try {
    await aggiornaProspect({
      prospectId,
      driveFolderUrl: driveFolderUrlNuovo,
      mediaBudgetMensile: body.mediaBudgetMensile,
      targetCpl: body.targetCpl,
      targetCpaAppuntamento: body.targetCpaAppuntamento,
      targetLeadSettimana: body.targetLeadSettimana,
      targetAppuntamentiSettimana: body.targetAppuntamentiSettimana,
      targetFatturatoMensile: body.targetFatturatoMensile,
      targetMargineVenditaPct: body.targetMargineVenditaPct,
      consulenteSuggeritoId,
      calcolatoreBudget: body.calcolatoreBudget,
    });

    // Cartella Drive impostata/corretta a mano (vedi ProspectDatiCommerciali.tsx) — stessa
    // condivisione col commerciale assegnato applicata alla creazione (POST sopra), altrimenti un
    // prospect il cui link viene sistemato a mano dopo resterebbe senza.
    if (driveFolderUrlNuovo) {
      const prospect = tutti.find((p) => p.prospectId === prospectId);
      if (prospect) {
        const commerciali = await getCommerciali();
        const emailPerCommerciale = new Map(commerciali.map((c) => [c.commercialeId, c.email]));
        const decisione = prospectDaCondividere({ driveFolderUrl: driveFolderUrlNuovo, commercialeId: prospect.commercialeId }, emailPerCommerciale);
        if (decisione) {
          await condividiCartellaConConsulente(driveFolderUrlNuovo, decisione.emailCommerciale).catch(() => {});
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore nel salvataggio" }, { status: 502 });
  }
}
