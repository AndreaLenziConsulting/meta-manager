import { describe, expect, it } from "vitest";
import { temaPdfCliente } from "./pdfFonts";
import type { CampiTema } from "@/lib/temaCliente";

const FALLBACK = { colore: "#1a74bc", coloreChiaro: "#e8f1f9", coloreMedio: "#d6e8f5" };

function cliente(over: Partial<CampiTema>): CampiTema {
  return { colorePrimario: "", coloreSecondario: "", fontPersonalizzato: "", ...over };
}

describe("temaPdfCliente", () => {
  it("nessuna personalizzazione -> resta sui default ALC (colore/font)", () => {
    const t = temaPdfCliente(cliente({}), FALLBACK);
    expect(t).toEqual({
      colore: "#1a74bc",
      coloreChiaro: "#e8f1f9",
      coloreMedio: "#d6e8f5",
      fontHeading: "League Spartan",
      fontBody: "Roboto",
    });
  });

  it("solo colorePrimario valido -> sostituisce solo colore, chiaro/medio restano di default", () => {
    const t = temaPdfCliente(cliente({ colorePrimario: "#ff0000" }), FALLBACK);
    expect(t.colore).toBe("#ff0000");
    expect(t.coloreChiaro).toBe(FALLBACK.coloreChiaro);
    expect(t.coloreMedio).toBe(FALLBACK.coloreMedio);
  });

  it("solo coloreSecondario valido -> deriva chiaro/medio, colore resta di default", () => {
    const t = temaPdfCliente(cliente({ coloreSecondario: "#00ff00" }), FALLBACK);
    expect(t.colore).toBe(FALLBACK.colore);
    // schiarisci verso il bianco: più la frazione è alta, più il risultato è vicino a #ffffff
    expect(t.coloreChiaro).not.toBe(FALLBACK.coloreChiaro);
    expect(t.coloreMedio).not.toBe(FALLBACK.coloreMedio);
    expect(t.coloreChiaro).not.toBe(t.coloreMedio); // frazioni diverse (0.85 vs 0.65) -> tinte diverse
  });

  it("hex non valido -> ignorato, resta sul default (non un crash su una stringa a caso)", () => {
    const t = temaPdfCliente(cliente({ colorePrimario: "non-un-colore" }), FALLBACK);
    expect(t.colore).toBe(FALLBACK.colore);
  });

  it("fontPersonalizzato valido (poppins) -> sostituisce SIA heading SIA body", () => {
    const t = temaPdfCliente(cliente({ fontPersonalizzato: "poppins" }), FALLBACK);
    expect(t.fontHeading).toBe("Poppins");
    expect(t.fontBody).toBe("Poppins");
  });

  it("fontPersonalizzato valido (dm-sans) -> sostituisce SIA heading SIA body", () => {
    const t = temaPdfCliente(cliente({ fontPersonalizzato: "dm-sans" }), FALLBACK);
    expect(t.fontHeading).toBe("DM Sans");
    expect(t.fontBody).toBe("DM Sans");
  });

  it("fontPersonalizzato non in whitelist -> ignorato, resta sui default ALC", () => {
    const t = temaPdfCliente(cliente({ fontPersonalizzato: "comic-sans" }), FALLBACK);
    expect(t.fontHeading).toBe("League Spartan");
    expect(t.fontBody).toBe("Roboto");
  });

  it("colore e font insieme -> entrambi applicati indipendentemente", () => {
    const t = temaPdfCliente(cliente({ colorePrimario: "#123456", coloreSecondario: "#654321", fontPersonalizzato: "poppins" }), FALLBACK);
    expect(t.colore).toBe("#123456");
    expect(t.fontHeading).toBe("Poppins");
    expect(t.fontBody).toBe("Poppins");
    expect(t.coloreChiaro).not.toBe(FALLBACK.coloreChiaro);
  });
});
