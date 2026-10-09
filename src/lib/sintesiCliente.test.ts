import { describe, expect, it } from "vitest";
import { fraseLavori, frasiNumeri, inizioFrasePeriodo, quandoScade, sintesiLavori } from "./sintesiCliente";
import type { AttivitaClienteRow } from "@/types/kpi";

const OGGI = "2026-10-09";

const numeri = (over: Partial<Parameters<typeof frasiNumeri>[0]["totale"]> = {}) => ({
  investimento: 1326,
  numeroLead: 191,
  costoPerLead: 6.94,
  appuntamentiFissati: 0,
  appuntamentiEffettuati: 0,
  numeroVendite: 0,
  fatturato: 0,
  ...over,
});
const base = { inizio: "Negli ultimi 30 giorni", precedente: null, confronto: "al periodo precedente", commercialiInseriti: false };

describe("come comincia la frase del periodo", () => {
  it("i periodi predefiniti hanno la loro frase, quello scelto a mano le sue date", () => {
    expect(inizioFrasePeriodo("ultimi-30-giorni", "2026-09-10", OGGI)).toBe("Negli ultimi 30 giorni");
    expect(inizioFrasePeriodo("mese-scorso", "2026-09-01", "2026-09-30")).toBe("Il mese scorso");
    expect(inizioFrasePeriodo("personalizzato", "2026-09-01", "2026-09-15")).toBe("Nel periodo 1 set 2026 – 15 set 2026");
  });
});

describe("le frasi sui numeri", () => {
  it("spesa, contatti e costo per contatto, con gli stessi numeri delle tessere", () => {
    expect(frasiNumeri({ ...base, totale: numeri() })).toEqual(["Negli ultimi 30 giorni hai investito €1.326 e sono arrivati 191 contatti, a €6,94 l'uno."]);
    expect(frasiNumeri({ ...base, totale: numeri({ investimento: 40, numeroLead: 1, costoPerLead: 40 }) })[0]).toBe("Negli ultimi 30 giorni hai investito €40,00 e è arrivato 1 contatto, a €40,00 l'uno.");
  });

  it("senza spesa o senza contatti lo dice, senza inventare un costo", () => {
    expect(frasiNumeri({ ...base, totale: numeri({ investimento: 0, numeroLead: 0, costoPerLead: null }) })).toEqual(["Negli ultimi 30 giorni non c'è stata spesa pubblicitaria."]);
    expect(frasiNumeri({ ...base, totale: numeri({ investimento: 250, numeroLead: 0, costoPerLead: null }) })).toEqual(["Negli ultimi 30 giorni hai investito €250,00 e non sono ancora arrivati contatti."]);
  });

  it("confronta col periodo precedente contatti e costo per contatto", () => {
    const frasi = frasiNumeri({ ...base, totale: numeri(), precedente: numeri({ numeroLead: 160, costoPerLead: 7.9 }) });
    expect(frasi[1]).toBe("Rispetto al periodo precedente, i contatti sono saliti del 19% e il costo per contatto è sceso del 12%.");
    const peggio = frasiNumeri({ ...base, confronto: "a 1 lug 2026 – 31 lug 2026", totale: numeri({ numeroLead: 100, costoPerLead: 10 }), precedente: numeri({ numeroLead: 125, costoPerLead: 8 }) });
    expect(peggio[1]).toBe("Rispetto a 1 lug 2026 – 31 lug 2026, i contatti sono scesi del 20% e il costo per contatto è salito del 25%.");
  });

  it("una variazione sotto l'1% è \"stabile\"", () => {
    const frasi = frasiNumeri({ ...base, totale: numeri(), precedente: numeri({ numeroLead: 191, costoPerLead: 6.96 }) });
    expect(frasi[1]).toBe("Rispetto al periodo precedente, i contatti sono rimasti stabili e il costo per contatto è rimasto stabile.");
  });

  it("nessun confronto se uno dei due periodi non ha contatti", () => {
    expect(frasiNumeri({ ...base, totale: numeri(), precedente: numeri({ numeroLead: 0, costoPerLead: null }) })).toHaveLength(1);
    expect(frasiNumeri({ ...base, totale: numeri({ numeroLead: 0, costoPerLead: null }), precedente: numeri() })).toHaveLength(1);
  });

  it("appuntamenti e vendite solo se qualcuno li ha inseriti per quel periodo", () => {
    const conRisultati = numeri({ appuntamentiFissati: 12, appuntamentiEffettuati: 9, numeroVendite: 3, fatturato: 10494 });
    expect(frasiNumeri({ ...base, totale: conRisultati })).toHaveLength(1);
    expect(frasiNumeri({ ...base, totale: conRisultati, commercialiInseriti: true })[1]).toBe("Da questi contatti: 12 appuntamenti prenotati (9 già fatti), 3 vendite per €10.494.");
    expect(frasiNumeri({ ...base, totale: numeri({ appuntamentiFissati: 1, appuntamentiEffettuati: 0 }), commercialiInseriti: true })[1]).toBe("Da questi contatti: 1 appuntamento prenotato (0 già fatti), nessuna vendita registrata.");
  });
});

