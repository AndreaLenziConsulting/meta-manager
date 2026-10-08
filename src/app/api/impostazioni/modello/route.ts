import { NextRequest, NextResponse } from "next/server";
import { generaTaskIdManuale } from "@/lib/accessCode";
import { eliminaTemplateTask, getProdotti, getTemplateAttivita, riordinaTemplateAttivita, salvaTemplateTask } from "@/lib/archivio";
import { controllaTaskModello, ordineConNuova, stessiElementi } from "@/lib/impostazioni";
import { erroreRisposta, messaggioDi, rifiutoSeNonAdmin } from "@/lib/soloAdmin";
import type { TemplateTask } from "@/types/kpi";

export const runtime = "nodejs";

/**
 * Il modello di attività di un prodotto: l'elenco da cui nasce la roadmap di ogni nuovo cliente con
 * quel prodotto. Solo amministratore. Modificarlo non tocca le roadmap dei clienti che ci sono già:
 * le loro attività sono state copiate dal modello quando sono nate.
 */

async function modelloDi(prodottoId: string): Promise<TemplateTask[] | null> {
  const [prodotti, modello] = await Promise.all([getProdotti(), getTemplateAttivita()]);
  if (!prodotti.some((p) => p.prodottoId === prodottoId)) return null;
  return modello.filter((t) => t.prodottoId === prodottoId).sort((a, b) => a.ordine - b.ordine);
}

type BodyTask = Partial<Record<keyof TemplateTask, unknown>> & { dopoTaskId?: string };

/** Aggiunge un'attività: in fondo, oppure subito dopo `dopoTaskId`. */
export async function POST(req: NextRequest) {
  const rifiuto = await rifiutoSeNonAdmin("modificare i modelli di attività");
  if (rifiuto) return rifiuto;

  const body = (await req.json().catch(() => ({}))) as BodyTask;
  const prodottoId = typeof body.prodottoId === "string" ? body.prodottoId.trim() : "";
  if (!prodottoId) return erroreRisposta("Prodotto non indicato", 400);
  const controllo = controllaTaskModello(body);
  if (!controllo.ok) return erroreRisposta(controllo.errore, 400);

  const modello = await modelloDi(prodottoId);
  if (!modello) return erroreRisposta("Prodotto non trovato", 404);

  const taskId = generaTaskIdManuale(controllo.dati.descrizione, new Set(modello.map((t) => t.taskId)));
  try {
    await salvaTemplateTask({ ...controllo.dati, prodottoId, taskId, ordine: modello.length + 1 });
    await riordinaTemplateAttivita(prodottoId, ordineConNuova(modello.map((t) => t.taskId), taskId, typeof body.dopoTaskId === "string" ? body.dopoTaskId : undefined));
  } catch (err) {
    return erroreRisposta(messaggioDi(err, "Errore nella creazione"), 502);
  }
  return NextResponse.json({ taskId }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const rifiuto = await rifiutoSeNonAdmin("modificare i modelli di attività");
  if (rifiuto) return rifiuto;

  const body = (await req.json().catch(() => ({}))) as BodyTask;
  const prodottoId = typeof body.prodottoId === "string" ? body.prodottoId.trim() : "";
  const taskId = typeof body.taskId === "string" ? body.taskId : "";
  if (!prodottoId || !taskId) return erroreRisposta("Attività non indicata", 400);
  const controllo = controllaTaskModello(body);
  if (!controllo.ok) return erroreRisposta(controllo.errore, 400);

  const attuale = (await modelloDi(prodottoId))?.find((t) => t.taskId === taskId);
  if (!attuale) return erroreRisposta("Attività non trovata nel modello", 404);

  try {
    await salvaTemplateTask({ ...controllo.dati, prodottoId, taskId, ordine: attuale.ordine });
  } catch (err) {
    return erroreRisposta(messaggioDi(err, "Errore nel salvataggio"), 502);
  }
  return NextResponse.json({ ok: true });
}

/** Riordina: `ordine` è l'elenco di tutti i taskId del modello, nel nuovo ordine. */
export async function PUT(req: NextRequest) {
  const rifiuto = await rifiutoSeNonAdmin("modificare i modelli di attività");
  if (rifiuto) return rifiuto;

  const body = (await req.json().catch(() => ({}))) as { prodottoId?: string; ordine?: unknown };
  const prodottoId = body.prodottoId?.trim();
  if (!prodottoId) return erroreRisposta("Prodotto non indicato", 400);
  const ordine = Array.isArray(body.ordine) && body.ordine.every((id) => typeof id === "string") ? (body.ordine as string[]) : null;
  if (!ordine) return erroreRisposta("Ordine non valido", 400);

  const modello = await modelloDi(prodottoId);
  if (!modello) return erroreRisposta("Prodotto non trovato", 404);
  // Se nel frattempo il modello è cambiato (un'attività aggiunta o tolta da un'altra scheda), l'ordine
  // proposto non lo descrive più: meglio dirlo che riordinare a metà.
  if (!stessiElementi(modello.map((t) => t.taskId), ordine)) {
    return erroreRisposta("Il modello è cambiato nel frattempo: ricarica la pagina e riprova", 409);
  }

  try {
    await riordinaTemplateAttivita(prodottoId, ordine);
  } catch (err) {
    return erroreRisposta(messaggioDi(err, "Errore nel riordino"), 502);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const rifiuto = await rifiutoSeNonAdmin("modificare i modelli di attività");
  if (rifiuto) return rifiuto;

  const prodottoId = req.nextUrl.searchParams.get("prodottoId")?.trim();
  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!prodottoId || !taskId) return erroreRisposta("Attività non indicata", 400);

  try {
    await eliminaTemplateTask(prodottoId, taskId);
  } catch (err) {
    return erroreRisposta(messaggioDi(err, "Errore nell'eliminazione"), 404);
  }
  return NextResponse.json({ ok: true });
}
