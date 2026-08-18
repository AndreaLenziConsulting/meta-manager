import { describe, expect, it } from "vitest";
import { costruisciOpzioniEmail, type InvioEmailMeetingInput } from "./gmail";

const INPUT_TEST: InvioEmailMeetingInput = {
  consulenteNome: "Andrea Lenzi",
  consulenteEmail: "andrea@andrealenziconsulting.com",
  clienteEmail: "referente@mobilieri.it",
  oggetto: "Follow-up meeting — Mobilieri 27/07/2026",
  corpo: "Ciao,\n\ngrazie per il confronto di oggi.",
  allegatoPdf: Buffer.from("finto-pdf"),
  nomeAllegato: "report-mobilieri.pdf",
};

describe("costruisciOpzioniEmail", () => {
  it("popola mittente (nome + email consulente), destinatario, oggetto e corpo", () => {
    const opts = costruisciOpzioniEmail(INPUT_TEST);
    expect(opts.from).toEqual({ name: "Andrea Lenzi", address: "andrea@andrealenziconsulting.com" });
    expect(opts.to).toBe("referente@mobilieri.it");
    expect(opts.subject).toBe("Follow-up meeting — Mobilieri 27/07/2026");
    expect(opts.text).toBe("Ciao,\n\ngrazie per il confronto di oggi.");
  });

  it("allega il PDF con nome file e content-type corretti", () => {
    const opts = costruisciOpzioniEmail(INPUT_TEST);
    expect(opts.attachments).toHaveLength(1);
    expect(opts.attachments[0]).toEqual({
      filename: "report-mobilieri.pdf",
      content: INPUT_TEST.allegatoPdf,
      contentType: "application/pdf",
    });
  });
});
