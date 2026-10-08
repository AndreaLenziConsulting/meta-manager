import { describe, expect, it } from "vitest";
import {
  controllaRigheCommerciali,
  controllaRigheVenditori,
  erroreSulPeriodo,
  etichettaPeriodo,
  intervalloDelPeriodo,
  periodiSovrapposti,
  periodoDelGiorno,
  periodoFuturo,
  periodoValido,
  settimanaACavalloDiDueMesi,
  spostaPeriodo,
  ultimoPeriodoConcluso,
} from "./risultatiManuali";

// Giovedì 8 ottobre 2026.
const OGGI = "2026-10-08";

describe("periodi", () => {
  it("valido: un mese vero, o il lunedì di una settimana", () => {
    expect(periodoValido("2026-10")).toBe(true);
    expect(periodoValido("2026-10-05")).toBe(true);
    expect(periodoValido("2026-13")).toBe(false);
    expect(periodoValido("2026-10-06")).toBe(false); // martedì
    expect(periodoValido("2026-02-30")).toBe(false);
    expect(periodoValido("ottobre")).toBe(false);
    expect(periodoValido("")).toBe(false);
  });

  it("intervallo: dal primo all'ultimo giorno del mese, o dal lunedì alla domenica", () => {
    expect(intervalloDelPeriodo("2026-02")).toEqual({ da: "2026-02-01", a: "2026-02-28" });
    expect(intervalloDelPeriodo("2026-09-28")).toEqual({ da: "2026-09-28", a: "2026-10-04" });
  });

  it("etichetta in italiano", () => {
    expect(etichettaPeriodo("2026-10")).toBe("Ottobre 2026");
    expect(etichettaPeriodo("2026-09-28")).toBe("28 set – 4 ott 2026");
    expect(etichettaPeriodo("2026-12-28")).toBe("28 dic – 3 gen 2027");
  });

  it("avanti e indietro della stessa grana, anche a cavallo d'anno", () => {
    expect(spostaPeriodo("2026-12", 1)).toBe("2027-01");
    expect(spostaPeriodo("2026-01", -1)).toBe("2025-12");
    expect(spostaPeriodo("2026-10-05", -1)).toBe("2026-09-28");
    expect(spostaPeriodo("2026-12-28", 1)).toBe("2027-01-04");
  });

  it("ultimo periodo concluso e periodo che contiene un giorno", () => {
    expect(ultimoPeriodoConcluso("settimana", OGGI)).toBe("2026-09-28");
    expect(ultimoPeriodoConcluso("mese", OGGI)).toBe("2026-09");
    expect(periodoDelGiorno("settimana", OGGI)).toBe("2026-10-05");
    expect(periodoDelGiorno("mese", OGGI)).toBe("2026-10");
  });

  it("futuro solo se non è ancora cominciato: il periodo in corso si può compilare", () => {
    expect(periodoFuturo("2026-10-05", OGGI)).toBe(false);
    expect(periodoFuturo("2026-10", OGGI)).toBe(false);
    expect(periodoFuturo("2026-10-12", OGGI)).toBe(true);
    expect(periodoFuturo("2026-11", OGGI)).toBe(true);
  });

  it("a cavallo di due mesi: solo una settimana che comincia in un mese e finisce nell'altro", () => {
    expect(settimanaACavalloDiDueMesi("2026-09-28")).toBe(true);
    expect(settimanaACavalloDiDueMesi("2026-10-05")).toBe(false);
    expect(settimanaACavalloDiDueMesi("2026-10")).toBe(false);
  });
});

describe("periodi che si sovrappongono", () => {
  it("un mese e le settimane che lo toccano, anche solo per qualche giorno", () => {
    const compilati = ["2026-09-21", "2026-09-28", "2026-10-05", "2026-11-02", "2026-09"];
    expect(periodiSovrapposti("2026-10", compilati).sort()).toEqual(["2026-09-28", "2026-10-05"]);
  });

  it("una settimana a cavallo tocca tutti e due i mesi", () => {
    expect(periodiSovrapposti("2026-09-28", ["2026-09", "2026-10", "2026-08"]).sort()).toEqual(["2026-09", "2026-10"]);
  });

  it("lo stesso periodo non si sovrappone a sé stesso; settimane diverse e mesi diversi non si toccano", () => {
    expect(periodiSovrapposti("2026-10", ["2026-10", "2026-09", "2026-11"])).toEqual([]);
    expect(periodiSovrapposti("2026-10-05", ["2026-10-05", "2026-09-28", "2026-10-12"])).toEqual([]);
  });
});

