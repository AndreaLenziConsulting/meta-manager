import { describe, expect, it } from "vitest";
import { idCartellaDaUrl, nomeCartellaPrincipale, nomeCartellaReport, nomeFileReport } from "@/lib/driveNomi";

describe("nomeCartellaPrincipale", () => {
  it("compone ragione sociale e suffisso", () => {
    expect(nomeCartellaPrincipale("Mobilieri Bianchi")).toBe("Mobilieri Bianchi | COMMERCIALE ANDREA LENZI CONSULTING");
  });

  it("elimina spazi superflui ai bordi", () => {
    expect(nomeCartellaPrincipale("  Rossi Srl  ")).toBe("Rossi Srl | COMMERCIALE ANDREA LENZI CONSULTING");
  });
});

describe("nomeCartellaReport", () => {
  it("compone il prefisso fisso e la ragione sociale", () => {
    expect(nomeCartellaReport("Mobilieri Bianchi")).toBe("Report chiamate | Mobilieri Bianchi");
  });
});

describe("nomeFileReport", () => {
  it("sanitizza la data (slash non ammesso in un nome file su Drive Desktop)", () => {
    expect(nomeFileReport("12/09/2026")).toBe("Report chiamata 12-09-2026.pdf");
  });

  it("aggiunge il titolo quando presente, sanitizzato allo stesso modo", () => {
    expect(nomeFileReport("12/09/2026", "Call 20/08")).toBe("Report chiamata 12-09-2026 - Call 20-08.pdf");
  });

  it("ignora un titolo vuoto/solo spazi", () => {
    expect(nomeFileReport("12/09/2026", "   ")).toBe("Report chiamata 12-09-2026.pdf");
  });
});

describe("idCartellaDaUrl", () => {
  it("estrae l'id da un link cartella standard", () => {
    expect(idCartellaDaUrl("https://drive.google.com/drive/folders/1AbC-23_xyz")).toBe("1AbC-23_xyz");
  });

  it("estrae l'id anche con query string dopo", () => {
    expect(idCartellaDaUrl("https://drive.google.com/drive/folders/1AbC?usp=sharing")).toBe("1AbC");
  });

  it("ritorna null per un link non riconosciuto", () => {
    expect(idCartellaDaUrl("https://drive.google.com/file/d/1AbC/view")).toBeNull();
    expect(idCartellaDaUrl("non un url")).toBeNull();
    expect(idCartellaDaUrl("")).toBeNull();
  });
});
