import { describe, expect, it } from "vitest";
import {
  costruisciRichiesteEliminazione,
  guessTipoCampagnaFromNome,
  normalizeData,
  normalizeMese,
  serialToIsoDate,
  toNumber,
  toNumberOrNull,
  trovaIndiceRigaCliente,
  trovaTuttiIndiciRiga,
  ultimoCambioDaRighe,
  type CellValue,
} from "./sheets";

// Queste funzioni sono l'area esatta del bug di produzione (righe MetaDaily duplicate ~3.7x):
// il dedup in upsertMetaDailyRows confronta chiavi "data" costruite da valori che Sheets può
// restituire come numero seriale anche quando li abbiamo scritti come testo "YYYY-MM-DD".
describe("serialToIsoDate", () => {
  it("converte il serial noto 25569 (epoch Unix) in 1970-01-01", () => {
    // Con epoch Sheets = 30/12/1899, 25569 giorni dopo è il 1° gennaio 1970 — è la costante
    // standard usata ovunque per la conversione seriale Sheets/Excel <-> Unix epoch.
    expect(serialToIsoDate(25569)).toBe("1970-01-01");
  });

  it("converte il serial noto 44197 in 2021-01-01", () => {
    expect(serialToIsoDate(44197)).toBe("2021-01-01");
  });

  it("serial 0 e 1 sono i due giorni dell'epoch Sheets (30 e 31 dicembre 1899)", () => {
    expect(serialToIsoDate(0)).toBe("1899-12-30");
    expect(serialToIsoDate(1)).toBe("1899-12-31");
  });

  it("è monotona: il giorno successivo è sempre +1 di data, anche a cavallo di mese/anno", () => {
    const finemese = serialToIsoDate(44926); // 31/12/2022
    const capodanno = serialToIsoDate(44927); // 01/01/2023
    expect(finemese).toBe("2022-12-31");
    expect(capodanno).toBe("2023-01-01");
  });

  it("arrotonda serial non interi (Sheets a volte li restituisce così)", () => {
    expect(serialToIsoDate(44197.0)).toBe("2021-01-01");
  });
});

describe("normalizeData", () => {
  it("converte un valore numerico (Sheets ha silenziosamente trasformato la data in seriale)", () => {
    expect(normalizeData(44197)).toBe("2021-01-01");
  });

  it("lascia invariata una stringa YYYY-MM-DD già testuale", () => {
    expect(normalizeData("2026-07-24")).toBe("2026-07-24");
  });

  it("stringa numerica e numero danno la STESSA chiave normalizzata (il cuore del bug fix)", () => {
    // Se un giorno la stessa data arriva una volta come numero (letta da Sheets) e un'altra come
    // stringa (appena scritta), la chiave di dedup deve combaciare comunque.
    const dallaLettura = normalizeData(44197); // numero seriale
    expect(dallaLettura).toBe("2021-01-01");
  });

  it("undefined/null diventano stringa vuota, non 'undefined'/'null'", () => {
    expect(normalizeData(undefined)).toBe("");
    expect(normalizeData(null)).toBe("");
  });
});

describe("normalizeMese", () => {
  it("da numero seriale estrae solo YYYY-MM", () => {
    expect(normalizeMese(44197)).toBe("2021-01");
  });

  it("da testo 'YYYY-MM' lo lascia invariato", () => {
    expect(normalizeMese("2026-07")).toBe("2026-07");
  });

  it("da testo 'YYYY-MM-DD' (data completa scritta per errore) tronca al mese", () => {
    expect(normalizeMese("2026-07-24")).toBe("2026-07");
  });
});

describe("guessTipoCampagnaFromNome", () => {
  it("estrae il prefisso tra parentesi quadre e lo capitalizza", () => {
    expect(guessTipoCampagnaFromNome("[PROSPECTING] campagna lead form")).toBe("Prospecting");
  });

  it("gestisce prefissi già in minuscolo o misto", () => {
    expect(guessTipoCampagnaFromNome("[retargeting] remarketing 30gg")).toBe("Retargeting");
    expect(guessTipoCampagnaFromNome("[ReMaRkEtInG] test")).toBe("Remarketing");
  });

  it("ignora spazi interni alle parentesi", () => {
    expect(guessTipoCampagnaFromNome("[ Prospecting ] campagna")).toBe("Prospecting");
  });

  it("torna stringa vuota se non c'è un prefisso tra parentesi quadre", () => {
    expect(guessTipoCampagnaFromNome("Campagna senza prefisso")).toBe("");
    expect(guessTipoCampagnaFromNome("")).toBe("");
  });

  it("usa solo il primo blocco tra parentesi quadre", () => {
    expect(guessTipoCampagnaFromNome("[Prospecting] variante [B]")).toBe("Prospecting");
  });
});

describe("toNumber / toNumberOrNull", () => {
  it("toNumber converte stringhe numeriche e ripiega su 0 se non numerico", () => {
    expect(toNumber("42.5")).toBe(42.5);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber(null)).toBe(0);
    expect(toNumber("")).toBe(0);
    expect(toNumber("non un numero")).toBe(0);
  });

  it("toNumberOrNull distingue 'cella vuota' da 'cella con 0'", () => {
    expect(toNumberOrNull("")).toBeNull();
    expect(toNumberOrNull(undefined)).toBeNull();
    expect(toNumberOrNull(null)).toBeNull();
    expect(toNumberOrNull(0)).toBe(0);
    expect(toNumberOrNull("15.5")).toBe(15.5);
    expect(toNumberOrNull("non un numero")).toBeNull();
  });
});

