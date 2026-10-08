import { describe, expect, it } from "vitest";
import { etichettaIntervallo, etichettaIntervalloBreve, intervalloPreset, mesiEquivalenti, periodoPrecedente } from "./periodo";
import { normalizzaIntervallo } from "./kpi";

// 2026-09-25 è un venerdì: la settimana corrente parte da lunedì 2026-09-21.
const OGGI = "2026-09-25";

describe("intervalloPreset", () => {
  it("Ultimi 30 giorni = 30 giorni oggi compreso (27 ago → 25 set, come Meta)", () => {
    expect(intervalloPreset("ultimi-30-giorni", OGGI)).toEqual({ da: "2026-08-27", a: "2026-09-25" });
    expect(intervalloPreset("ultimi-7-giorni", OGGI)).toEqual({ da: "2026-09-19", a: "2026-09-25" });
  });

  it("oggi/ieri sono un solo giorno", () => {
    expect(intervalloPreset("oggi", OGGI)).toEqual({ da: OGGI, a: OGGI });
    expect(intervalloPreset("ieri", OGGI)).toEqual({ da: "2026-09-24", a: "2026-09-24" });
  });

  it("questa settimana arriva a oggi, settimana scorsa è lunedì→domenica intera", () => {
    expect(intervalloPreset("questa-settimana", OGGI)).toEqual({ da: "2026-09-21", a: OGGI });
    expect(intervalloPreset("settimana-scorsa", OGGI)).toEqual({ da: "2026-09-14", a: "2026-09-20" });
  });

  it("questo mese arriva a oggi, mese scorso è il mese intero — anche a cavallo d'anno", () => {
    expect(intervalloPreset("questo-mese", OGGI)).toEqual({ da: "2026-09-01", a: OGGI });
    expect(intervalloPreset("mese-scorso", OGGI)).toEqual({ da: "2026-08-01", a: "2026-08-31" });
    expect(intervalloPreset("mese-scorso", "2026-01-15")).toEqual({ da: "2025-12-01", a: "2025-12-31" });
  });

  it("ultimi 3/6 mesi partono dal 1° del mese N-2/N-5 (stessa semantica dei preset precedenti)", () => {
    expect(intervalloPreset("ultimi-3-mesi", OGGI)).toEqual({ da: "2026-07-01", a: OGGI });
    expect(intervalloPreset("ultimi-6-mesi", OGGI)).toEqual({ da: "2026-04-01", a: OGGI });
  });

  it("anno corrente arriva a oggi, anno precedente è l'anno intero", () => {
    expect(intervalloPreset("anno-corrente", OGGI)).toEqual({ da: "2026-01-01", a: OGGI });
    expect(intervalloPreset("anno-precedente", OGGI)).toEqual({ da: "2025-01-01", a: "2025-12-31" });
  });
});

describe("periodoPrecedente", () => {
  it("stesso numero di giorni, subito prima di `da`", () => {
    expect(periodoPrecedente("2026-08-27", "2026-09-25")).toEqual({ da: "2026-07-28", a: "2026-08-26" });
    expect(periodoPrecedente("2026-09-25", "2026-09-25")).toEqual({ da: "2026-09-24", a: "2026-09-24" });
  });
});

describe("mesiEquivalenti", () => {
  it("un mese di calendario vale ~1, una settimana ~0,23", () => {
    expect(mesiEquivalenti("2026-09-01", "2026-09-30")).toBeCloseTo(0.986, 2);
    expect(mesiEquivalenti("2026-09-21", "2026-09-27")).toBeCloseTo(0.23, 2);
  });
});

describe("normalizzaIntervallo", () => {
  it("un mese diventa 1° → ultimo giorno, un giorno passa invariato", () => {
    expect(normalizzaIntervallo("2026-06", "2026-06")).toEqual({ da: "2026-06-01", a: "2026-06-30" });
    expect(normalizzaIntervallo("2026-06", "2026-07")).toEqual({ da: "2026-06-01", a: "2026-07-31" });
    expect(normalizzaIntervallo("2026-06-15", "2026-06-21")).toEqual({ da: "2026-06-15", a: "2026-06-21" });
  });
});

describe("etichettaIntervallo", () => {
  it("due giorni distinti con trattino, un giorno solo senza", () => {
    expect(etichettaIntervallo("2026-08-27", "2026-09-25")).toBe("27 ago 2026 – 25 set 2026");
    expect(etichettaIntervallo("2026-09-25", "2026-09-25")).toBe("25 set 2026");
  });
});

describe("etichettaIntervalloBreve", () => {
  it("nello stesso anno scrive l'anno una volta sola", () => {
    expect(etichettaIntervalloBreve("2026-08-27", "2026-09-25")).toBe("27 ago – 25 set 2026");
  });

  it("a cavallo di due anni li scrive entrambi, e un giorno solo resta com'è", () => {
    expect(etichettaIntervalloBreve("2025-12-20", "2026-01-10")).toBe("20 dic 2025 – 10 gen 2026");
    expect(etichettaIntervalloBreve("2026-09-25", "2026-09-25")).toBe("25 set 2026");
  });
});