describe("erroreSulPeriodo", () => {
  it("si può salvare un periodo libero, e riscrivere uno già compilato", () => {
    expect(erroreSulPeriodo("2026-09-28", true, [], OGGI)).toBeNull();
    expect(erroreSulPeriodo("2026-09-28", true, ["2026-09-28", "2026-09-21"], OGGI)).toBeNull();
  });

  it("un periodo non valido è un errore anche per svuotarlo", () => {
    expect(erroreSulPeriodo("2026-10-06", false, [], OGGI)).toContain("Periodo non valido");
  });

  it("un periodo non ancora cominciato non si compila", () => {
    expect(erroreSulPeriodo("2026-10-12", true, [], OGGI)).toBe("12 ott – 18 ott 2026 non è ancora cominciato: non ci sono risultati da inserire");
  });

  it("un mese non si compila se ha già settimane, e viceversa: si conterebbero due volte", () => {
    expect(erroreSulPeriodo("2026-09", true, ["2026-09-07", "2026-09-14"], OGGI)).toContain("7 set – 13 set 2026, 14 set – 20 set 2026");
    expect(erroreSulPeriodo("2026-09-14", true, ["2026-09"], OGGI)).toContain("Settembre 2026");
  });

  it("svuotare è sempre permesso, anche se ci sono sovrapposizioni o il periodo è futuro", () => {
    expect(erroreSulPeriodo("2026-09", false, ["2026-09-07"], OGGI)).toBeNull();
    expect(erroreSulPeriodo("2026-11", false, [], OGGI)).toBeNull();
  });
});

describe("controllo delle righe", () => {
  const riga = { tipoCampagna: "Cucine", richieste: 12, appuntamentiFissati: 8, appuntamentiEffettuati: 6, vendite: 2, fatturato: 9000.456 };

  it("righe buone: tipo ripulito dagli spazi, fatturato al centesimo", () => {
    expect(controllaRigheCommerciali([{ ...riga, tipoCampagna: " Cucine " }, { ...riga, tipoCampagna: "" }])).toEqual({
      ok: true,
      righe: [
        { ...riga, fatturato: 9000.46 },
        { ...riga, tipoCampagna: "", fatturato: 9000.46 },
      ],
    });
  });

  it("nessuna riga è una risposta valida: vuol dire svuotare il periodo", () => {
    expect(controllaRigheCommerciali([])).toEqual({ ok: true, righe: [] });
  });

  it("lo stesso tipo due volte: errore che dice quale", () => {
    expect(controllaRigheCommerciali([riga, { ...riga }])).toEqual({ ok: false, errore: '"Cucine" compare due volte' });
    expect(controllaRigheCommerciali([{ ...riga, tipoCampagna: "" }, { ...riga, tipoCampagna: " " }])).toEqual({ ok: false, errore: '"Non classificata" compare due volte' });
  });

  it("conteggi con la virgola, negativi o non numerici: errore che dice il campo", () => {
    expect(controllaRigheCommerciali([{ ...riga, vendite: 1.5 }])).toEqual({ ok: false, errore: "Cucine: le vendite devono essere un numero intero, da zero in su" });
    expect(controllaRigheCommerciali([{ ...riga, richieste: -1 }])).toMatchObject({ ok: false });
    expect(controllaRigheCommerciali([{ ...riga, appuntamentiFissati: "8" }])).toMatchObject({ ok: false });
    expect(controllaRigheCommerciali([{ ...riga, appuntamentiEffettuati: undefined }])).toMatchObject({ ok: false });
    expect(controllaRigheCommerciali([{ ...riga, fatturato: -10 }])).toEqual({ ok: false, errore: "Cucine: il fatturato deve essere un importo da zero in su" });
    expect(controllaRigheCommerciali([{ ...riga, fatturato: Number.NaN }])).toMatchObject({ ok: false });
  });

  it("ciò che non è un elenco di righe viene rifiutato", () => {
    expect(controllaRigheCommerciali(undefined)).toMatchObject({ ok: false });
    expect(controllaRigheCommerciali([{ richieste: 1 }])).toEqual({ ok: false, errore: "Tipo di campagna mancante in una riga" });
  });

  it("venditori: solo quelli della sede, una riga ciascuno", () => {
    const sede = new Set(["v1", "v2"]);
    const v = { venditoreId: "v1", appuntamentiFissati: 9, vendite: 2, fatturato: 8000 };
    expect(controllaRigheVenditori([v, { ...v, venditoreId: "v2" }], sede)).toEqual({ ok: true, righe: [v, { ...v, venditoreId: "v2" }] });
    expect(controllaRigheVenditori([{ ...v, venditoreId: "altro" }], sede)).toEqual({ ok: false, errore: "Un venditore indicato non appartiene a questa sede" });
    expect(controllaRigheVenditori([v, v], sede)).toEqual({ ok: false, errore: "Lo stesso venditore compare due volte" });
    expect(controllaRigheVenditori([{ ...v, vendite: 0.5 }], sede)).toMatchObject({ ok: false });
  });
});
