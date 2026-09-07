import { describe, expect, it } from "vitest";
import { calcolaSaldoNettoCumulato } from "./saldoNettoCumulato";

describe("calcolaSaldoNettoCumulato", () => {
  it("cumula investimento e contrattualizzato settimana su settimana, calcolando il saldo netto", () => {
    const punti = calcolaSaldoNettoCumulato([
      { settimana: "2026-06-01", investimento: 100, contrattualizzato: 0 },
      { settimana: "2026-06-08", investimento: 100, contrattualizzato: 50 },
      { settimana: "2026-06-15", investimento: 100, contrattualizzato: 400 },
    ]);
    expect(punti).toEqual([
      { settimana: "2026-06-01", investimentoCumulato: 100, contrattualizzatoCumulato: 0, saldoNetto: -100 },
      { settimana: "2026-06-08", investimentoCumulato: 200, contrattualizzatoCumulato: 50, saldoNetto: -150 },
      { settimana: "2026-06-15", investimentoCumulato: 300, contrattualizzatoCumulato: 450, saldoNetto: 150 },
    ]);
  });

  it("il saldo netto parte negativo e attraversa lo zero quando il contrattualizzato cumulato supera l'investimento cumulato", () => {
    const punti = calcolaSaldoNettoCumulato([
      { settimana: "2026-06-01", investimento: 500, contrattualizzato: 0 },
      { settimana: "2026-06-08", investimento: 0, contrattualizzato: 500 },
      { settimana: "2026-06-15", investimento: 0, contrattualizzato: 1 },
    ]);
    expect(punti[0].saldoNetto).toBeLessThan(0);
    expect(punti[1].saldoNetto).toBe(0); // pareggio esatto
    expect(punti[2].saldoNetto).toBeGreaterThan(0);
  });

  it("un contrattualizzato null (mese senza dato Funnel per quella settimana) vale 0 nel cumulo, non spezza la serie", () => {
    const punti = calcolaSaldoNettoCumulato([
      { settimana: "2026-06-01", investimento: 100, contrattualizzato: null },
      { settimana: "2026-06-08", investimento: 100, contrattualizzato: 300 },
    ]);
    expect(punti[0]).toEqual({ settimana: "2026-06-01", investimentoCumulato: 100, contrattualizzatoCumulato: 0, saldoNetto: -100 });
    expect(punti[1]).toEqual({ settimana: "2026-06-08", investimentoCumulato: 200, contrattualizzatoCumulato: 300, saldoNetto: 100 });
  });

  it("serie vuota -> array vuoto", () => {
    expect(calcolaSaldoNettoCumulato([])).toEqual([]);
  });
});
