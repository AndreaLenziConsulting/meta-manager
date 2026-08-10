import { describe, expect, it } from "vitest";
import { calcolaSalute } from "./salute";

// Soglie della metodologia dettata da Andrea: rapporto valore/target <=0.8 "scala", <=1.2 "mantieni",
// >1.2 "interveni"; nessun giudizio finché la spesa non è almeno 2.5x il target (poco segnale).
describe("calcolaSalute", () => {
  describe("con vendite nel periodo (priorità CPA su vendita)", () => {
    it("dati insufficienti se la spesa è sotto 2.5x il target CPA", () => {
      const r = calcolaSalute({ investimento: 100, numeroVendite: 1, cpa: 100, costoPerLead: null }, 50, null);
      // target 50 * 2.5 = 125 > 100 di spesa -> dati insufficienti
      expect(r.stato).toBe("dati-insufficienti");
      expect(r.metricaUsata).toBe("vendita");
    });

    it("classifica 'scala' esattamente al confine 0.8 (rapporto <= 0.8)", () => {
      const r = calcolaSalute({ investimento: 400, numeroVendite: 1, cpa: 40, costoPerLead: null }, 50, null);
      // spesa 400 >= 50*2.5=125 (ok), rapporto 40/50 = 0.8
      expect(r.stato).toBe("scala");
    });

    it("classifica 'mantieni' appena sopra 0.8 e fino a 1.2 incluso", () => {
      const appenaSopra = calcolaSalute({ investimento: 400, numeroVendite: 1, cpa: 41, costoPerLead: null }, 50, null);
      const alConfine = calcolaSalute({ investimento: 400, numeroVendite: 1, cpa: 60, costoPerLead: null }, 50, null);
      expect(appenaSopra.stato).toBe("mantieni");
      expect(alConfine.stato).toBe("mantieni"); // 60/50 = 1.2
    });

    it("classifica 'interveni' appena sopra 1.2", () => {
      const r = calcolaSalute({ investimento: 400, numeroVendite: 1, cpa: 61, costoPerLead: null }, 50, null);
      expect(r.stato).toBe("interveni"); // 61/50 = 1.22
    });

    it("cpa null nonostante vendite>0 (caso difensivo) -> dati insufficienti, non un crash", () => {
      const r = calcolaSalute({ investimento: 400, numeroVendite: 1, cpa: null, costoPerLead: null }, 50, null);
      expect(r.stato).toBe("dati-insufficienti");
    });
  });

  describe("senza vendite nel periodo (fallback su costo per lead)", () => {
    it("usa targetCpl quando numeroVendite è 0", () => {
      const r = calcolaSalute({ investimento: 400, numeroVendite: 0, cpa: null, costoPerLead: 40 }, null, 50);
      expect(r.metricaUsata).toBe("lead");
      expect(r.stato).toBe("scala"); // 40/50 = 0.8
    });

    it("dati insufficienti se la spesa è sotto 2.5x il target CPL", () => {
      const r = calcolaSalute({ investimento: 100, numeroVendite: 0, cpa: null, costoPerLead: 40 }, null, 50);
      // 50*2.5 = 125 > 100
      expect(r.stato).toBe("dati-insufficienti");
    });

    it("anche con vendite>0 ma senza targetCpa, ripiega su targetCpl", () => {
      const r = calcolaSalute({ investimento: 400, numeroVendite: 2, cpa: 200, costoPerLead: 40 }, null, 50);
      expect(r.metricaUsata).toBe("lead");
      expect(r.stato).toBe("scala");
    });
  });

  it("nessun target impostato -> 'no-target', mai un crash o una divisione per zero", () => {
    const r = calcolaSalute({ investimento: 400, numeroVendite: 0, cpa: null, costoPerLead: null }, null, null);
    expect(r.stato).toBe("no-target");
    expect(r.metricaUsata).toBeNull();
    expect(r.valoreAttuale).toBeNull();
  });
});
