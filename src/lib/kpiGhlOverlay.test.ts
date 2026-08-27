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
};

function ghlConnesso(overrides: Partial<Extract<GhlRiepilogoResponse, { connesso: true }>> = {}): GhlRiepilogoResponse {
  return {
    connesso: true,
    calendariConfigurati: true,
    appuntamenti: { totali: 7, confermati: 4, annullati: 3 },
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
    expect(r.parziale).toBe(false);
  });

  it("connesso:false -> tutto dal Funnel", () => {
    const r = applicaOverlayGhl(TOTALE_FUNNEL, { connesso: false });
    expect(r.fatturato.fonte).toBe("funnel");
  });

  it("connesso + filtro campagne attivo -> tutto dal Funnel, mai dati GHL mischiati con un investimento filtrato", () => {
    const r = applicaOverlayGhl(TOTALE_FUNNEL, ghlConnesso(), { filtroCampagneAttivo: true });
    expect(r.fatturato.fonte).toBe("funnel");
    expect(r.numeroVendite.fonte).toBe("funnel");
    expect(r.appuntamentiFissati.fonte).toBe("funnel");
  });

  it("connesso, calendari configurati -> fatturato/vendite/ROAS/CPA/appuntamenti da GHL", () => {
    const r = applicaOverlayGhl(TOTALE_FUNNEL, ghlConnesso());
    expect(r.fatturato).toEqual({ valore: 19991, fonte: "ghl" });
    expect(r.numeroVendite).toEqual({ valore: 6, fonte: "ghl" });
    expect(r.roas).toEqual({ valore: 19991 / 1000, fonte: "ghl" });
    expect(r.cpa).toEqual({ valore: 1000 / 6, fonte: "ghl" });
    expect(r.appuntamentiFissati).toEqual({ valore: 7, fonte: "ghl" });
    expect(r.parziale).toBe(false);
  });

  it("connesso ma calendari NON configurati -> appuntamenti restano dal Funnel (lo 0 di GHL non è un dato vero), il resto sì da GHL", () => {
    const r = applicaOverlayGhl(TOTALE_FUNNEL, ghlConnesso({ calendariConfigurati: false, appuntamenti: { totali: 0, confermati: 0, annullati: 0 } }));
    expect(r.appuntamentiFissati).toEqual({ valore: 3, fonte: "funnel" });
    expect(r.fatturato.fonte).toBe("ghl");
    expect(r.parziale).toBe(false);
  });

  it("calendariFalliti > 0 -> parziale=true, solo quando i calendari sono anche configurati", () => {
    const r = applicaOverlayGhl(TOTALE_FUNNEL, ghlConnesso({ calendariFalliti: 2 }));
    expect(r.parziale).toBe(true);
    expect(r.appuntamentiFissati.fonte).toBe("ghl");
  });

  it("investimento o vendite a 0 -> ROAS/CPA null (stessa regola di divideOrNull, non una nuova)", () => {
    const rInvestimentoZero = applicaOverlayGhl({ ...TOTALE_FUNNEL, investimento: 0 }, ghlConnesso());
    expect(rInvestimentoZero.roas).toEqual({ valore: null, fonte: "ghl" });

    const rVenditeZero = applicaOverlayGhl(TOTALE_FUNNEL, ghlConnesso({ opportunita: { vendite: 0, fatturato: 0 } }));
    expect(rVenditeZero.cpa).toEqual({ valore: null, fonte: "ghl" });
  });
});