describe("ultimoCambioDaRighe", () => {
  it("tiene la data/ora più recente per ciascuna campagna, non la prima incontrata", () => {
    const righe: CellValue[][] = [
      ["2026-08-01T05:00:00.000Z", "c1", "alc-01", "Camp 1", "", "ACTIVE"],
      ["2026-08-05T05:00:00.000Z", "c1", "alc-01", "Camp 1", "ACTIVE", "PAUSED"],
      ["2026-08-02T05:00:00.000Z", "c2", "alc-01", "Camp 2", "", "ACTIVE"],
    ];
    const ultimo = ultimoCambioDaRighe(righe);
    expect(ultimo.get("c1")).toBe("2026-08-05T05:00:00.000Z");
    expect(ultimo.get("c2")).toBe("2026-08-02T05:00:00.000Z");
  });

  it("ignora righe senza campaign_id o data_ora, senza far esplodere nulla", () => {
    const righe: CellValue[][] = [
      ["", "c1", "alc-01", "Camp 1", "", "ACTIVE"],
      ["2026-08-01T05:00:00.000Z", "", "alc-01", "Camp 1", "", "ACTIVE"],
    ];
    expect(ultimoCambioDaRighe(righe).size).toBe(0);
  });

  it("nessuna riga -> mappa vuota", () => {
    expect(ultimoCambioDaRighe([]).size).toBe(0);
  });
});

describe("trovaIndiceRigaCliente", () => {
  it("trova il numero di riga 1-based (riga 1 = header) del clienteId cercato", () => {
    const righe: CellValue[][] = [
      ["alc-01", "Cliente Uno"],
      ["alc-02", "Cliente Due"],
    ];
    expect(trovaIndiceRigaCliente(righe, "alc-01")).toBe(2);
    expect(trovaIndiceRigaCliente(righe, "alc-02")).toBe(3);
  });

  it("clienteId inesistente -> null", () => {
    const righe: CellValue[][] = [["alc-01", "Cliente Uno"]];
    expect(trovaIndiceRigaCliente(righe, "alc-99")).toBeNull();
  });

  it("nessuna riga -> null", () => {
    expect(trovaIndiceRigaCliente([], "alc-01")).toBeNull();
  });
});

describe("trovaTuttiIndiciRiga", () => {
  it("nessuna corrispondenza -> array vuoto", () => {
    const righe: CellValue[][] = [["alc-01", "Attività A"]];
    expect(trovaTuttiIndiciRiga(righe, (r) => r[0] === "alc-99")).toEqual([]);
  });

  it("più righe corrispondenti -> tutti i numeri di riga, in ordine di apparizione", () => {
    // Caso reale: FasiCompletate, dove la colonna A è clienteId stesso (una riga per fase) — a
    // differenza di trovaIndiceRigaCliente (colonna A = id univoco), qui serve trovarle TUTTE.
    const righe: CellValue[][] = [
      ["alc-01", "Fase 1"],
      ["alc-02", "Fase 1"],
      ["alc-01", "Fase 2"],
    ];
    expect(trovaTuttiIndiciRiga(righe, (r) => r[0] === "alc-01")).toEqual([2, 4]);
  });

  it("righe vuote/incomplete non fanno mai combaciare il predicato per errore", () => {
    const righe: CellValue[][] = [[], ["alc-01"]];
    expect(trovaTuttiIndiciRiga(righe, (r) => r[0] === "alc-01")).toEqual([3]);
  });
});

describe("costruisciRichiesteEliminazione", () => {
  it("ordina le richieste di una stessa tab in modo discendente per numero di riga", () => {
    const richieste = costruisciRichiesteEliminazione(
      [{ tab: "AttivitaCliente", numeriRiga: [3, 10, 5] }],
      new Map([["AttivitaCliente", 111]])
    );
    expect(richieste.map((r) => r.deleteDimension.range.startIndex)).toEqual([9, 4, 2]);
    expect(richieste.every((r) => r.deleteDimension.range.sheetId === 111 && r.deleteDimension.range.dimension === "ROWS")).toBe(true);
  });

  it("gestisce più tab insieme, ognuna col proprio gid", () => {
    const richieste = costruisciRichiesteEliminazione(
      [
        { tab: "Sedi", numeriRiga: [4] },
        { tab: "GhlConnessioni", numeriRiga: [2] },
      ],
      new Map([
        ["Sedi", 5],
        ["GhlConnessioni", 6],
      ])
    );
    expect(richieste).toEqual([
      { deleteDimension: { range: { sheetId: 5, dimension: "ROWS", startIndex: 3, endIndex: 4 } } },
      { deleteDimension: { range: { sheetId: 6, dimension: "ROWS", startIndex: 1, endIndex: 2 } } },
    ]);
  });

  it("una voce con numeriRiga vuoto non genera richieste, anche senza gid in mappa", () => {
    const richieste = costruisciRichiesteEliminazione([{ tab: "FasiCompletate", numeriRiga: [] }], new Map());
    expect(richieste).toEqual([]);
  });

  it("lancia se manca il gid di una tab che ha davvero righe da eliminare", () => {
    expect(() => costruisciRichiesteEliminazione([{ tab: "Sedi", numeriRiga: [3] }], new Map())).toThrow(/Sedi/);
  });
});
