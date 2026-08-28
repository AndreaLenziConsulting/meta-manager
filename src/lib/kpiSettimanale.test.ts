import { describe, expect, it } from "vitest";
import { calcolaTesseraSettimanale, serieCostoPerLead } from "./kpiSettimanale";

// Tutte le date di "oggi" sotto sono iniettate esplicitamente via opzioni.oggi — mai il vero
// Date.now(), stesso principio di oraAttualeMs in ghl.ts. I lunedì usati come chiave settimana sono
// verificati (getUTCDay() === 1) prima di scriverli qui, non a mente.

describe("calcolaTesseraSettimanale", () => {
  it("serie vuota -> null", () => {
    expect(calcolaTesseraSettimanale([])).toBeNull();
  });

  it("settimana corrente incompleta è marcata inCorso ed esclusa dal confronto e dalla sparkline", () => {
    const serie = [
      { settimana: "2026-08-03", valore: 100 },
      { settimana: "2026-08-10", valore: 120 },
      { settimana: "2026-08-17", valore: 999 }, // domenica 2026-08-23, non ancora passata
    ];
    const r = calcolaTesseraSettimanale(serie, { oggi: "2026-08-20" });
    expect(r).not.toBeNull();
    expect(r!.ultimaSettimana).toEqual({ settimana: "2026-08-17", valore: 999, inCorso: true });
    expect(r!.confronto).toEqual({
      settimanaCorrente: "2026-08-10",
      settimanaPrecedente: "2026-08-03",
      valoreCorrente: 120,
      valorePrecedente: 100,
      deltaPercentuale: 0.2,
    });
    expect(r!.sparkline).toEqual([
      { settimana: "2026-08-03", valore: 100 },
      { settimana: "2026-08-10", valore: 120 },
    ]);
  });

  it("delta null quando la settimana precedente vale 0 (divideOrNull, non NaN/Infinity)", () => {
    const serie = [
      { settimana: "2026-08-03", valore: 0 },
      { settimana: "2026-08-10", valore: 50 },
    ];
    const r = calcolaTesseraSettimanale(serie, { oggi: "2026-09-01" });
    expect(r!.confronto).toEqual({
      settimanaCorrente: "2026-08-10",
      settimanaPrecedente: "2026-08-03",
      valoreCorrente: 50,
      valorePrecedente: 0,
      deltaPercentuale: null,
    });
  });

  it("delta corretto su un caso normale", () => {
    const serie = [
      { settimana: "2026-08-03", valore: 200 },
      { settimana: "2026-08-10", valore: 250 },
    ];
    const r = calcolaTesseraSettimanale(serie, { oggi: "2026-09-01" });
    expect(r!.confronto?.deltaPercentuale).toEqual(0.25);
  });

  it("serie con una sola settimana conclusa -> confronto null", () => {
    const serie = [{ settimana: "2026-08-03", valore: 100 }];
    const r = calcolaTesseraSettimanale(serie, { oggi: "2026-09-01" });
    expect(r!.ultimaSettimana).toEqual({ settimana: "2026-08-03", valore: 100, inCorso: false });
    expect(r!.confronto).toBeNull();
    expect(r!.sparkline).toEqual([{ settimana: "2026-08-03", valore: 100 }]);
  });

  describe("sparkline", () => {
    // 10 settimane concluse (2026-06-01 ... 2026-08-03, tutti lunedì verificati) + 1 in corso
    // (2026-08-10, domenica 2026-08-16 non ancora passata rispetto a oggi=2026-08-12).
    const dieciConcluseEUnaInCorso = [
      { settimana: "2026-06-01", valore: 10 },
      { settimana: "2026-06-08", valore: 20 },
      { settimana: "2026-06-15", valore: 30 },
      { settimana: "2026-06-22", valore: 40 },
      { settimana: "2026-06-29", valore: 50 },
      { settimana: "2026-07-06", valore: 60 },
      { settimana: "2026-07-13", valore: 70 },
      { settimana: "2026-07-20", valore: 80 },
      { settimana: "2026-07-27", valore: 90 },
      { settimana: "2026-08-03", valore: 100 },
      { settimana: "2026-08-10", valore: 55 }, // in corso
    ];

    it("di default prende le ultime 8 settimane concluse, mai quella in corso", () => {
      const r = calcolaTesseraSettimanale(dieciConcluseEUnaInCorso, { oggi: "2026-08-12" });
      expect(r!.sparkline).toHaveLength(8);
      expect(r!.sparkline.map((p) => p.settimana)).not.toContain("2026-08-10");
      expect(r!.sparkline[0].settimana).toBe("2026-06-15");
      expect(r!.sparkline[r!.sparkline.length - 1].settimana).toBe("2026-08-03");
    });

    it("rispetta numeroSettimaneSparkline personalizzato", () => {
      const r = calcolaTesseraSettimanale(dieciConcluseEUnaInCorso, { oggi: "2026-08-12", numeroSettimaneSparkline: 3 });
      expect(r!.sparkline).toEqual([
        { settimana: "2026-07-20", valore: 80 },
        { settimana: "2026-07-27", valore: 90 },
        { settimana: "2026-08-03", valore: 100 },
      ]);
    });
  });
});

describe("serieCostoPerLead", () => {
  it("numeroLead=0 -> valore null (mai una divisione per zero)", () => {
    expect(serieCostoPerLead([{ settimana: "2026-08-03", investimento: 100, numeroLead: 0 }])).toEqual([
      { settimana: "2026-08-03", valore: null },
    ]);
  });

  it("calcola investimento / numeroLead per ogni riga, ordine preservato", () => {
    const trend = [
      { settimana: "2026-08-03", investimento: 100, numeroLead: 5 },
      { settimana: "2026-08-10", investimento: 150, numeroLead: 0 },
    ];
    expect(serieCostoPerLead(trend)).toEqual([
      { settimana: "2026-08-03", valore: 20 },
      { settimana: "2026-08-10", valore: null },
    ]);
  });
});
