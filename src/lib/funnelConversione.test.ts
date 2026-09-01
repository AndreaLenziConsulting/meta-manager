import { describe, expect, it } from "vitest";
import { costruisciFunnelConversione } from "./funnelConversione";

describe("costruisciFunnelConversione", () => {
  it("calcola i 4 stadi con percentuale sul primo stadio e conversione al successivo", () => {
    const stadi = costruisciFunnelConversione({
      numeroLead: 100,
      appuntamentiFissati: 40,
      appuntamentiEffettuati: 20,
      numeroVendite: 5,
    });
    expect(stadi.map((s) => s.stadio)).toEqual(["lead", "appuntamentiFissati", "appuntamentiEffettuati", "vendite"]);

    expect(stadi[0]).toEqual({
      stadio: "lead",
      etichetta: "Lead generati",
      conteggio: 100,
      percentualeSuLead: 1,
      percentualeConversioneAlProssimo: 0.4, // 40/100
    });
    expect(stadi[1]).toEqual({
      stadio: "appuntamentiFissati",
      etichetta: "Appuntamenti fissati",
      conteggio: 40,
      percentualeSuLead: 0.4,
      percentualeConversioneAlProssimo: 0.5, // 20/40
    });
    expect(stadi[2]).toEqual({
      stadio: "appuntamentiEffettuati",
      etichetta: "Appuntamenti effettuati",
      conteggio: 20,
      percentualeSuLead: 0.2,
      percentualeConversioneAlProssimo: 0.25, // 5/20
    });
    expect(stadi[3]).toEqual({
      stadio: "vendite",
      etichetta: "Vendite",
      conteggio: 5,
      percentualeSuLead: 0.05,
      percentualeConversioneAlProssimo: null, // ultimo stadio, nessun "prossimo"
    });
  });

  it("numeroLead a zero -> percentualeSuLead null su tutti gli stadi, mai un falso 0%", () => {
    const stadi = costruisciFunnelConversione({ numeroLead: 0, appuntamentiFissati: 0, appuntamentiEffettuati: 0, numeroVendite: 0 });
    expect(stadi.every((s) => s.percentualeSuLead === null)).toBe(true);
  });

  it("uno stadio intermedio a zero -> la sua conversione al prossimo è null (non 0/0)", () => {
    const stadi = costruisciFunnelConversione({ numeroLead: 50, appuntamentiFissati: 0, appuntamentiEffettuati: 0, numeroVendite: 0 });
    expect(stadi[1].percentualeConversioneAlProssimo).toBeNull(); // 0 fissati -> nessuna base per calcolare quanti sono diventati effettuati
  });
});
