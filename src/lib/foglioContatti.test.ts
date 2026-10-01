import { describe, expect, it } from "vitest";
import { idFoglioDaUrl, interpretaFoglioContatti, riepilogoDaContatti } from "./foglioContatti";

// Riga come arriva dall'esportazione dei moduli Meta, senza intestazioni. `extra` = colonne in più
// prima dello stato (uno dei file reali ha una colonna "CREATED" lì in mezzo).
function rigaMeta(o: { data: string; campagna?: string; inserzione?: string; stato?: string; fatturato?: number | string; extra?: string[] }) {
  return [
    "l:863991833468607",
    o.data,
    `ag:${o.inserzione ?? "120253988245960471"}`,
    "Video 1",
    "as:120253988245950471",
    "Latina+35km",
    `c:${o.campagna ?? "120253988245940471"}`,
    "Acquisition Control - Lead Ads",
    "f:1611453337300492",
    "Modulo",
    "false",
    "ig",
    "Mario Rossi",
    "p:+390000000000",
    "mario@example.com",
    "Roma",
    ...(o.extra ?? []),
    o.stato ?? "",
    o.fatturato ?? 0,
  ];
}

const SETTEMBRE = [new Date("2026-09-01T00:00:00Z").getTime(), new Date("2026-09-30T23:59:59.999Z").getTime()] as const;

describe("interpretaFoglioContatti", () => {
  it("esportazione Meta senza intestazioni: data, campagna, inserzione, stato e fatturato riconosciuti dal contenuto", () => {
    const contatti = interpretaFoglioContatti([
      rigaMeta({ data: "2026-09-30T01:07:07-05:00", stato: "Vendita", fatturato: 3500 }),
      rigaMeta({ data: "2026-09-12T10:00:00+02:00", stato: "In contatto" }),
    ]);
    expect(contatti).toHaveLength(2);
    expect(contatti[0]).toEqual({
      creatoMs: new Date("2026-09-30T06:07:07Z").getTime(),
      creatoIl: "2026-09-30",
      campaignId: "120253988245940471",
      adId: "120253988245960471",
      stato: "vendita",
      fatturato: 3500,
    });
    expect(contatti[1].stato).toBe("in-contatto");
  });

  it("la colonna stato si trova anche se sta in un'altra posizione (colonna in più prima)", () => {
    const contatti = interpretaFoglioContatti([
      rigaMeta({ data: "2026-09-05T09:00:00Z", extra: ["CREATED"], stato: "Appuntamento fissato" }),
      rigaMeta({ data: "2026-09-06T09:00:00Z", extra: ["CREATED"], stato: "Appuntamento effettuato", fatturato: 0 }),
    ]);
    expect(contatti.map((c) => c.stato)).toEqual(["appuntamento-fissato", "appuntamento-effettuato"]);
  });

  it("\"Non in target\" vale come \"Non lavorabile\"; maiuscole e spazi non contano", () => {
    const contatti = interpretaFoglioContatti([
      rigaMeta({ data: "2026-09-05T09:00:00Z", stato: "Non in target" }),
      rigaMeta({ data: "2026-09-06T09:00:00Z", stato: " non lavorabile " }),
    ]);
    expect(contatti.map((c) => c.stato)).toEqual(["non-lavorabile", "non-lavorabile"]);
  });

  it("stato vuoto = contatto ancora da lavorare; testo fuori menù = altro (mai un appuntamento)", () => {
    const contatti = interpretaFoglioContatti([
      rigaMeta({ data: "2026-09-05T09:00:00Z", stato: "Vendita", fatturato: 100 }),
      rigaMeta({ data: "2026-09-06T09:00:00Z", stato: "" }),
      rigaMeta({ data: "2026-09-07T09:00:00Z", stato: "Richiamare a ottobre" }),
    ]);
    expect(contatti.map((c) => c.stato)).toEqual(["vendita", "da-contattare", "altro"]);
  });

  it("fatturato scritto come testo in formato italiano", () => {
    const contatti = interpretaFoglioContatti([rigaMeta({ data: "2026-09-05T09:00:00Z", stato: "Vendita", fatturato: "€ 3.500,50" })]);
    expect(contatti[0].fatturato).toBe(3500.5);
  });

  it("righe senza una data leggibile (vuote, appunti) vengono scartate", () => {
    const contatti = interpretaFoglioContatti([
      rigaMeta({ data: "2026-09-05T09:00:00Z", stato: "Vendita" }),
      [],
      ["appunto libero", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "In contatto"],
    ]);
    expect(contatti).toHaveLength(1);
  });

  it("modello scritto a mano con intestazioni: data in cella data (seriale) o gg/mm/aaaa, id letti dalle colonne", () => {
    const contatti = interpretaFoglioContatti([
      ["Data contatto", "Nome", "Telefono", "Email", "ID campagna", "ID inserzione", "Stato", "Fatturato", "Note"],
      [46280, "Mario Rossi", "333", "m@example.com", "120253988245940471", "120253988245960471", "Vendita", 4200, ""],
      ["15/09/2026", "Anna Bianchi", "", "", "", "", "Appuntamento fissato", "", "richiamare"],
    ]);
    expect(contatti).toHaveLength(2);
    expect(contatti[0]).toMatchObject({ creatoIl: "2026-09-15", campaignId: "120253988245940471", adId: "120253988245960471", stato: "vendita", fatturato: 4200 });
    expect(contatti[1]).toMatchObject({ creatoIl: "2026-09-15", campaignId: null, adId: null, stato: "appuntamento-fissato", fatturato: 0 });
  });

  it("un numero fuori dalla colonna data non diventa mai una data", () => {
    // Fatturato 46280 nella riga: senza una data vera la riga non è un contatto.
    const contatti = interpretaFoglioContatti([
      ["Data contatto", "Nome", "Stato", "Fatturato"],
      ["", "Mario Rossi", "Vendita", 46280],
    ]);
    expect(contatti).toEqual([]);
  });

  it("foglio senza nessuna colonna di stato (vecchio modello mensile) -> nessun contatto", () => {
    expect(
      interpretaFoglioContatti([
        ["Mese", "Richieste", "Appuntamenti fissati", "Appuntamenti effettuati", "Vendite", "Fatturato"],
        ["2026-09", 10, 4, 3, 1, 3500],
      ])
    ).toEqual([]);
    expect(interpretaFoglioContatti([])).toEqual([]);
  });
});

