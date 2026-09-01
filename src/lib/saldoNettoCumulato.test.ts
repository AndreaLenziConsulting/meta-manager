import { describe, expect, it } from "vitest";
import { calcolaSaldoNettoCumulato } from "./saldoNettoCumulato";

describe("calcolaSaldoNettoCumulato", () => {
  it("cumula investimento e fatturato settimana su settimana, calcolando il saldo netto", () => {
    const punti = calcolaSaldoNettoCumulato([
      { settimana: "2026-06-01", investimento: 100, fatturato: 0 },
      { settimana: "2026-06-08", investimento: 100, fatturato: 50 },
      { settimana: "2026-06-15", investimento: 100, fatturato: 400 },
    ]);
    expect(punti).toEqual([
      { settimana: "2026-06-01", investimentoCumulato: 100, fatturatoCumulato: 0, saldoNetto: -100 },
      { settimana: "2026-06-08", investimentoCumulato: 200, fatturatoCumulato: 50, saldoNetto: -150 },
      { settimana: "2026-06-15", investimentoCumulato: 300, fatturatoCumulato: 450, saldoNetto: 150 },
    ]);
  });

  it("il saldo netto parte negativo e attraversa lo zero quando il fatturato cumulato supera l'investimento cumulato", () => {
    const punti = calcolaSaldoNettoCumulato([
      { settimana: "2026-06-01", investimento: 500, fatturato: 0 },
      { settimana: "2026-06-08", investimento: 0, fatturato: 500 },
      { settimana: "2026-06-15", investimento: 0, fatturato: 1 },
    ]);
    expect(punti[0].saldoNetto).toBeLessThan(0);
    expect(punti[1].saldoNetto).toBe(0); // pareggio esatto
    expect(punti[2].saldoNetto).toBeGreaterThan(0);
  });

  it("un fatturato null (mese senza dato Funnel per quella settimana) vale 0 nel cumulo, non spezza la serie", () => {
    const punti = calcolaSaldoNettoCumulato([
      { settimana: "2026-06-01", investimento: 100, fatturato: null },
      { settimana: "2026-06-08", investimento: 100, fatturato: 300 },
    ]);
    expect(punti[0]).toEqual({ settimana: "2026-06-01", investimentoCumulato: 100, fatturatoCumulato: 0, saldoNetto: -100 });
    expect(punti[1]).toEqual({ settimana: "2026-06-08", investimentoCumulato: 200, fatturatoCumulato: 300, saldoNetto: 100 });
  });

  it("serie vuota -> array vuoto", () => {
    expect(calcolaSaldoNettoCumulato([])).toEqual([]);
  });
});
