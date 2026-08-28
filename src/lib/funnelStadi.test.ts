import { describe, expect, it } from "vitest";
import { costruisciFunnelVerticale, percentualeCumulataSuPrimoStadio } from "./funnelStadi";

describe("costruisciFunnelVerticale", () => {
  it("ritorna i 4 stadi nell'ordine giusto con conteggio/costo/percentuale/drop-off corretti", () => {
    const stadi = costruisciFunnelVerticale({
      investimento: 1000,
      numeroRichieste: 100,
      appuntamentiFissati: 40,
      appuntamentiEffettuati: 20,
      numeroVendite: 5,
    });

    expect(stadi).toEqual([
      {
        stadio: "richieste",
        etichetta: "Richieste",
        conteggio: 100,
        costoCumulato: 10, // 1000 / 100
        percentualeConversioneAlProssimo: 0.4, // 40 / 100
        dropOffAssoluto: 60, // 100 - 40
      },
      {
        stadio: "appuntamentiFissati",
        etichetta: "Appuntamenti fissati",
        conteggio: 40,
        costoCumulato: 25, // 1000 / 40
        percentualeConversioneAlProssimo: 0.5, // 20 / 40
        dropOffAssoluto: 20, // 40 - 20
      },
      {
        stadio: "appuntamentiEffettuati",
        etichetta: "Presentati",
        conteggio: 20,
        costoCumulato: 50, // 1000 / 20
        percentualeConversioneAlProssimo: 0.25, // 5 / 20
        dropOffAssoluto: 15, // 20 - 5
      },
      {
        stadio: "vendite",
        etichetta: "Hanno acquistato",
        conteggio: 5,
        costoCumulato: 200, // 1000 / 5
        percentualeConversioneAlProssimo: null, // ultimo stadio, nessun successivo
        dropOffAssoluto: null,
      },
    ]);
  });

  it("costoCumulato è null quando il conteggio di quello stadio è 0 (stessa regola di divideOrNull)", () => {
    const stadi = costruisciFunnelVerticale({
      investimento: 1000,
      numeroRichieste: 10,
      appuntamentiFissati: 0,
      appuntamentiEffettuati: 0,
      numeroVendite: 0,
    });

    expect(stadi[1].costoCumulato).toBeNull();
    expect(stadi[2].costoCumulato).toBeNull();
    expect(stadi[3].costoCumulato).toBeNull();
    // e la conversione verso uno stadio a 0 è comunque calcolabile (0 / 10 = 0, non null)
    expect(stadi[0].percentualeConversioneAlProssimo).toBe(0);
    expect(stadi[0].dropOffAssoluto).toBe(10);
  });

  it("l'ultimo stadio (vendite) ha sempre percentualeConversioneAlProssimo e dropOffAssoluto null", () => {
    const stadi = costruisciFunnelVerticale({
      investimento: 500,
      numeroRichieste: 50,
      appuntamentiFissati: 30,
      appuntamentiEffettuati: 10,
      numeroVendite: 3,
    });
    const ultimo = stadi[stadi.length - 1];
    expect(ultimo.stadio).toBe("vendite");
    expect(ultimo.percentualeConversioneAlProssimo).toBeNull();
    expect(ultimo.dropOffAssoluto).toBeNull();
  });

  it("stadio successivo con PIÙ persone di questo (fonti non comparabili, es. Richieste dal Funnel vuoto e fissati da GHL) -> dropOffAssoluto null, mai un numero negativo", () => {
    const stadi = costruisciFunnelVerticale({
      investimento: 1000,
      numeroRichieste: 0, // Funnel mai compilato per questa sede
      appuntamentiFissati: 7, // GHL: più "arrivi" che "richieste" registrate
      appuntamentiEffettuati: 4,
      numeroVendite: 6, // GHL: opportunità vinte contate a parte, possono superare gli effettuati
    });
    // percentualeConversioneAlProssimo resta quello che è (0 -> null per denominatore zero,
    // 150% resta un'informazione legittima anche se sopra il 100%) — solo il conteggio assoluto
    // di persone "perse" non ha senso se negativo.
    expect(stadi[0].dropOffAssoluto).toBeNull(); // 0 - 7 = -7 -> null, non -7
    expect(stadi[0].percentualeConversioneAlProssimo).toBeNull(); // divideOrNull(7, 0)
    expect(stadi[2].dropOffAssoluto).toBeNull(); // 4 - 6 = -2 -> null, non -2
    expect(stadi[2].percentualeConversioneAlProssimo).toBe(1.5); // 6 / 4 = 150%, resta visibile
    // la transizione realmente comparabile (fissati -> effettuati, entrambi da GHL) resta invariata
    expect(stadi[1].dropOffAssoluto).toBe(3); // 7 - 4
  });

  it("investimento a 0 -> costoCumulato null su ogni stadio con conteggio > 0 (0 / n = 0, non null)", () => {
    const stadi = costruisciFunnelVerticale({
      investimento: 0,
      numeroRichieste: 10,
      appuntamentiFissati: 5,
      appuntamentiEffettuati: 2,
      numeroVendite: 1,
    });
    // divideOrNull(0, denominatore != 0) = 0, non null: solo il denominatore azzera il risultato.
    expect(stadi.map((s) => s.costoCumulato)).toEqual([0, 0, 0, 0]);
  });
});

describe("percentualeCumulataSuPrimoStadio", () => {
  it("caso normale: ogni elemento diviso per conteggi[0]", () => {
    expect(percentualeCumulataSuPrimoStadio([100, 40, 20, 5])).toEqual([1, 0.4, 0.2, 0.05]);
  });

  it("conteggi[0] a 0 -> tutti null, incluso il primo stesso", () => {
    expect(percentualeCumulataSuPrimoStadio([0, 5, 3, 1])).toEqual([null, null, null, null]);
  });

  it("array con un solo elemento -> quell'unico elemento diviso per se stesso", () => {
    expect(percentualeCumulataSuPrimoStadio([42])).toEqual([1]);
  });
});
