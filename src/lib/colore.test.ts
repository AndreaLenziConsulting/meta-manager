import { describe, expect, it } from "vitest";
import { isHexValido, scurisci, schiarisci } from "@/lib/colore";

describe("isHexValido", () => {
  it("accetta #RRGGBB maiuscolo o minuscolo", () => {
    expect(isHexValido("#76943C")).toBe(true);
    expect(isHexValido("#76943c")).toBe(true);
  });

  it("rifiuta formati non validi", () => {
    expect(isHexValido("76943C")).toBe(false); // manca #
    expect(isHexValido("#76943")).toBe(false); // troppo corto
    expect(isHexValido("#GGGGGG")).toBe(false); // non hex
    expect(isHexValido("")).toBe(false);
  });
});

describe("scurisci", () => {
  it("con frazione 0 ritorna il colore invariato", () => {
    expect(scurisci("#76943C", 0)).toBe("#76943c");
  });

  it("con frazione 1 ritorna nero", () => {
    expect(scurisci("#76943C", 1)).toBe("#000000");
  });

  it("con frazione intermedia scurisce ogni canale proporzionalmente", () => {
    expect(scurisci("#76943C", 0.5)).toBe("#3b4a1e");
  });
});

describe("schiarisci", () => {
  it("con frazione 0 ritorna il colore invariato", () => {
    expect(schiarisci("#D6DE3F", 0)).toBe("#d6de3f");
  });

  it("con frazione 1 ritorna bianco", () => {
    expect(schiarisci("#D6DE3F", 1)).toBe("#ffffff");
  });

  it("con frazione alta produce una tinta quasi bianca", () => {
    const risultato = schiarisci("#D6DE3F", 0.85);
    expect(risultato).toBe("#f9fae2");
  });
});
