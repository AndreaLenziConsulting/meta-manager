import { describe, expect, it } from "vitest";
import { erroreAssegnazioneProdotto, giornoValido, prodottoAssegnabile, riepilogoRoadmap } from "./assegnaProdotto";

const PRODOTTI = [
  { prodottoId: "performance", nome: "Performance", attivo: true },
  { prodottoId: "vecchio", nome: "Vecchio", attivo: false },
];
const senzaProdotto = { prodottoId: "", dataInizioProgetto: null };

describe("giornoValido", () => {
  it("accetta solo un giorno che esiste, scritto AAAA-MM-GG", () => {
    expect(giornoValido("2026-10-08")).toBe(true);
    expect(giornoValido("2026-02-30")).toBe(false);
    expect(giornoValido("08/10/2026")).toBe(false);
    expect(giornoValido("2026-10")).toBe(false);
    expect(giornoValido("")).toBe(false);
  });
});

describe("a chi si può assegnare un prodotto", () => {
  it("a chi non ha prodotto, o ha il prodotto ma non la data di inizio", () => {
    expect(prodottoAssegnabile(senzaProdotto)).toBe(true);
    expect(prodottoAssegnabile({ prodottoId: "performance", dataInizioProgetto: null })).toBe(true);
    expect(prodottoAssegnabile({ prodottoId: "performance", dataInizioProgetto: "2026-09-01" })).toBe(false);
  });
});

describe("erroreAssegnazioneProdotto", () => {
  const base = { cliente: senzaProdotto, prodotti: PRODOTTI, prodottoId: "performance", dataInizioProgetto: "2026-10-05" };

  it("un cliente senza prodotto, un prodotto attivo e una data vera: si può", () => {
    expect(erroreAssegnazioneProdotto(base)).toBeNull();
  });

  it("servono il cliente, il prodotto e una data vera", () => {
    expect(erroreAssegnazioneProdotto({ ...base, cliente: undefined })).toEqual({ errore: "Cliente non trovato", stato: 404 });
    expect(erroreAssegnazioneProdotto({ ...base, prodottoId: "" })?.errore).toBe("Scegli un prodotto");
    expect(erroreAssegnazioneProdotto({ ...base, dataInizioProgetto: "" })?.errore).toBe("Indica la data di inizio del progetto");
    expect(erroreAssegnazioneProdotto({ ...base, dataInizioProgetto: "2026-02-31" })?.stato).toBe(400);
  });

  it("un prodotto che non esiste o è disattivato non si assegna", () => {
    expect(erroreAssegnazioneProdotto({ ...base, prodottoId: "inventato" })?.errore).toBe("Prodotto non trovato");
    expect(erroreAssegnazioneProdotto({ ...base, prodottoId: "vecchio" })?.errore).toBe("Il prodotto Vecchio è disattivato: si riattiva da Impostazioni");
  });

  it("chi ha già prodotto e data non lo cambia da qui, nemmeno con lo stesso prodotto", () => {
    const cliente = { prodottoId: "performance", dataInizioProgetto: "2026-09-01" };
    expect(erroreAssegnazioneProdotto({ ...base, cliente })).toEqual({ errore: "Il cliente ha già un prodotto (Performance): da qui non si cambia", stato: 409 });
  });

  it("chi ha il prodotto ma non la data può solo completarlo, non prenderne un altro", () => {
    const cliente = { prodottoId: "vecchio", dataInizioProgetto: null };
    expect(erroreAssegnazioneProdotto({ ...base, cliente })?.stato).toBe(409);
    // Lo stesso prodotto, anche se nel frattempo disattivato, resta un prodotto disattivato: prima va riattivato.
    expect(erroreAssegnazioneProdotto({ ...base, cliente, prodottoId: "vecchio" })?.errore).toContain("disattivato");
    expect(erroreAssegnazioneProdotto({ ...base, cliente: { prodottoId: "performance", dataInizioProgetto: null } })).toBeNull();
  });
});

describe("riepilogoRoadmap", () => {
  const righe = [
    { attivitaId: "c::T1", dataInizio: "2026-09-07", dataFine: "2026-09-13" },
    { attivitaId: "c::T2", dataInizio: "2026-09-14", dataFine: "2026-10-04" },
    { attivitaId: "c::T3", dataInizio: "2026-10-05", dataFine: "2026-11-01" },
  ];

  it("conta le attività che nascono, il loro arco di tempo e quelle già scadute", () => {
    expect(riepilogoRoadmap(righe, new Set(), "2026-10-08")).toEqual({ nuove: 3, giaPresenti: 0, dal: "2026-09-07", al: "2026-11-01", giaScadute: 2 });
  });

  it("una scadenza di oggi non è ancora passata", () => {
    expect(riepilogoRoadmap(righe, new Set(), "2026-10-04").giaScadute).toBe(1);
  });

  it("le attività che il cliente ha già non nascono di nuovo e non entrano nei conti", () => {
    expect(riepilogoRoadmap(righe, new Set(["c::T1", "c::T3"]), "2026-10-08")).toEqual({ nuove: 1, giaPresenti: 2, dal: "2026-09-14", al: "2026-10-04", giaScadute: 1 });
  });

  it("se non nasce nulla non c'è un arco di tempo", () => {
    expect(riepilogoRoadmap([], new Set(), "2026-10-08")).toEqual({ nuove: 0, giaPresenti: 0, dal: null, al: null, giaScadute: 0 });
    expect(riepilogoRoadmap(righe, new Set(righe.map((r) => r.attivitaId)), "2026-10-08")).toMatchObject({ nuove: 0, giaPresenti: 3, dal: null, al: null });
  });
});
