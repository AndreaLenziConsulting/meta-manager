import { NextResponse } from "next/server";
import { destinatariRiepilogo, inviaRiepilogoAdmin, preparaRiepilogoAdmin } from "@/lib/riepilogoAdminInvio";
import { erroreRisposta, messaggioDi, rifiutoSeNonAdmin } from "@/lib/soloAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Il riepilogo per l'amministrazione visto dalla sezione "Notifiche" delle Impostazioni. Solo
 * amministratore. GET lo compone e lo restituisce com'è adesso, senza spedire nulla (l'anteprima);
 * POST lo spedisce subito, agli stessi indirizzi dell'invio del lunedì.
 */
export async function GET() {
  const rifiuto = await rifiutoSeNonAdmin("vedere il riepilogo per l'amministrazione");
  if (rifiuto) return rifiuto;
  try {
    const riepilogo = await preparaRiepilogoAdmin();
    return NextResponse.json({ oggetto: riepilogo.oggetto, html: riepilogo.html, clientiDaGuardare: riepilogo.clientiDaGuardare, destinatari: destinatariRiepilogo() });
  } catch (err) {
    return erroreRisposta(messaggioDi(err, "Non riesco a comporre il riepilogo"), 502);
  }
}

export async function POST() {
  const rifiuto = await rifiutoSeNonAdmin("mandare il riepilogo per l'amministrazione");
  if (rifiuto) return rifiuto;
  try {
    return NextResponse.json({ ok: true, ...(await inviaRiepilogoAdmin()) });
  } catch (err) {
    return erroreRisposta(`L'email non è partita: ${messaggioDi(err, "errore sconosciuto")}`, 502);
  }
}
