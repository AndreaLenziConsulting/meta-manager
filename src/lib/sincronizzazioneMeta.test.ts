import { describe, expect, it } from "vitest";
import { diagnosticaDatiFermi, sediConDatiMetaFermi, type SedeDatiFermi } from "./sincronizzazioneMeta";
import type { Campagna, MetaDailyRow, Sede } from "@/types/kpi";

const OGGI = "2026-10-01";

function sede(overrides: Partial<Sede> = {}): Sede {
  return { sedeId: "c1--principale", clienteId: "c1", nome: "Principale", attivo: true, adAccountId: "111", ...overrides } as Sede;
}

function campagna(overrides: Partial<Campagna> = {}): Campagna {
  return {
    campaignId: "camp-1",
    clienteId: "c1",
    sedeId: "c1--principale",
    nomeCampagna: "Campagna",
    tipoCampagna: "Lead Gen",
    stato: "ACTIVE",
    ...overrides,
  };
}

function riga(data: string, overrides: Partial<MetaDailyRow> = {}): MetaDailyRow {
  return { data, clienteId: "c1", campaignId: "camp-1", spesa: 10, impressions: 100, clicks: 5, ctr: 0, cpc: 0, cpm: 0, lead: 1, ...overrides } as MetaDailyRow;
}

describe("sediConDatiMetaFermi", () => {
  it("campagna attiva con dati fino a 2 giorni fa -> non ferma (tolleranza)", () => {
    const ferme = sediConDatiMetaFermi({ sedi: [sede()], campagne: [campagna()], metaDaily: [riga("2026-09-29")], oggi: OGGI });
    expect(ferme).toEqual([]);
  });

  it("campagna attiva con ultimo dato 3 giorni fa -> ferma, con ultimo giorno e giorni trascorsi", () => {
    const ferme = sediConDatiMetaFermi({
      sedi: [sede()],
      campagne: [campagna()],
      metaDaily: [riga("2026-09-20"), riga("2026-09-28")],
      oggi: OGGI,
    });
    expect(ferme).toEqual([
      { clienteId: "c1", sedeId: "c1--principale", adAccountId: "111", campagneAttive: ["camp-1"], ultimoGiorno: "2026-09-28", giorniSenzaDati: 3 },
    ]);
  });

  it("sede con sole campagne in pausa -> mai candidata, anche con dati vecchi di settimane", () => {
    const ferme = sediConDatiMetaFermi({
      sedi: [sede()],
      campagne: [campagna({ stato: "PAUSED" })],
      metaDaily: [riga("2026-09-04")],
      oggi: OGGI,
    });
    expect(ferme).toEqual([]);
  });

  it("conta solo i dati delle campagne ATTIVE: una campagna in pausa con dati recenti non maschera quella attiva ferma", () => {
    const ferme = sediConDatiMetaFermi({
      sedi: [sede()],
      campagne: [campagna(), campagna({ campaignId: "camp-pausa", stato: "PAUSED" })],
      metaDaily: [riga("2026-09-25"), riga("2026-09-30", { campaignId: "camp-pausa" })],
      oggi: OGGI,
    });
    expect(ferme).toHaveLength(1);
    expect(ferme[0].ultimoGiorno).toBe("2026-09-25");
  });

  it("basta una campagna attiva aggiornata perché la sede non sia ferma", () => {
    const ferme = sediConDatiMetaFermi({
      sedi: [sede()],
      campagne: [campagna(), campagna({ campaignId: "camp-2" })],
      metaDaily: [riga("2026-09-10"), riga("2026-09-30", { campaignId: "camp-2" })],
      oggi: OGGI,
    });
    expect(ferme).toEqual([]);
  });

  it("campagna attiva senza nessun dato -> ferma con ultimoGiorno null", () => {
    const ferme = sediConDatiMetaFermi({ sedi: [sede()], campagne: [campagna()], metaDaily: [], oggi: OGGI });
    expect(ferme).toHaveLength(1);
    expect(ferme[0]).toMatchObject({ ultimoGiorno: null, giorniSenzaDati: null });
  });

  it("ignora sedi non attive, sedi senza ad account e campagne Google Ads", () => {
    const ferme = sediConDatiMetaFermi({
      sedi: [
        sede({ sedeId: "c1--chiusa", attivo: false }),
        sede({ sedeId: "c1--senza-account", adAccountId: "" }),
        sede({ sedeId: "c1--google" }),
      ],
      campagne: [
        campagna({ sedeId: "c1--chiusa", campaignId: "a" }),
        campagna({ sedeId: "c1--senza-account", campaignId: "b" }),
        campagna({ sedeId: "c1--google", campaignId: "g", canale: "google" }),
      ],
      metaDaily: [],
      oggi: OGGI,
    });
    expect(ferme).toEqual([]);
  });

  it("stesso ad account su due clienti: le righe di un cliente non aggiornano la sede dell'altro", () => {
    const ferme = sediConDatiMetaFermi({
      sedi: [sede(), sede({ clienteId: "c2", sedeId: "c2--principale" })],
      campagne: [campagna(), campagna({ clienteId: "c2", sedeId: "c2--principale" })],
      metaDaily: [riga("2026-09-30"), riga("2026-09-20", { clienteId: "c2" })],
      oggi: OGGI,
    });
    expect(ferme.map((f) => f.clienteId)).toEqual(["c2"]);
  });
});

