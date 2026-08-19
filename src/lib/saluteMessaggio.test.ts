import { describe, expect, it } from "vitest";
import { formatMotivoIntervento } from "./saluteMessaggio";
import { formatEuro } from "./format";
import type { ValutazioneSalute } from "./salute";

function valutazione(over: Partial<ValutazioneSalute>): ValutazioneSalute {
  return { stato: "mantieni", metricaUsata: null, valoreAttuale: null, targetUsato: null, ...over };
}

describe("formatMotivoIntervento", () => {
  it("solo ads critico: descrive metrica, valore e percentuale sopra target", () => {
    const v = valutazione({ stato: "interveni", metricaUsata: "vendita", valoreAttuale: 970, targetUsato: 650 });
    expect(formatMotivoIntervento(v, 0)).toBe(
      `CPA su vendita a ${formatEuro(970)}, il 49% sopra il target di ${formatEuro(650)}.`
    );
  });

  it("usa 'Costo per lead' quando la metrica usata è il proxy lead, non la vendita", () => {
    const v = valutazione({ stato: "interveni", metricaUsata: "lead", valoreAttuale: 112, targetUsato: 70 });
    expect(formatMotivoIntervento(v, 0)).toBe(
      `Costo per lead a ${formatEuro(112)}, il 60% sopra il target di ${formatEuro(70)}.`
    );
  });

  it("solo attività in ritardo, plurale", () => {
    const v = valutazione({ stato: "mantieni" });
    expect(formatMotivoIntervento(v, 3)).toBe("3 attività aperte sono in ritardo.");
  });

  it("solo attività in ritardo, singolare", () => {
    const v = valutazione({ stato: "scala" });
    expect(formatMotivoIntervento(v, 1)).toBe("1 attività aperta è in ritardo.");
  });

  it("ads critico e attività in ritardo insieme: un solo testo unito, separato da un trattino", () => {
    const v = valutazione({ stato: "interveni", metricaUsata: "lead", valoreAttuale: 112, targetUsato: 70 });
    const testo = formatMotivoIntervento(v, 1);
    expect(testo).toBe(
      `Costo per lead a ${formatEuro(112)}, il 60% sopra il target di ${formatEuro(70)} — 1 attività aperta è in ritardo.`
    );
  });

  it("nessun motivo (mantieni, nessun ritardo) → null", () => {
    expect(formatMotivoIntervento(valutazione({ stato: "mantieni" }), 0)).toBeNull();
  });

  it("nessun motivo (scala, nessun ritardo) → null", () => {
    expect(formatMotivoIntervento(valutazione({ stato: "scala" }), 0)).toBeNull();
  });

  it("nessun motivo (no-target, nessun ritardo) → null", () => {
    expect(formatMotivoIntervento(valutazione({ stato: "no-target" }), 0)).toBeNull();
  });

  it("nessun motivo (dati-insufficienti, nessun ritardo) → null", () => {
    expect(formatMotivoIntervento(valutazione({ stato: "dati-insufficienti" }), 0)).toBeNull();
  });

  it("interveni ma senza valori numerici (caso teorico) → nessuna frase ads, resta null senza ritardi", () => {
    const v = valutazione({ stato: "interveni", valoreAttuale: null, targetUsato: null });
    expect(formatMotivoIntervento(v, 0)).toBeNull();
  });
});
