import { getAttivitaCliente, getCampagne, getClienti, getConsulenti, getMeetingCliente, getMetaDaily, getSedi } from "@/lib/archivio";
import { inviaEmailInterna } from "@/lib/gmail";
import { fetchSpesaCampagne } from "@/lib/meta";
import { componiRiepilogoAdmin, vociDaGuardare, type DatiMetaFermi, type RiepilogoAdmin } from "@/lib/riepilogoAdmin";
import { oggiIso } from "@/lib/roadmap";
import { costruisciSaluteClienti, finestraSalute } from "@/lib/saluteClienti";
import { diagnosticaDatiFermi, sediConDatiMetaFermi } from "@/lib/sincronizzazioneMeta";

/**
 * La parte del riepilogo per l'amministrazione che legge i dati e spedisce (il comporre sta in
 * src/lib/riepilogoAdmin.ts, puro). La usano l'invio programmato del lunedì
 * (/api/cron/riepilogo-admin) e la sezione "Notifiche" delle Impostazioni (anteprima e "Manda ora").
 *
 * A chi e da chi: di norma la casella dell'agenzia scrive a sé stessa. Si cambiano con due variabili
 * d'ambiente, senza toccare il codice — RIEPILOGO_ADMIN_DESTINATARI (uno o più indirizzi separati da
 * virgola) e RIEPILOGO_ADMIN_MITTENTE (una casella vera del dominio: l'invio parte "come" lei).
 */
const CASELLA_AGENZIA = "info@andrealenziconsulting.com";
const INDIRIZZO_APP = "https://app.andrealenziconsulting.com";

export function destinatariRiepilogo(): string[] {
  const scelti = (process.env.RIEPILOGO_ADMIN_DESTINATARI ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return scelti.length > 0 ? scelti : [CASELLA_AGENZIA];
}

export function mittenteRiepilogo(): string {
  return process.env.RIEPILOGO_ADMIN_MITTENTE?.trim() || CASELLA_AGENZIA;
}

/** L'indirizzo dell'app nei link dell'email: quello pubblico, a meno che APP_URL dica altro. */
export function indirizzoApp(): string {
  return (process.env.APP_URL?.trim() || INDIRIZZO_APP).replace(/\/+$/, "");
}

/** Legge i dati di tutti i clienti attivi e compone il riepilogo. Non spedisce nulla. */
export async function preparaRiepilogoAdmin(oggi: string = oggiIso()): Promise<RiepilogoAdmin> {
  const [clienti, metaDaily, campagne, attivita, consulenti, sedi, meeting] = await Promise.all([
    getClienti(),
    getMetaDaily(),
    getCampagne(),
    getAttivitaCliente(),
    getConsulenti(),
    getSedi(),
    getMeetingCliente(),
  ]);
  const attivi = clienti.filter((c) => c.attivo);
  const { da, a } = finestraSalute(oggi);
  const items = costruisciSaluteClienti({ clienti: attivi, sedi, campagne, metaDaily, attivita, meeting, da, a, oggi });

  // Dati Meta fermi: lo stesso controllo dell'avviso in cima alla pagina Clienti. La verifica dal vivo
  // su Meta parte solo per le sedi candidate; se fallisce, il riepilogo esce comunque senza quel pezzo.
  let datiFermi: DatiMetaFermi[] = [];
  try {
    const idAttivi = new Set(attivi.map((c) => c.clienteId));
    const sediAttive = sedi.filter((s) => idAttivi.has(s.clienteId));
    const problemi = await diagnosticaDatiFermi(sediConDatiMetaFermi({ sedi: sediAttive, campagne, metaDaily, oggi }), oggi, fetchSpesaCampagne);
    datiFermi = problemi.map((p) => ({
      nomeCliente: attivi.find((c) => c.clienteId === p.clienteId)?.nome ?? p.clienteId,
      nomeSede: sediAttive.filter((s) => s.clienteId === p.clienteId && s.attivo).length > 1 ? (sediAttive.find((s) => s.sedeId === p.sedeId)?.nome ?? null) : null,
      ultimoGiorno: p.ultimoGiorno,
      causa: p.causa,
    }));
  } catch {
    datiFermi = [];
  }

  const app = indirizzoApp();
  return componiRiepilogoAdmin({ voci: vociDaGuardare({ items, consulenti, oggi, indirizzoApp: app }), datiFermi, clientiValutati: attivi.length, da, a, oggi, indirizzoApp: app });
}

/** Compone il riepilogo e lo spedisce. Torna cosa ha spedito e a quanti indirizzi. */
export async function inviaRiepilogoAdmin(oggi: string = oggiIso()): Promise<{ oggetto: string; clientiDaGuardare: number; datiFermi: number; destinatari: number }> {
  const riepilogo = await preparaRiepilogoAdmin(oggi);
  const destinatari = destinatariRiepilogo();
  await inviaEmailInterna({ mittenteNome: "Meta Manager ALC", mittenteEmail: mittenteRiepilogo(), destinatari, oggetto: riepilogo.oggetto, testo: riepilogo.testo, html: riepilogo.html });
  return { oggetto: riepilogo.oggetto, clientiDaGuardare: riepilogo.clientiDaGuardare, datiFermi: riepilogo.datiFermi, destinatari: destinatari.length };
}
