import { describe, expect, it } from "vitest";
import { validaAccountId } from "./adAccountId";

describe("validaAccountId", () => {
  it("Meta: accetta solo cifre", () => {
    expect(validaAccountId("meta", "1234567890")).toEqual({ ok: true, valore: "1234567890" });
  });

  it("Meta: rifiuta il prefisso act_", () => {
    const esito = validaAccountId("meta", "act_1234567890");
    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.errore).toMatch(/act_/);
  });

  it("Meta: rifiuta lettere/simboli", () => {
    expect(validaAccountId("meta", "abc123").ok).toBe(false);
  });

  it("Google Ads: accetta il formato con trattini e lo normalizza senza", () => {
    expect(validaAccountId("google", "123-456-7890")).toEqual({ ok: true, valore: "1234567890" });
  });

  it("Google Ads: accetta anche già senza trattini", () => {
    expect(validaAccountId("google", "1234567890")).toEqual({ ok: true, valore: "1234567890" });
  });

  it("Google Ads: rifiuta lettere/simboli diversi dal trattino", () => {
    expect(validaAccountId("google", "123-abc-7890").ok).toBe(false);
  });

  it("rifiuta stringa vuota per entrambi i canali", () => {
    expect(validaAccountId("meta", "").ok).toBe(false);
    expect(validaAccountId("google", "").ok).toBe(false);
  });
});
