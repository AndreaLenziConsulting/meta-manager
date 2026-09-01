import { describe, expect, it } from "vitest";
import { calcolaVariazionePeriodo } from "./confrontoPeriodo";

describe("calcolaVariazionePeriodo", () => {
  it("calcola un aumento", () => {
    expect(calcolaVariazionePeriodo(120, 100)).toEqual({ percentuale: 0.2, direzione: "aumento" });
  });

  it("calcola una diminuzione", () => {
    expect(calcolaVariazionePeriodo(80, 100)).toEqual({ percentuale: -0.2, direzione: "diminuzione" });
  });

  it("segnala invariato quando i due valori coincidono", () => {
    expect(calcolaVariazionePeriodo(50, 50)).toEqual({ percentuale: 0, direzione: "invariato" });
  });

  it("segnala invariato quando entrambi i periodi sono a zero (dato reale, non assente)", () => {
    expect(calcolaVariazionePeriodo(0, 0)).toEqual({ percentuale: 0, direzione: "invariato" });
  });

  it("restituisce null se il periodo precedente è zero ma quello attuale no (percentuale infinita senza senso)", () => {
    expect(calcolaVariazionePeriodo(5, 0)).toBeNull();
  });

  it("restituisce null se manca il valore attuale", () => {
    expect(calcolaVariazionePeriodo(null, 100)).toBeNull();
  });

  it("restituisce null se manca il valore precedente", () => {
    expect(calcolaVariazionePeriodo(100, null)).toBeNull();
  });

  it("usa il valore assoluto del precedente come base (precedente negativo teorico non produce segno invertito)", () => {
    // Caso di garanzia numerica, non un valore realistico per queste metriche (sempre >= 0).
    expect(calcolaVariazionePeriodo(-10, -20)).toEqual({ percentuale: 0.5, direzione: "aumento" });
  });
});