describe("diagnosticaDatiFermi", () => {
  const ferma: SedeDatiFermi = {
    clienteId: "c1",
    sedeId: "c1--principale",
    adAccountId: "111",
    campagneAttive: ["camp-1", "camp-2"],
    ultimoGiorno: "2026-09-25",
    giorniSenzaDati: 6,
  };

  it("Meta rifiuta la verifica -> problema di accesso con il messaggio di Meta", async () => {
    const problemi = await diagnosticaDatiFermi([ferma], OGGI, async () => {
      throw new Error("The token has expired on Thursday, 24-Sep-26");
    });
    expect(problemi).toEqual([{ ...ferma, causa: "accesso", dettaglio: "The token has expired on Thursday, 24-Sep-26" }]);
  });

  it("Meta riporta spesa dopo l'ultimo giorno in app -> sincronizzazione non riuscita", async () => {
    const chiamate: unknown[] = [];
    const problemi = await diagnosticaDatiFermi([ferma], OGGI, async (...args) => {
      chiamate.push(args);
      return 184.5;
    });
    expect(problemi).toEqual([{ ...ferma, causa: "sincronizzazione", spesaNonSincronizzata: 184.5 }]);
    // Verifica solo le campagne attive, dal giorno dopo l'ultimo dato fino a oggi.
    expect(chiamate).toEqual([["111", ["camp-1", "camp-2"], "2026-09-26", OGGI]]);
  });

  it("nessuna spesa su Meta dopo l'ultimo giorno -> le campagne non erogano, nessun avviso", async () => {
    expect(await diagnosticaDatiFermi([ferma], OGGI, async () => 0)).toEqual([]);
  });

  it("sede senza nessun dato -> verifica sugli ultimi 30 giorni", async () => {
    const finestre: string[] = [];
    await diagnosticaDatiFermi([{ ...ferma, ultimoGiorno: null, giorniSenzaDati: null }], OGGI, async (_a, _c, since) => {
      finestre.push(since);
      return 0;
    });
    expect(finestre).toEqual(["2026-09-01"]);
  });

  it("ultimo dato molto vecchio -> la verifica non va mai più indietro di 30 giorni", async () => {
    const finestre: string[] = [];
    await diagnosticaDatiFermi([{ ...ferma, ultimoGiorno: "2026-04-14", giorniSenzaDati: 170 }], OGGI, async (_a, _c, since) => {
      finestre.push(since);
      return 0;
    });
    expect(finestre).toEqual(["2026-09-01"]);
  });

  it("Meta non risponde in tempo (null) -> non verificato, mai spacciato per accesso negato", async () => {
    const problemi = await diagnosticaDatiFermi([ferma], OGGI, async () => null);
    expect(problemi).toEqual([{ ...ferma, causa: "non-verificato" }]);
  });

  it("ogni sede ha la sua diagnosi: un errore su una non blocca le altre", async () => {
    const altra = { ...ferma, clienteId: "c2", sedeId: "c2--principale", adAccountId: "222" };
    const problemi = await diagnosticaDatiFermi([ferma, altra], OGGI, async (adAccountId) => {
      if (adAccountId === "111") throw new Error("Unsupported get request");
      return 50;
    });
    expect(problemi.map((p) => [p.clienteId, p.causa])).toEqual([
      ["c1", "accesso"],
      ["c2", "sincronizzazione"],
    ]);
  });
});
