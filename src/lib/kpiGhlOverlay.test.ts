import { describe, expect, it } from "vitest";
import { applicaOverlayGhl } from "./kpiGhlOverlay";
import type { GhlRiepilogoResponse } from "@/types/ghl";

const TOTALE_FUNNEL = {
  investimento: 1000,
  fatturato: 300,
  numeroVendite: 2,
  roas: 0.3,
  cpa: 500,
  appuntamentiFissati: 3,
  appuntamentiEffettuati: 1,
  percentualeEffettuatiSuFissati: 1 / 3,
  tassoDiChiusura: 2,
};

function ghlConnesso(overrides: Partial<Extract<GhlRiepilogoResponse, { connesso: true }>> = {}): GhlRiepilogoResponse {
  return {
    connesso: true,
    calendariConfigurati: true,
    appuntamenti: { totali: 7, confermati: 4, annullati: 3, effettuati: 5 },
    opportunita: { vendite: 6, fatturato: 19991 },
    calendariFalliti: 0,
    ...overrides,
  };
}

describe("applicaOverlayGhl", () => {
  it("nessuna connessione (null) -> tutto dal Funnel", () => {
    const r = applicaOverlayGhl(TOTALE_FUNNEL, null);
    expect(r.fatturato).toEqual({ valore: 300, fonte: "funnel" });
    expect(r.numeroVendite).toEqual({ valore: 2, fonte: "funnel" });
    expect(r.roas).toEqual({ valore: 0.3, fonte: "funnel" });
    expect(r.cpa).toEqual({ valore: 500, fonte: "funnel" });
    expect(r.appuntamentiFissati).toEqual({ valore: 3, fonte: "funnel" });
    expect(r.appuntamentiEffettuati).toEqual({ valore: 1, fonte: "funnel" });
    expect(r.percentualeEffettuatiSuFissati).toEqual({ valore: 1 / 3, fonte: "funnel" });
    expect(r.tassoDiChiusura).toEqual({ valore: 2, fonte: "funnel" });
    expect(r.parziale).toBe(false);
  });

  it("connesso:false -> tutto dal Funnel", () => {
    const r = applicaOverlayGhl(TOTALE_FUNNEL, { connesso: false });
    expect(r.fatturato.fonte).toBe("funnel");
    expect(r.appuntamentiEffettuati.fonte).toBe("funnel");
  });

  it("connesso + filtro campagne attivo -> tutto dal Funnel, mai dati GHL mischiati con un investimento filtrato", () => {
    const r = applicaOverlayGhl(TOTALE_FUNNEL, ghlConnesso(), { filtroCampagneAttivo: true });
    expect(r.fatturato.fonte).toBe("funnel");
    expect(r.numeroVendite.fonte).toBe("funnel");
    expect(r.appuntamentiFissati.fonte).toBe("funnel");
    expect(r.appuntamentiEffettuati.fonte).toBe("funnel");
  });

  it("connesso, calendari configurati -> tutte le tessere (incluse effettuati/%/tasso) da GHL", () => {
    const r = applicaOverlayGhl(TOTALE_FUNNEL, ghlConnesso());
    expect(r.fatturato).toEqual({ valore: 19991, fonte: "ghl" });
    expect(r.numeroVendite).toEqual({ valore: 6, fonte: "ghl" });
    expect(r.roas).toEqual({ valore: 19991 / 1000, fonte: "ghl" });
    expect(r.cpa).toEqual({ valore: 1000 / 6, fonte: "ghl" });
    expect(r.appuntamentiFissati).toEqual({ valore: 7, fonte: "ghl" });
    expect(r.appuntamentiEffettuati).toEqual({ valore: 5, fonte: "ghl" });
    expect(r.percentualeEffettuatiSuFissati).toEqual({ valore: 5 / 7, fonte: "ghl" });
    // tassoDiChiusura = vendite GHL / effettuati GHL: numeratore e denominatore dalla stessa fonte,
    // a differenza del caso senza calendari configurati sotto.
    expect(r.tassoDiChiusura).toEqual({ valore: 6 / 5, fonte: "ghl" });
    expect(r.parziale).toBe(false);
  });

  it("connesso ma calendari NON configurati -> appuntamenti/effettuati/%/tasso restano dal Funnel, fatturato/vendite/ROAS/CPA da GHL", () => {
    const r = applicaOverlayGhl(
      TOTALE_FUNNEL,
      ghlConnesso({ calendariConfigurati: false, appuntamenti: { totali: 0, confermati: 0, annullati: 0, effettuati: 0 } })
    );
    expect(r.appuntamentiFissati).toEqual({ valore: 3, fonte: "funnel" });
    expect(r.appuntamentiEffettuati).toEqual({ valore: 1, fonte: "funnel" });
    expect(r.percentualeEffettuatiSuFissati).toEqual({ valore: 1 / 3, fonte: "funnel" });
    expect(r.tassoDiChiusura).toEqual({ valore: 2, fonte: "funnel" });
    expect(r.fatturato.fonte).toBe("ghl");
    expect(r.parziale).toBe(false);
  });

  it("calendariFalliti > 0 -> parziale=true, solo quando i calendari sono anche configurati", () => {
    const r = applicaOverlayGhl(TOTALE_FUNNEL, ghlConnesso({ calendariFalliti: 2 }));
    expect(r.parziale).toBe(true);
    expect(r.appuntamentiEffettuati.fonte).toBe("ghl");
  });

  it("investimento, vendite o effettuati a 0 -> i rapporti tornano null (stessa regola di divideOrNull, non una nuova)", () => {
    const rInvestimentoZero = applicaOverlayGhl({ ...TOTALE_FUNNEL, investimento: 0 }, ghlConnesso());
    expect(rInvestimentoZero.roas).toEqual({ valore: null, fonte: "ghl" });

    const rVenditeZero = applicaOverlayGhl(TOTALE_FUNNEL, ghlConnesso({ opportunita: { vendite: 0, fatturato: 0 } }));
    expect(rVenditeZero.cpa).toEqual({ valore: null, fonte: "ghl" });

    const rEffettuatiZero = applicaOverlayGhl(
      TOTALE_FUNNEL,
      ghlConnesso({ appuntamenti: { totali: 7, confermati: 0, annullati: 7, effettuati: 0 } })
    );
    expect(rEffettuatiZero.tassoDiChiusura).toEqual({ valore: null, fonte: "ghl" });
  });
});
