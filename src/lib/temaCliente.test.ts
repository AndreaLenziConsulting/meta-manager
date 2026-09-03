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

  it("imposta --brand-primary e --brand-primary-dark dal colore primario", () => {
    const style = styleTemaCliente(clienteVuoto({ colorePrimario: "#76943C" }));
    expect(style).toMatchObject({ "--brand-primary": "#76943C" });
    expect(style?.["--brand-primary-dark" as keyof typeof style]).toBeTruthy();
  });

  it("imposta --brand-primary-light dal colore secondario, schiarito", () => {
    const style = styleTemaCliente(clienteVuoto({ coloreSecondario: "#D6DE3F" }));
    expect(style?.["--brand-primary-light" as keyof typeof style]).toBe("#f9fae2");
  });

  it("imposta --font-league-spartan/--font-roboto (i nomi foglia, non l'alias semantico) solo per un font nella whitelist", () => {
    const style = styleTemaCliente(clienteVuoto({ fontPersonalizzato: "poppins" }));
    expect(style).toMatchObject({ "--font-league-spartan": "var(--font-poppins)", "--font-roboto": "var(--font-poppins)" });
  });

  it("ignora un font fuori whitelist (mai un valore libero, next/font richiede un import statico)", () => {
    expect(styleTemaCliente(clienteVuoto({ fontPersonalizzato: "comic-sans" }))).toBeUndefined();
  });

  it("combina più personalizzazioni insieme", () => {
    // colorePrimario -> 2 chiavi (primary + dark), coloreSecondario -> 1 (light), font -> 2 (heading + sans)
    const style = styleTemaCliente({ colorePrimario: "#76943C", coloreSecondario: "#D6DE3F", fontPersonalizzato: "poppins" });
    expect(Object.keys(style ?? {})).toHaveLength(5);
  });
});

describe("isFontClienteValido", () => {
  it("accetta solo font nella whitelist", () => {
    expect(isFontClienteValido("poppins")).toBe(true);
    expect(isFontClienteValido("")).toBe(false);
    expect(isFontClienteValido("Poppins")).toBe(false); // case-sensitive, sempre minuscolo
  });
});
