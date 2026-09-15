import type { ReportCommercialeDataLoose } from "@/types/prospect";

/**
 * Bozza email di follow-up commerciale — stesso pattern di src/lib/meetingEmail.ts (logica pura,
 * nessuna chiamata API, genera solo testo) ma copy di vendita invece che recap di meeting.
 */
const COMPANY_NAME = "Andrea Lenzi Consulting";

function righe(valore: string | undefined): string[] {
  return (valore ?? "").split("\n").map((r) => r.trim()).filter(Boolean);
}

export function buildEmailTextCommerciale(report: ReportCommercialeDataLoose, ragioneSocialeFallback: string, commercialeNome: string): string {
  const out: string[] = [];
  const push = (s: string = "") => out.push(s);

  const ragioneSociale = report.ragioneSociale || ragioneSocialeFallback;
  const data = report.data || "";
  push(`Oggetto: Recap chiamata ${ragioneSociale ? `— ${ragioneSociale}` : ""} ${data}`.trim());
  push();

  push("Ciao,");
  push();
  push(`grazie per il tempo dedicato alla chiamata di ${data ? `oggi (${data})` : "oggi"} — ti riassumo quanto discusso.`);
  push();

  // Titoli di sezione tra **doppi asterischi**: convenzione markdown-like riconosciuta da
  // gmail.ts (vedi testoAHtml) per mettere in grassetto solo questi nell'html effettivamente
  // inviato — nella bozza testuale (questa stringa, editabile a mano prima dell'invio, vedi
  // ProspectTab.tsx) restano visibili come marcatori leggeri, non rumore.
  const quadroEmerso = righe(report.quadroEmerso);
  if (quadroEmerso.length > 0) {
    push("**Quadro emerso**");
    for (const r of quadroEmerso) push(`• ${r}`);
    push();
  }

  const obiettivi = righe(report.obiettivi);
  if (obiettivi.length > 0) {
    push("**I tuoi obiettivi**");
    for (const o of obiettivi) push(`• ${o}`);
    push();
  }

  const strategia = righe(report.strategiaProposta);
  if (strategia.length > 0) {
    push("**La strategia che ti proponiamo**");
    for (const s of strategia) push(`• ${s}`);
    push();
  }

  const soluzione = righe(report.soluzioneProposta);
  if (soluzione.length > 0) {
    push("**Il servizio nel dettaglio**");
    for (const s of soluzione) push(`• ${s}`);
    push();
  }

  const prossimiPassi = righe(report.prossimiPassi);
  if (prossimiPassi.length > 0) {
    push("**Prossimi passi**");
    prossimiPassi.forEach((p, i) => push(`${i + 1}. ${p}`));
    push();
  }

  push("Trovi tutti i dettagli nel report allegato.");
  push();
  if (report.rawUrl) {
    push(`Recording completo: ${report.rawUrl}`);
    push();
  }
  push("A presto,");
  push(commercialeNome || "[Il tuo nome]");
  push(COMPANY_NAME);

  return out.join("\n");
}

/**
 * Separa la prima riga "Oggetto: ..." dal resto del corpo — identico a
 * src/lib/meetingEmail.ts#separaOggettoECorpo (stesso formato, stesso motivo: invio reale via
 * Gmail con Subject/body separati, vedi src/lib/gmail.ts).
 */
export function separaOggettoECorpo(testoEmail: string): { oggetto: string; corpo: string } {
  const rigaTeste = testoEmail.split("\n");
  const prima = rigaTeste[0] ?? "";
  const match = prima.match(/^Oggetto:\s*(.*)$/);
  if (!match) {
    return { oggetto: "", corpo: testoEmail };
  }
  const resto = rigaTeste.slice(1);
  if (resto[0] === "") resto.shift();
  return { oggetto: match[1].trim(), corpo: resto.join("\n") };
}
