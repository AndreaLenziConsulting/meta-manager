import { describe, expect, it } from "vitest";
import { isFontClienteValido, styleTemaCliente } from "@/lib/temaCliente";

function clienteVuoto(overrides: Partial<{ colorePrimario: string; coloreSecondario: string; fontPersonalizzato: string }> = {}) {
  return { colorePrimario: "", coloreSecondario: "", fontPersonalizzato: "", ...overrides };
}

describe("styleTemaCliente", () => {
  it("ritorna undefined senza alcuna personalizzazione", () => {
    expect(styleTemaCliente(clienteVuoto())).toBeUndefined();
  });

  it("ignora colori non validi (hex malformato)", () => {
    expect(styleTemaCliente(clienteVuoto({ colorePrimario: "verde" }))).toBeUndefined();
  });

  it("dai due colori ricava tutta la tavolozza: accento, titoli, testi, fondo", () => {
    const style = styleTemaCliente(clienteVuoto({ colorePrimario: "#1C864C", coloreSecondario: "#B1DB32" })) as Record<string, string>;
    // Un primario che regge il testo bianco resta identico (vedi palettaCliente.test.ts per i casi).
    expect(style["--brand-primary"]).toBe("#1C864C");
    expect(style["--accento"]).toBe("#1C864C");
    // Non resta nulla del blu ALC: titoli, testo e fondo vengono dai colori del cliente.
    for (const chiave of ["--inchiostro", "--ink-900", "--testo", "--ink-700", "--sfondo", "--surface", "--linea", "--notte", "--gradiente-pulsante", "--shadow-card"]) {
      expect(style[chiave], chiave).toBeTruthy();
    }
    expect(style["--inchiostro"].toLowerCase()).not.toBe("#002f54");
  });

  it("il fondo tenue viene dal più chiaro dei due colori, schiarito", () => {
    const style = styleTemaCliente(clienteVuoto({ colorePrimario: "#76943C", coloreSecondario: "#D6DE3F" })) as Record<string, string>;
    expect(style["--brand-primary-light"]).toBe("#f9fae2");
  });

  it("con un colore solo lo usa per entrambi i ruoli", () => {
    const soloPrimario = styleTemaCliente(clienteVuoto({ colorePrimario: "#166B85" })) as Record<string, string>;
    const soloSecondario = styleTemaCliente(clienteVuoto({ coloreSecondario: "#166B85" })) as Record<string, string>;
    expect(soloPrimario["--accento"]).toBe("#166B85");
    expect(soloSecondario).toEqual(soloPrimario);
  });

  it("imposta --font-montserrat (il nome foglia, non l'alias semantico) solo per un font nella whitelist", () => {
    const style = styleTemaCliente(clienteVuoto({ fontPersonalizzato: "poppins" }));
    expect(style).toMatchObject({ "--font-montserrat": "var(--font-poppins)" });
  });

  it("ignora un font fuori whitelist (mai un valore libero, next/font richiede un import statico)", () => {
    expect(styleTemaCliente(clienteVuoto({ fontPersonalizzato: "comic-sans" }))).toBeUndefined();
  });

  it("combina colori e font insieme", () => {
    const style = styleTemaCliente({ colorePrimario: "#76943C", coloreSecondario: "#D6DE3F", fontPersonalizzato: "poppins" }) as Record<string, string>;
    expect(style["--font-montserrat"]).toBe("var(--font-poppins)");
    expect(style["--accento"]).toBeTruthy();
  });

  it("il solo font non tocca i colori", () => {
    const style = styleTemaCliente(clienteVuoto({ fontPersonalizzato: "poppins" })) as Record<string, string>;
    expect(Object.keys(style)).toEqual(["--font-montserrat"]);
  });
});

describe("isFontClienteValido", () => {
  it("accetta solo font nella whitelist", () => {
    expect(isFontClienteValido("poppins")).toBe(true);
    expect(isFontClienteValido("dm-sans")).toBe(true);
    expect(isFontClienteValido("")).toBe(false);
    expect(isFontClienteValido("Poppins")).toBe(false); // case-sensitive, sempre minuscolo
  });
});