function attivita(over: Partial<AttivitaClienteRow>): AttivitaClienteRow {
  return {
    attivitaId: Math.random().toString(36).slice(2), clienteId: "c", prodottoId: "ac", taskId: "T", blocco: "setup",
    fase: "Costruzione del sistema", descrizione: "Attività del team", assegnatari: ["Project Manager"], tipo: "PM",
    dataInizio: "2026-10-05", dataFine: "2026-10-11", stato: "todo", notaTeam: "", ordine: 1, ...over,
  };
}

describe("lo stato dei lavori", () => {
  it("senza attività non c'è nulla da dire", () => {
    expect(sintesiLavori([], OGGI)).toBeNull();
  });

  it("l'avanzamento conta solo la roadmap del prodotto, non le attività sparse a mano o da meeting", () => {
    const lavori = sintesiLavori(
      [
        attivita({ stato: "done" }),
        attivita({ stato: "todo" }),
        attivita({ prodottoId: "meeting", fase: "", stato: "todo" }),
        attivita({ prodottoId: "manuale", fase: "Cose varie", stato: "todo" }),
      ],
      OGGI
    )!;
    expect(lavori.avanzamento).toEqual({ totali: 2, fatte: 1, fasiInCorso: ["Costruzione del sistema"] });
  });

  it("un cliente con sole attività sparse non ha una frase di avanzamento: sarebbe un elenco, non un piano", () => {
    const sparse = Array.from({ length: 39 }, () => attivita({ prodottoId: "meeting", fase: "Da meeting" }));
    expect(sintesiLavori(sparse, OGGI)).toBeNull();
    const conUnCompito = sintesiLavori([...sparse, attivita({ prodottoId: "meeting", descrizione: "Mandare le foto", assegnatari: ["Cliente"] })], OGGI)!;
    expect(conUnCompito.avanzamento).toBeNull();
    expect(conUnCompito.serveDaTe.map((a) => a.descrizione)).toEqual(["Mandare le foto"]);
  });

  it("conta fatte e totali, e nomina le fasi cominciate e non finite, dalla più vecchia", () => {
    const lavori = sintesiLavori(
      [
        attivita({ fase: "Analisi", stato: "done", dataInizio: "2026-09-21" }),
        attivita({ fase: "Analisi", stato: "done", dataInizio: "2026-09-21" }),
        attivita({ fase: "Costruzione del sistema", stato: "done", dataInizio: "2026-09-28" }),
        attivita({ fase: "Costruzione del sistema", stato: "todo", dataInizio: "2026-09-28" }),
        attivita({ fase: "Lancio", stato: "todo", dataInizio: "2026-10-05" }),
        attivita({ fase: "Ottimizzazione", stato: "todo", dataInizio: "2026-11-02", dataFine: "2026-11-08" }),
        attivita({ fase: "", stato: "todo", dataInizio: "2026-10-01" }),
      ],
      OGGI
    );
    expect(lavori?.avanzamento).toEqual({ totali: 7, fatte: 3, fasiInCorso: ["Costruzione del sistema", "Lancio"] });
    expect(fraseLavori(lavori!.avanzamento!)).toBe("3 attività fatte su 7. In corso le fasi: Costruzione del sistema, Lancio.");
  });

  it("una fase avviata a mano prima della sua data è in corso; con tutto fatto lo dice", () => {
    expect(sintesiLavori([attivita({ fase: "Lancio", stato: "wip", dataInizio: "2026-11-02", dataFine: "2026-11-08" })], OGGI)?.avanzamento?.fasiInCorso).toEqual(["Lancio"]);
    const finito = sintesiLavori([attivita({ stato: "done" }), attivita({ stato: "done" })], OGGI)!.avanzamento!;
    expect(finito.fasiInCorso).toEqual([]);
    expect(fraseLavori(finito)).toBe("Tutte le 2 attività previste sono state fatte.");
    expect(fraseLavori(sintesiLavori([attivita({ stato: "done" }), attivita({ fase: "", stato: "todo" })], OGGI)!.avanzamento!)).toBe("1 attività fatta su 2.");
  });
});