describe("riepilogoDaContatti", () => {
  const contatti = interpretaFoglioContatti([
    rigaMeta({ data: "2026-09-02T09:00:00Z", campagna: "111111", inserzione: "9000001", stato: "Vendita", fatturato: 3500 }),
    rigaMeta({ data: "2026-09-03T09:00:00Z", campagna: "111111", inserzione: "9000001", stato: "Appuntamento effettuato" }),
    rigaMeta({ data: "2026-09-10T09:00:00Z", campagna: "111111", inserzione: "9000002", stato: "Appuntamento fissato", fatturato: 900 }),
    rigaMeta({ data: "2026-09-11T09:00:00Z", campagna: "222222", inserzione: "9000003", stato: "Non lavorabile" }),
    rigaMeta({ data: "2026-08-20T09:00:00Z", campagna: "333333", inserzione: "9000004", stato: "Vendita", fatturato: 8000 }),
  ]);

  it("imbuto cumulativo sui contatti arrivati nel periodo; fatturato solo delle vendite", () => {
    const r = riepilogoDaContatti(contatti, SETTEMBRE[0], SETTEMBRE[1], null);
    if (!r.connesso) throw new Error("atteso connesso");
    expect(r.fonte).toBe("foglio");
    // Fissati = fissato + effettuato + vendita; effettuati = effettuato + vendita.
    expect(r.appuntamenti).toEqual({ totali: 3, confermati: 3, annullati: 0, effettuati: 2 });
    // I 900 € accanto a "Appuntamento fissato" non sono un incasso; la vendita di agosto è fuori periodo.
    expect(r.opportunita).toEqual({ vendite: 1, fatturato: 3500 });
    expect(r.calendariConfigurati).toBe(true);
    expect(r.campagneAttribuibili).toBe(true);
  });

  it("per campagna e per inserzione: una chiave per ognuna presente nel file, valori del solo periodo", () => {
    const r = riepilogoDaContatti(contatti, SETTEMBRE[0], SETTEMBRE[1], null);
    if (!r.connesso) throw new Error("atteso connesso");
    expect(r.perCampagna["111111"]).toEqual({ appuntamenti: { totali: 3, confermati: 3, annullati: 0, effettuati: 2 }, opportunita: { vendite: 1, fatturato: 3500 } });
    expect(r.perCampagna["222222"].appuntamenti.totali).toBe(0);
    // Campagna con contatti solo ad agosto: presente (ha contatti attribuiti) ma a zero nel periodo.
    expect(r.perCampagna["333333"]).toEqual({ appuntamenti: { totali: 0, confermati: 0, annullati: 0, effettuati: 0 }, opportunita: { vendite: 0, fatturato: 0 } });
    expect(r.perInserzione?.["9000001"].appuntamenti.totali).toBe(2);
    expect(r.perInserzione?.["9000002"].appuntamenti.totali).toBe(1);
  });

  it("filtro campagne: restringe totali e serie settimanali, non il dettaglio per campagna", () => {
    const r = riepilogoDaContatti(contatti, SETTEMBRE[0], SETTEMBRE[1], new Set(["222222"]));
    if (!r.connesso) throw new Error("atteso connesso");
    expect(r.appuntamenti.totali).toBe(0);
    expect(r.opportunita.vendite).toBe(0);
    expect(r.perCampagna["111111"].appuntamenti.totali).toBe(3);
  });

  it("serie settimanali per settimana di arrivo del contatto", () => {
    const r = riepilogoDaContatti(contatti, SETTEMBRE[0], SETTEMBRE[1], null);
    if (!r.connesso) throw new Error("atteso connesso");
    expect(r.appuntamentiPerSettimana).toEqual([
      { settimana: "2026-08-31", fissati: 2, effettuati: 2 },
      { settimana: "2026-09-07", fissati: 1, effettuati: 0 },
    ]);
    expect(r.fatturatoPerSettimana).toEqual([
      { settimana: "2026-08-31", fatturato: 3500, vendite: 1 },
      { settimana: "2026-09-07", fatturato: 0, vendite: 0 },
    ]);
  });
});

describe("idFoglioDaUrl", () => {
  it("estrae l'id da un link Google Sheets, null per qualunque altro link", () => {
    expect(idFoglioDaUrl("https://docs.google.com/spreadsheets/d/1QuVHh4utmmcFepNOVYg-HMP8_rjk/edit#gid=0")).toBe("1QuVHh4utmmcFepNOVYg-HMP8_rjk");
    expect(idFoglioDaUrl("https://drive.google.com/drive/folders/abc")).toBeNull();
  });
});
