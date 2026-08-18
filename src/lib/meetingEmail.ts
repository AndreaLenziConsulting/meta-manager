import type { MeetingDataLoose } from "@/types/meeting";

/**
 * Bozza email di follow-up — porting di `buildEmailText` da `EmailTemplate.tsx` in Fast Report.
 * Logica pura, nessuna chiamata API: gira lato client in MeetingTab.tsx. Genera solo testo da
 * copiare negli appunti — nessun invio reale, come nell'originale.
 *
 * `clienteNome` è un parametro esplicito (mai `meeting.cliente`, testo libero dell'LLM sempre
 * ignorato — vedi types/meeting.ts), a differenza dell'originale che usava `data.cliente`.
 */
const COMPANY_NAME = "Andrea Lenzi Consulting";

export function buildEmailText(meeting: MeetingDataLoose, clienteNome: string): string {
  const out: string[] = [];
  const push = (s: string = "") => out.push(s);

  const date = meeting.dataConsulenza || meeting.date || "";
  push(`Oggetto: Follow-up meeting ${clienteNome ? `— ${clienteNome}` : ""} ${date}`.trim());
  push();

  push("Ciao,");
  push();
  push(`grazie per il confronto di ${date ? `oggi (${date})` : "oggi"} — ti mando un breve recap così restiamo allineati.`);
  push();

  if (meeting.summary) {
    push("In sintesi:");
    push(meeting.summary.trim());
    push();
  }

  const highlights = meeting.highlights ?? [];
  if (highlights.length > 0) {
    push("Punti chiave emersi:");
    for (const hl of highlights) push(`• ${hl}`);
    push();
  }

  const actionItems = meeting.actionItems ?? [];
  if (actionItems.length > 0) {
    push("Next steps:");
    actionItems.forEach((item, i) => {
      const who = item.assignee ? ` [${item.assignee}]` : "";
      push(`${i + 1}. ${item.text}${who}`);
    });
    push();
  }

  push("Trovi tutti i dettagli nel report allegato.");
  push();
  if (meeting.rawUrl) {
    push(`Recording completo: ${meeting.rawUrl}`);
    push();
  }
  push("A presto,");
  push(meeting.referente || "[Il tuo nome]");
  push(COMPANY_NAME);

  return out.join("\n");
}

/**
 * Separa la prima riga "Oggetto: ..." dal resto del corpo — serve all'invio reale via Gmail
 * (Subject/body separati, vedi src/lib/gmail.ts), senza toccare `buildEmailText` (usata anche dal
 * flusso di copia manuale, dove il formato con "Oggetto:" in testa è voluto, per incollarlo a
 * mano nel proprio client di posta).
 */
export function separaOggettoECorpo(testoEmail: string): { oggetto: string; corpo: string } {
  const righe = testoEmail.split("\n");
  const prima = righe[0] ?? "";
  const match = prima.match(/^Oggetto:\s*(.*)$/);
  if (!match) {
    return { oggetto: "", corpo: testoEmail };
  }
  // La riga vuota subito dopo "Oggetto: ..." è solo separazione visiva nel testo da copiare —
  // va tolta dal corpo effettivo, altrimenti l'email inviata inizierebbe con una riga vuota in più.
  const resto = righe.slice(1);
  if (resto[0] === "") resto.shift();
  return { oggetto: match[1].trim(), corpo: resto.join("\n") };
}