describe("serve da te", () => {
  const perIlCliente = (over: Partial<AttivitaClienteRow>) => attivita({ assegnatari: ["Cliente"], tipo: "CL", ...over });

  it("solo le attività assegnate al cliente e non fatte: quelle del team non compaiono mai", () => {
    const lavori = sintesiLavori(
      [
        attivita({ descrizione: "Sollecitare il pagamento" }),
        perIlCliente({ descrizione: "Accessi al Business Manager", dataFine: "2026-10-06" }),
        perIlCliente({ descrizione: "Già consegnato", stato: "done" }),
        attivita({ descrizione: "Materiali del negozio", assegnatari: ["Consulente Senior", "Cliente"], dataFine: "2026-10-12" }),
      ],
      OGGI
    )!;
    expect(lavori.serveDaTe).toEqual([
      { descrizione: "Accessi al Business Manager", scadenza: "2026-10-06", giorniDiRitardo: 3 },
      { descrizione: "Materiali del negozio", scadenza: "2026-10-12", giorniDiRitardo: 0 },
    ]);
    expect(lavori.altreDaTe).toBe(0);
  });

  it("una tappa non è un compito: non compare fra le cose da fare, anche se porta il nome del cliente", () => {
    const lavori = sintesiLavori([perIlCliente({ descrizione: "MILESTONE: Review Mese 1", tipo: "MIL" }), perIlCliente({ descrizione: "Mandare le foto" })], OGGI)!;
    expect(lavori.serveDaTe.map((a) => a.descrizione)).toEqual(["Mandare le foto"]);
  });

  it("un compito previsto più avanti non è ancora del cliente; uno in scadenza entro una settimana sì", () => {
    const lavori = sintesiLavori(
      [
        perIlCliente({ descrizione: "Fra due mesi", dataInizio: "2026-12-07", dataFine: "2026-12-13" }),
        perIlCliente({ descrizione: "Scade fra sei giorni", dataInizio: "2026-10-12", dataFine: "2026-10-15" }),
      ],
      OGGI
    )!;
    expect(lavori.serveDaTe.map((a) => a.descrizione)).toEqual(["Scade fra sei giorni"]);
  });

  it("ne elenca cinque, le più urgenti, e conta le altre", () => {
    const tante = Array.from({ length: 8 }, (_, i) => perIlCliente({ descrizione: `Compito ${i + 1}`, dataFine: `2026-10-0${i + 1}` }));
    const lavori = sintesiLavori(tante, OGGI)!;
    expect(lavori.serveDaTe.map((a) => a.descrizione)).toEqual(["Compito 1", "Compito 2", "Compito 3", "Compito 4", "Compito 5"]);
    expect(lavori.altreDaTe).toBe(3);
  });

  it("dice quando scade con parole semplici", () => {
    expect(quandoScade({ descrizione: "", scadenza: "2026-10-06", giorniDiRitardo: 3 }, OGGI)).toBe("scaduta da 3 giorni");
    expect(quandoScade({ descrizione: "", scadenza: "2026-10-08", giorniDiRitardo: 1 }, OGGI)).toBe("scaduta da 1 giorno");
    expect(quandoScade({ descrizione: "", scadenza: OGGI, giorniDiRitardo: 0 }, OGGI)).toBe("scade oggi");
    expect(quandoScade({ descrizione: "", scadenza: "2026-10-12", giorniDiRitardo: 0 }, OGGI)).toBe("scadenza 12 ott");
  });
});
