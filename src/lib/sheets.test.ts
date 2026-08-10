import { describe, expect, it } from "vitest";
import {
  guessTipoCampagnaFromNome,
  normalizeData,
  normalizeMese,
  serialToIsoDate,
  toNumber,
  toNumberOrNull,
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
