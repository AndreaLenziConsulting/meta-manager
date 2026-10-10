import { describe, expect, it } from "vitest";
import { accorcia, dividiInDue, elencoNomi, larghezzaStimata, nomeNelloSchema, quantiCommerciali, rigaCommerciali } from "./schemaTesto";

describe("accorcia", () => {
  it("lascia stare un nome che ci sta", () => {
    expect(accorcia("Metra Arredamenti", 34)).toBe("Metra Arredamenti");
  });
  it("taglia un nome lungo e lo chiude coi puntini, senza superare il massimo", () => {
    const corto = accorcia("Consorzio Nazionale dei Produttori di Arredamento su Misura", 20);
    expect(corto.endsWith("…")).toBe(true);
    expect(corto.length).toBeLessThanOrEqual(20);
  });
  it("non lascia uno spazio prima dei puntini", () => {
    expect(accorcia("Hygge Casa Sesto", 12)).toBe("Hygge Casa…");
  });
});

describe("nomeNelloSchema", () => {
  it("senza nome dice che manca: lo schema userà la dicitura generica", () => {
    expect(nomeNelloSchema(undefined, 30)).toBeNull();
    expect(nomeNelloSchema("   ", 30)).toBeNull();
  });
  it("col nome lo restituisce pulito", () => {
    expect(nomeNelloSchema("  Agricobots ", 30)).toBe("Agricobots");
  });
});

describe("dividiInDue", () => {
  it("spezza su uno spazio, in due righe quasi uguali", () => {
    const [a, b] = dividiInDue("«Ciao, sono X di Agricobots, ti sto contattando perché hai richiesto Z…»");
    expect(`${a} ${b}`).toBe("«Ciao, sono X di Agricobots, ti sto contattando perché hai richiesto Z…»");
    expect(Math.abs(a.length - b.length)).toBeLessThanOrEqual(8);
  });
  it("una parola sola resta una riga", () => {
    expect(dividiInDue("Agricobots")).toEqual(["Agricobots"]);
  });
});

describe("larghezzaStimata", () => {
  it("le maiuscole pesano più delle minuscole, gli spazi meno", () => {
    expect(larghezzaStimata("METRA")).toBeGreaterThan(larghezzaStimata("metra"));
    expect(larghezzaStimata("a b")).toBeLessThan(larghezzaStimata("aab"));
  });
  it("la riga d'esempio originale dello schema del setting sta nel suo riquadro (192 a misura 10)", () => {
    expect(larghezzaStimata("«Ciao, sono X di Y, ti sto contattando") * 10).toBeLessThanOrEqual(192);
  });
});

describe("elencoNomi", () => {
  it("uno, due, tre nomi come si dicono", () => {
    expect(elencoNomi(["Anna"])).toBe("Anna");
    expect(elencoNomi(["Anna", "Marco"])).toBe("Anna e Marco");
    expect(elencoNomi(["Anna", "Marco", "Sara"])).toBe("Anna, Marco e Sara");
  });
  it("oltre il massimo conta i restanti", () => {
    expect(elencoNomi(["A", "B", "C", "D", "E"], 4)).toBe("A, B, C, D e un altro");
    expect(elencoNomi(["A", "B", "C", "D", "E", "F"], 4)).toBe("A, B, C, D e altri 2");
  });
  it("nessun nome: stringa vuota", () => {
    expect(elencoNomi([])).toBe("");
  });
});

describe("rigaCommerciali", () => {
  it("nessun commerciale registrato: null, lo schema resta generico", () => {
    expect(rigaCommerciali(undefined)).toBeNull();
    expect(rigaCommerciali([])).toBeNull();
    expect(rigaCommerciali([{ sede: "Sesto", nomi: [] }])).toBeNull();
  });
  it("una sede sola: i soli nomi", () => {
    expect(rigaCommerciali([{ sede: "", nomi: ["Vittorio", "Stefano"] }])).toBe("Vittorio e Stefano");
  });
  it("più sedi: ogni sede coi suoi nomi fra parentesi", () => {
    expect(
      rigaCommerciali([
        { sede: "Sesto", nomi: ["Giovanni", "Ruben"] },
        { sede: "Anagnina", nomi: ["Claudia"] },
      ])
    ).toBe("Sesto (Giovanni e Ruben) · Anagnina (Claudia)");
  });
});

describe("quantiCommerciali", () => {
  it("somma i nomi di tutte le sedi", () => {
    expect(quantiCommerciali(undefined)).toBe(0);
    expect(quantiCommerciali([{ sede: "A", nomi: ["x", "y"] }, { sede: "B", nomi: ["z"] }])).toBe(3);
  });
});
