import { describe, expect, it } from "vitest";
import { creaImpronta, eImpronta, verificaPassword } from "./password";

describe("impronta della password", () => {
  it("la password giusta corrisponde, una sbagliata no", async () => {
    const impronta = await creaImpronta("Corretta-Cavallo-9");
    expect(await verificaPassword("Corretta-Cavallo-9", impronta)).toBe(true);
    expect(await verificaPassword("corretta-cavallo-9", impronta)).toBe(false);
    expect(await verificaPassword("Corretta-Cavallo-9 ", impronta)).toBe(false);
  });

  it("dall'impronta non si legge la password, e due impronte della stessa password sono diverse", async () => {
    const a = await creaImpronta("Corretta-Cavallo-9");
    const b = await creaImpronta("Corretta-Cavallo-9");
    expect(a).not.toContain("Corretta");
    expect(a).not.toBe(b);
    expect(a.split("$")).toHaveLength(6);
    expect(eImpronta(a)).toBe(true);
  });

  it("un valore salvato in chiaro (prima della conversione) continua a far entrare", async () => {
    expect(eImpronta("Vecchia-Password1")).toBe(false);
    expect(await verificaPassword("Vecchia-Password1", "Vecchia-Password1")).toBe(true);
    expect(await verificaPassword("Vecchia-Password2", "Vecchia-Password1")).toBe(false);
  });

  it("l'impronta stessa non vale come password", async () => {
    const impronta = await creaImpronta("Corretta-Cavallo-9");
    expect(await verificaPassword(impronta, impronta)).toBe(false);
  });

  it("nessuna password salvata o digitata: non si entra", async () => {
    expect(await verificaPassword("", "")).toBe(false);
    expect(await verificaPassword("qualcosa", "")).toBe(false);
    expect(await verificaPassword("", await creaImpronta("Corretta-Cavallo-9"))).toBe(false);
  });

  it("un'impronta rovinata non corrisponde a nulla, senza errori", async () => {
    expect(await verificaPassword("x", "scrypt$abc$8$1$c2FsZQ==$aGFzaA==")).toBe(false);
    expect(await verificaPassword("x", "scrypt$32768$8$1")).toBe(false);
    expect(await verificaPassword("x", "scrypt$3$8$1$c2FsZQ==$aGFzaA==")).toBe(false);
  });

  it("caratteri accentati scritti in due forme diverse sono la stessa password", async () => {
    const impronta = await creaImpronta("Città-Sicura-2026");
    expect(await verificaPassword("Città-Sicura-2026", impronta)).toBe(true);
  });
});
