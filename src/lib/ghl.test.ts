import { describe, expect, it } from "vitest";
import {
  appuntamentiGhlPerSettimana,
  breakdownGhlPerCampagna,
  estraiCampaignIdAttribuzione,
  fatturatoGhlPerSettimana,
  mappaCampagnaPerContatto,
  primoAppuntamentoPerContatto,
  riepilogoAppuntamenti,
  riepilogoOpportunita,
  riepilogoPerTag,
  riepilogoPerVenditoreGhl,
  andamentoPerVenditoreGhl,
} from "./ghl";
import type { GhlAppuntamento, GhlAttribuzione, GhlOpportunita } from "@/types/ghl";
import { riepilogoSenzaTag } from "./ghl";
import { breakdownGhlPerInserzione, estraiAdIdAttribuzione, mappaInserzionePerContatto } from "./ghl";
import { pipelineDiCategoria, restringiAllePipeline, riepilogoPerPipeline, riepilogoSenzaPipeline } from "./ghl";

function appuntamento(overrides: Partial<GhlAppuntamento> = {}): GhlAppuntamento {
  return {
    id: "a1",
    calendarId: "c1",
    contactId: "ct1",
    title: "Consulenza",
    appointmentStatus: "confirmed",
    startTime: "2026-01-01T10:00:00+01:00",
    endTime: "2026-01-01T10:30:00+01:00",
    dateAdded: "2026-08-05T09:00:00Z",
    deleted: false,
    ...overrides,
  };
}

function opportunita(overrides: Partial<GhlOpportunita> = {}): GhlOpportunita {
  return {
    id: "o1",
    name: "Mario Rossi",
    monetaryValue: 0,
    status: "open",
    source: "Lead Ads",
    contactId: "ct1",
    createdAt: "2026-01-01T10:00:00Z",
    lastStatusChangeAt: "2026-01-01T10:00:00Z",
    ...overrides,
  };
}

const AGOSTO_INIZIO = new Date("2026-08-01T00:00:00Z").getTime();
const AGOSTO_FINE = new Date("2026-08-31T23:59:59Z").getTime();
// Riferimento fisso per "ora" nei test di `effettuati` — mai il vero Date.now(), stesso motivo
// per cui AGOSTO_INIZIO/AGOSTO_FINE sopra sono costanti e non derivate dalla data reale.
const ORA_RIFERIMENTO = new Date("2026-08-27T12:00:00Z").getTime();

describe("riepilogoAppuntamenti", () => {
  it("nessun appuntamento -> tutti zero", () => {
    expect(riepilogoAppuntamenti([], AGOSTO_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO)).toEqual({
      totali: 0,
      confermati: 0,
      annullati: 0,
      effettuati: 0,
    });
  });

  it("conta confermati e annullati separatamente dal totale, per dateAdded nel periodo", () => {
    const lista = [
      appuntamento({ id: "1", appointmentStatus: "confirmed" }),
      appuntamento({ id: "2", appointmentStatus: "confirmed" }),
      appuntamento({ id: "3", appointmentStatus: "cancelled" }),
    ];
    expect(riepilogoAppuntamenti(lista, AGOSTO_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO)).toEqual({
      totali: 3,
      confermati: 2,
      annullati: 1,
      effettuati: 2, // i 2 confermati hanno startTime (1 gennaio) già passato rispetto a ORA_RIFERIMENTO
    });
  });

  it("esclude gli appuntamenti eliminati dal totale (e da effettuati)", () => {
    const lista = [appuntamento({ id: "1", deleted: true }), appuntamento({ id: "2", deleted: false })];
    expect(riepilogoAppuntamenti(lista, AGOSTO_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO)).toEqual({
      totali: 1,
      confermati: 1,
      annullati: 0,
      effettuati: 1,
    });
  });

  it("uno stato diverso da confirmed/cancelled (es. non ancora osservato in produzione) non è né confermato né annullato", () => {
    const lista = [appuntamento({ appointmentStatus: "showed" })];
    expect(riepilogoAppuntamenti(lista, AGOSTO_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO)).toEqual({
      totali: 1,
      confermati: 0,
      annullati: 0,
      effettuati: 1, // non è "cancelled" ed è nel passato -> standard operativo lo conta come effettuato
    });
  });

  it("conta per QUANDO È STATA FATTA LA PRENOTAZIONE (dateAdded), non per quando si tiene l'incontro (startTime)", () => {
    // Prenotato ad agosto per un incontro a ottobre (magari poi riprogrammato): resta "fissato ad agosto".
    const prenotatoAdAgosto = appuntamento({ id: "1", dateAdded: "2026-08-10T00:00:00Z", startTime: "2026-10-01T10:00:00Z" });
    // Prenotato a luglio per un incontro ad agosto: NON è un appuntamento fissato ad agosto.
    const prenotatoALuglio = appuntamento({ id: "2", dateAdded: "2026-07-20T00:00:00Z", startTime: "2026-08-05T10:00:00Z" });
    expect(riepilogoAppuntamenti([prenotatoAdAgosto, prenotatoALuglio], AGOSTO_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO)).toEqual({
      totali: 1,
      confermati: 1,
      annullati: 0,
      effettuati: 0, // l'unico fissato ad agosto ha l'incontro il 1° ottobre: ancora nel futuro, non effettuato
    });
  });

  describe("effettuati — standard operativo: incontro passato (startTime) e mai annullato", () => {
    it("confermato con incontro già passato -> effettuato", () => {
      const lista = [appuntamento({ appointmentStatus: "confirmed", startTime: "2026-08-01T10:00:00Z" })];
      expect(riepilogoAppuntamenti(lista, AGOSTO_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO).effettuati).toBe(1);
    });

    it("confermato ma incontro ancora nel futuro -> NON effettuato", () => {
      const lista = [appuntamento({ appointmentStatus: "confirmed", startTime: "2026-09-01T10:00:00Z" })];
      expect(riepilogoAppuntamenti(lista, AGOSTO_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO).effettuati).toBe(0);
    });

    it("annullato, anche con incontro passato -> mai effettuato", () => {
      const lista = [appuntamento({ appointmentStatus: "cancelled", startTime: "2026-08-01T10:00:00Z" })];
      expect(riepilogoAppuntamenti(lista, AGOSTO_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO).effettuati).toBe(0);
    });
  });
});

describe("riepilogoOpportunita", () => {
  it("nessuna opportunità -> tutti zero", () => {
    expect(riepilogoOpportunita([], AGOSTO_INIZIO, AGOSTO_FINE)).toEqual({ vendite: 0, fatturato: 0 });
  });

  it("somma il monetaryValue solo delle opportunità vinte NEL PERIODO (per lastStatusChangeAt, non createdAt)", () => {
    const lista = [
      opportunita({ id: "1", status: "won", monetaryValue: 1000, createdAt: "2026-01-01T00:00:00Z", lastStatusChangeAt: "2026-08-05T00:00:00Z" }),
      opportunita({ id: "2", status: "won", monetaryValue: 2500, lastStatusChangeAt: "2026-08-20T00:00:00Z" }),
      opportunita({ id: "3", status: "open", monetaryValue: 9999, lastStatusChangeAt: "2026-08-10T00:00:00Z" }),
      opportunita({ id: "4", status: "lost", monetaryValue: 500, lastStatusChangeAt: "2026-08-10T00:00:00Z" }),
    ];
    // La n.1 è stata CREATA a gennaio ma VINTA ad agosto: deve comunque contare come vendita di agosto.
    expect(riepilogoOpportunita(lista, AGOSTO_INIZIO, AGOSTO_FINE)).toEqual({ vendite: 2, fatturato: 3500 });
  });

  it("esclude un'opportunità vinta fuori dal periodo anche se creata dentro", () => {
    const lista = [opportunita({ status: "won", monetaryValue: 1000, createdAt: "2026-08-01T00:00:00Z", lastStatusChangeAt: "2026-09-15T00:00:00Z" })];
    expect(riepilogoOpportunita(lista, AGOSTO_INIZIO, AGOSTO_FINE)).toEqual({ vendite: 0, fatturato: 0 });
  });
});

describe("fatturatoGhlPerSettimana", () => {
  const GIU_INIZIO = new Date("2026-06-01T00:00:00Z").getTime(); // 2026-06-01 è un lunedì

  it("nessuna opportunità -> array vuoto", () => {
    expect(fatturatoGhlPerSettimana([], GIU_INIZIO, AGOSTO_FINE)).toEqual([]);
  });

  it("raggruppa per settimana (lunedì) di lastStatusChangeAt, ordinato, sole vinte nel periodo", () => {
    const lista = [
      opportunita({ id: "1", status: "won", monetaryValue: 1000, lastStatusChangeAt: "2026-08-05T00:00:00Z" }), // settimana 2026-08-03
      opportunita({ id: "2", status: "won", monetaryValue: 2500, lastStatusChangeAt: "2026-08-20T00:00:00Z" }), // settimana 2026-08-17
      opportunita({ id: "3", status: "won", monetaryValue: 400, lastStatusChangeAt: "2026-06-10T00:00:00Z" }), // settimana 2026-06-08
      opportunita({ id: "4", status: "open", monetaryValue: 9999, lastStatusChangeAt: "2026-07-10T00:00:00Z" }),
      opportunita({ id: "5", status: "won", monetaryValue: 500, lastStatusChangeAt: "2026-05-10T00:00:00Z" }), // fuori periodo anche allargato
    ];
    expect(fatturatoGhlPerSettimana(lista, GIU_INIZIO, AGOSTO_FINE)).toEqual([
      { settimana: "2026-06-08", fatturato: 400, vendite: 1 },
      { settimana: "2026-08-03", fatturato: 1000, vendite: 1 },
      { settimana: "2026-08-17", fatturato: 2500, vendite: 1 },
    ]);
  });

  it("allarga la finestra fino alla domenica dell'ultima settimana, non si ferma alla fine calendario del mese `a`", () => {
    // AGOSTO_FINE è il 31 agosto 2026 (un lunedì): la sua settimana arriva fino a domenica 6 settembre.
    const lista = [opportunita({ status: "won", monetaryValue: 777, lastStatusChangeAt: "2026-09-03T00:00:00Z" })];
    expect(fatturatoGhlPerSettimana(lista, GIU_INIZIO, AGOSTO_FINE)).toEqual([{ settimana: "2026-08-31", fatturato: 777, vendite: 1 }]);
  });

  it("allarga la finestra fino al lunedì della prima settimana quando l'inizio richiesto non è un lunedì", () => {
    const inizioMercoledi = new Date("2026-08-05T00:00:00Z").getTime(); // mercoledì, settimana 2026-08-03
    const lista = [opportunita({ status: "won", monetaryValue: 111, lastStatusChangeAt: "2026-08-03T00:00:00Z" })]; // lunedì della stessa settimana, prima di startMs alla lettera
    expect(fatturatoGhlPerSettimana(lista, inizioMercoledi, AGOSTO_FINE)).toContainEqual({ settimana: "2026-08-03", fatturato: 111, vendite: 1 });
  });

  it("conta le vendite (non solo il fatturato) quando più opportunità vinte cadono nella stessa settimana", () => {
    const lista = [
      opportunita({ id: "1", status: "won", monetaryValue: 1000, lastStatusChangeAt: "2026-08-05T00:00:00Z" }),
      opportunita({ id: "2", status: "won", monetaryValue: 500, lastStatusChangeAt: "2026-08-06T00:00:00Z" }), // stessa settimana 2026-08-03
    ];
    expect(fatturatoGhlPerSettimana(lista, GIU_INIZIO, AGOSTO_FINE)).toEqual([{ settimana: "2026-08-03", fatturato: 1500, vendite: 2 }]);
  });
});

describe("appuntamentiGhlPerSettimana", () => {
  const GIU_INIZIO = new Date("2026-06-01T00:00:00Z").getTime();

  it("nessun appuntamento -> array vuoto", () => {
    expect(appuntamentiGhlPerSettimana([], GIU_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO)).toEqual([]);
  });

  it("raggruppa per settimana (lunedì) di dateAdded, fissati ed effettuati separati", () => {
    const lista = [
      // Settimana 2026-08-03: uno effettuato (incontro passato, confermato), uno no (incontro futuro).
      appuntamento({ id: "1", dateAdded: "2026-08-04T00:00:00Z", appointmentStatus: "confirmed", startTime: "2026-08-05T10:00:00Z" }),
      appuntamento({ id: "2", dateAdded: "2026-08-05T00:00:00Z", appointmentStatus: "confirmed", startTime: "2026-09-01T10:00:00Z" }),
      // Settimana 2026-06-08: annullato -> fissato ma mai effettuato.
      appuntamento({ id: "3", dateAdded: "2026-06-10T00:00:00Z", appointmentStatus: "cancelled", startTime: "2026-06-11T10:00:00Z" }),
    ];
    expect(appuntamentiGhlPerSettimana(lista, GIU_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO)).toEqual([
      { settimana: "2026-06-08", fissati: 1, effettuati: 0 },
      { settimana: "2026-08-03", fissati: 2, effettuati: 1 },
    ]);
  });

  it("esclude gli appuntamenti eliminati", () => {
    const lista = [appuntamento({ dateAdded: "2026-08-04T00:00:00Z", deleted: true })];
    expect(appuntamentiGhlPerSettimana(lista, GIU_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO)).toEqual([]);
  });

  it("allarga la finestra ai confini di settimana, come fatturatoGhlPerSettimana", () => {
    const lista = [appuntamento({ dateAdded: "2026-09-03T00:00:00Z", appointmentStatus: "confirmed", startTime: "2026-09-04T10:00:00Z" })];
    expect(appuntamentiGhlPerSettimana(lista, GIU_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO)).toEqual([
      { settimana: "2026-08-31", fissati: 1, effettuati: 0 },
    ]);
  });
});

function attribuzione(overrides: Partial<GhlAttribuzione> = {}): GhlAttribuzione {
  return { utmCampaignId: "120251065290330588", utmCampaign: "Nome leggibile campagna", isFirst: true, ...overrides };
}

describe("primoAppuntamentoPerContatto", () => {
  it("nessun appuntamento -> lista vuota", () => {
    expect(primoAppuntamentoPerContatto([])).toEqual([]);
  });

  it("un contatto con più appuntamenti -> tiene solo quello con startTime più basso (il vero primo)", () => {
    const lista = [
      appuntamento({ id: "1", contactId: "ct1", startTime: "2026-03-01T10:00:00Z" }),
      appuntamento({ id: "2", contactId: "ct1", startTime: "2026-01-01T10:00:00Z" }), // il vero primo
      appuntamento({ id: "3", contactId: "ct1", startTime: "2026-05-01T10:00:00Z" }),
    ];
    const risultato = primoAppuntamentoPerContatto(lista);
    expect(risultato).toHaveLength(1);
    expect(risultato[0].id).toBe("2");
  });

  it("contatti diversi -> un appuntamento ciascuno, tutti tenuti", () => {
    const lista = [
      appuntamento({ id: "1", contactId: "ct1" }),
      appuntamento({ id: "2", contactId: "ct2" }),
    ];
    expect(primoAppuntamentoPerContatto(lista).map((a) => a.id).sort()).toEqual(["1", "2"]);
  });

  it("esclude gli appuntamenti eliminati, anche se sarebbero il primo per data", () => {
    const lista = [
      appuntamento({ id: "1", contactId: "ct1", startTime: "2026-01-01T10:00:00Z", deleted: true }),
      appuntamento({ id: "2", contactId: "ct1", startTime: "2026-03-01T10:00:00Z", deleted: false }),
    ];
    const risultato = primoAppuntamentoPerContatto(lista);
    expect(risultato).toHaveLength(1);
    expect(risultato[0].id).toBe("2");
  });
});

describe("estraiCampaignIdAttribuzione", () => {
  it("nessuna attribuzione -> null", () => {
    expect(estraiCampaignIdAttribuzione(opportunita({ attributions: [] }))).toBeNull();
    expect(estraiCampaignIdAttribuzione(opportunita({ attributions: undefined }))).toBeNull();
  });

  it("utmCampaignId numerico presente -> usa quello (pattern 'Lead Ads' nativo)", () => {
    const o = opportunita({ attributions: [attribuzione({ utmCampaignId: "120251065290330588", utmCampaign: "Nome leggibile" })] });
    expect(estraiCampaignIdAttribuzione(o)).toBe("120251065290330588");
  });

  it("nessun utmCampaignId ma utmCampaign è numerico -> usa quello (pattern UTM dinamici Meta su sito esterno)", () => {
    const o = opportunita({ attributions: [attribuzione({ utmCampaignId: undefined, utmCampaign: "120245888846110249" })] });
    expect(estraiCampaignIdAttribuzione(o)).toBe("120245888846110249");
  });

  it("utmCampaign è un nome leggibile (non numerico) e nessun utmCampaignId -> null, mai un nome scambiato per un id", () => {
    const o = opportunita({ attributions: [attribuzione({ utmCampaignId: undefined, utmCampaign: "Campagna Lead Ads Settembre" })] });
    expect(estraiCampaignIdAttribuzione(o)).toBeNull();
  });

  it("più touchpoint -> usa quello isFirst, anche se non è il primo dell'array", () => {
    const o = opportunita({
      attributions: [
        attribuzione({ utmCampaignId: "111", isFirst: undefined, isLast: true }),
        attribuzione({ utmCampaignId: "222", isFirst: true, isLast: undefined }),
      ],
    });
    expect(estraiCampaignIdAttribuzione(o)).toBe("222");
  });

  it("nessun touchpoint marcato isFirst -> usa il primo dell'array", () => {
    const o = opportunita({
      attributions: [
        attribuzione({ utmCampaignId: "333", isFirst: undefined }),
        attribuzione({ utmCampaignId: "444", isFirst: undefined }),
      ],
    });
    expect(estraiCampaignIdAttribuzione(o)).toBe("333");
  });
});

describe("mappaCampagnaPerContatto", () => {
  it("un'opportunità attribuibile per contatto -> mappa diretta", () => {
    const lista = [
      opportunita({ contactId: "ct1", createdAt: "2026-01-01T00:00:00Z", attributions: [attribuzione({ utmCampaignId: "111" })] }),
      opportunita({ contactId: "ct2", createdAt: "2026-01-01T00:00:00Z", attributions: [attribuzione({ utmCampaignId: "222" })] }),
    ];
    const mappa = mappaCampagnaPerContatto(lista);
    expect(mappa.get("ct1")).toBe("111");
    expect(mappa.get("ct2")).toBe("222");
  });

  it("contatto con più opportunità -> usa quella con createdAt più basso fra quelle risolvibili", () => {
    const lista = [
      opportunita({ id: "o1", contactId: "ct1", createdAt: "2026-06-01T00:00:00Z", attributions: [attribuzione({ utmCampaignId: "999" })] }),
      opportunita({ id: "o2", contactId: "ct1", createdAt: "2026-01-01T00:00:00Z", attributions: [attribuzione({ utmCampaignId: "111" })] }),
    ];
    expect(mappaCampagnaPerContatto(lista).get("ct1")).toBe("111");
  });

  it("opportunità senza attribuzione risolvibile ignorate a favore di una successiva risolvibile", () => {
    const lista = [
      opportunita({ id: "o1", contactId: "ct1", createdAt: "2026-01-01T00:00:00Z", attributions: [] }),
      opportunita({ id: "o2", contactId: "ct1", createdAt: "2026-02-01T00:00:00Z", attributions: [attribuzione({ utmCampaignId: "111" })] }),
    ];
    expect(mappaCampagnaPerContatto(lista).get("ct1")).toBe("111");
  });

  it("nessuna opportunità risolvibile per nessun contatto -> mappa vuota", () => {
    const lista = [opportunita({ contactId: "ct1", attributions: [] })];
    expect(mappaCampagnaPerContatto(lista).size).toBe(0);
  });
});

describe("estraiAdIdAttribuzione", () => {
  it("form Lead Ads nativo: id inserzione in utmAdId, utmContent è il nome", () => {
    const o = opportunita({
      attributions: [attribuzione({ utmCampaignId: "120251149019240588", utmAdId: "120251158854450588", utmContent: "Ebook light 1080x1080", isFirst: true })],
    });
    expect(estraiAdIdAttribuzione(o)).toBe("120251158854450588");
  });

  it("sito con UTM dinamici Meta: nessun utmAdId, id inserzione in utmContent", () => {
    const o = opportunita({
      attributions: [attribuzione({ utmCampaign: "120245888846110249", utmContent: "120245888846140249", isFirst: true })],
    });
    expect(estraiAdIdAttribuzione(o)).toBe("120245888846140249");
  });

  it("utmContent testuale (nome inserzione) senza utmAdId -> null, mai un match per nome", () => {
    const o = opportunita({ attributions: [attribuzione({ utmCampaignId: "120219652196580588", utmContent: "Take migliore", isFirst: true })] });
    expect(estraiAdIdAttribuzione(o)).toBeNull();
  });

  it("un nome fatto di poche cifre non passa per un id inserzione", () => {
    const o = opportunita({ attributions: [attribuzione({ utmCampaignId: "120219652196580588", utmContent: "2024", isFirst: true })] });
    expect(estraiAdIdAttribuzione(o)).toBeNull();
  });

  it("usa il primo touchpoint (isFirst), non l'ultimo", () => {
    const o = opportunita({
      attributions: [
        attribuzione({ utmAdId: "999999999999999", isFirst: false, isLast: true }),
        attribuzione({ utmAdId: "111111111111111", isFirst: true }),
      ],
    });
    expect(estraiAdIdAttribuzione(o)).toBe("111111111111111");
  });

  it("senza attributions -> null", () => {
    expect(estraiAdIdAttribuzione(opportunita({ attributions: undefined }))).toBeNull();
  });
});

describe("mappaInserzionePerContatto", () => {
  it("l'inserzione viene dalla stessa opportunità che decide la campagna (la prima risolvibile)", () => {
    const lista = [
      opportunita({
        id: "o1",
        contactId: "ct1",
        createdAt: "2026-06-01T00:00:00Z",
        attributions: [attribuzione({ utmCampaignId: "999", utmAdId: "999999999999999" })],
      }),
      opportunita({
        id: "o2",
        contactId: "ct1",
        createdAt: "2026-01-01T00:00:00Z",
        attributions: [attribuzione({ utmCampaignId: "111", utmAdId: "111111111111111" })],
      }),
    ];
    expect(mappaInserzionePerContatto(lista).get("ct1")).toBe("111111111111111");
    expect(mappaCampagnaPerContatto(lista).get("ct1")).toBe("111");
  });

  it("prima opportunità con campagna ma senza id inserzione -> contatto fuori dalla mappa, mai l'inserzione di un'opportunità successiva", () => {
    const lista = [
      opportunita({
        id: "o1",
        contactId: "ct1",
        createdAt: "2026-01-01T00:00:00Z",
        attributions: [attribuzione({ utmCampaignId: "111", utmContent: "Take migliore" })],
      }),
      opportunita({
        id: "o2",
        contactId: "ct1",
        createdAt: "2026-06-01T00:00:00Z",
        attributions: [attribuzione({ utmCampaignId: "999", utmAdId: "999999999999999" })],
      }),
    ];
    expect(mappaInserzionePerContatto(lista).has("ct1")).toBe(false);
    expect(mappaCampagnaPerContatto(lista).get("ct1")).toBe("111");
  });

  it("opportunità senza campagna risolvibile ignorata anche se porta un id inserzione", () => {
    const lista = [opportunita({ contactId: "ct1", attributions: [attribuzione({ utmCampaignId: undefined, utmAdId: "111111111111111" })] })];
    expect(mappaInserzionePerContatto(lista).size).toBe(0);
  });
});

describe("breakdownGhlPerInserzione", () => {
  it("raggruppa appuntamenti/opportunità per inserzione via la mappa contatto->inserzione", () => {
    const appuntamenti = [
      appuntamento({ id: "a1", contactId: "ct1", dateAdded: "2026-08-05T00:00:00Z" }),
      appuntamento({ id: "a2", contactId: "ct2", dateAdded: "2026-08-06T00:00:00Z" }),
      appuntamento({ id: "a3", contactId: "ct-senza-inserzione", dateAdded: "2026-08-06T00:00:00Z" }),
    ];
    const opportunitaVinte = [
      opportunita({ id: "o1", contactId: "ct1", status: "won", monetaryValue: 500, lastStatusChangeAt: "2026-08-10T00:00:00Z" }),
    ];
    const mappa = new Map([
      ["ct1", "111111111111111"],
      ["ct2", "222222222222222"],
    ]);
    const startMs = new Date("2026-08-01T00:00:00Z").getTime();
    const endMs = new Date("2026-08-31T23:59:59.999Z").getTime();
    const risultato = breakdownGhlPerInserzione(appuntamenti, opportunitaVinte, mappa, startMs, endMs, endMs);
    expect(Object.keys(risultato).sort()).toEqual(["111111111111111", "222222222222222"]);
    expect(risultato["111111111111111"].appuntamenti.totali).toBe(1);
    expect(risultato["111111111111111"].opportunita).toEqual({ vendite: 1, fatturato: 500 });
    expect(risultato["222222222222222"].appuntamenti.totali).toBe(1);
    expect(risultato["222222222222222"].opportunita).toEqual({ vendite: 0, fatturato: 0 });
  });
});

describe("breakdownGhlPerCampagna", () => {
  it("raggruppa appuntamenti/opportunità per campagna via la mappa contatto->campagna", () => {
    const appuntamenti = [
      appuntamento({ id: "a1", contactId: "ct1", dateAdded: "2026-08-05T00:00:00Z" }),
      appuntamento({ id: "a2", contactId: "ct2", dateAdded: "2026-08-06T00:00:00Z" }),
    ];
    const opportunitaVinte = [
      opportunita({ id: "o1", contactId: "ct1", status: "won", monetaryValue: 500, lastStatusChangeAt: "2026-08-10T00:00:00Z" }),
    ];
    const mappa = new Map([
      ["ct1", "111"],
      ["ct2", "222"],
    ]);
    const risultato = breakdownGhlPerCampagna(appuntamenti, opportunitaVinte, mappa, AGOSTO_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO);
    expect(Object.keys(risultato).sort()).toEqual(["111", "222"]);
    expect(risultato["111"].appuntamenti.totali).toBe(1);
    expect(risultato["111"].opportunita.vendite).toBe(1);
    expect(risultato["111"].opportunita.fatturato).toBe(500);
    expect(risultato["222"].appuntamenti.totali).toBe(1);
    expect(risultato["222"].opportunita.vendite).toBe(0);
  });

  it("contatti non presenti nella mappa (nessuna attribuzione) non compaiono in nessuna chiave", () => {
    const appuntamenti = [appuntamento({ id: "a1", contactId: "ct-non-attribuito" })];
    const risultato = breakdownGhlPerCampagna(appuntamenti, [], new Map(), AGOSTO_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO);
    expect(Object.keys(risultato)).toEqual([]);
  });

  it("nessuna campagna nella mappa -> oggetto vuoto", () => {
    expect(breakdownGhlPerCampagna([], [], new Map(), AGOSTO_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO)).toEqual({});
  });
});

describe("riepilogoSenzaTag", () => {
  const startMs = Date.parse("2026-06-01T00:00:00Z");
  const endMs = Date.parse("2026-06-30T23:59:59.999Z");
  const ora = Date.parse("2026-06-20T00:00:00Z");

  it("conta appuntamenti/opportunità SOLO dei contatti fuori da ogni set taggato; richieste passa così com'è", () => {
    const appuntamenti = [
      appuntamento({ id: "a1", contactId: "taggato", dateAdded: "2026-06-10T10:00:00.000Z", startTime: "2026-06-12T10:00:00.000Z", appointmentStatus: "confirmed" }),
      appuntamento({ id: "a2", contactId: "senza-tag", dateAdded: "2026-06-11T10:00:00.000Z", startTime: "2026-06-13T10:00:00.000Z", appointmentStatus: "confirmed" }),
      appuntamento({ id: "a3", contactId: "vecchio-senza-tag", dateAdded: "2026-06-15T10:00:00.000Z", startTime: "2026-06-25T10:00:00.000Z", appointmentStatus: "confirmed" }),
    ];
    const elencoOpportunita = [
      opportunita({ id: "o1", contactId: "taggato", status: "won", lastStatusChangeAt: "2026-06-11T10:00:00.000Z", monetaryValue: 1000 }),
      opportunita({ id: "o2", contactId: "senza-tag", status: "won", lastStatusChangeAt: "2026-06-12T10:00:00.000Z", monetaryValue: 500 }),
    ];
    const r = riepilogoSenzaTag(7, new Set(["taggato"]), appuntamenti, elencoOpportunita, startMs, endMs, ora);
    expect(r.richieste).toBe(7);
    expect(r.appuntamenti).toEqual({ totali: 2, confermati: 2, annullati: 0, effettuati: 1 }); // a3 è nel futuro rispetto a `ora`
    expect(r.opportunita).toEqual({ vendite: 1, fatturato: 500 });
  });

  it("nessun contatto taggato -> tutto è 'senza cluster'", () => {
    const r = riepilogoSenzaTag(0, new Set(), [appuntamento({ contactId: "x", dateAdded: "2026-06-10T10:00:00.000Z" })], [], startMs, endMs, ora);
    expect(r.appuntamenti.totali).toBe(1);
  });
});

describe("riepilogoPerTag", () => {
  it("richieste conta i contatti taggati con dateAdded nel periodo", () => {
    const contattiTag = [
      { id: "ct1", dateAdded: "2026-08-05T00:00:00Z" }, // dentro agosto
      { id: "ct2", dateAdded: "2026-07-20T00:00:00Z" }, // fuori periodo
    ];
    const risultato = riepilogoPerTag(contattiTag, [], [], AGOSTO_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO);
    expect(risultato.richieste).toBe(1);
  });

  it("appuntamenti/opportunità solo dei contatti nel set taggato, per id", () => {
    const contattiTag = [{ id: "ct1", dateAdded: "2026-08-05T00:00:00Z" }];
    const appuntamenti = [
      appuntamento({ id: "a1", contactId: "ct1", dateAdded: "2026-08-06T00:00:00Z" }),
      appuntamento({ id: "a2", contactId: "ct-altro-tag", dateAdded: "2026-08-06T00:00:00Z" }),
    ];
    const opportunitaVinte = [
      opportunita({ id: "o1", contactId: "ct1", status: "won", monetaryValue: 300, lastStatusChangeAt: "2026-08-10T00:00:00Z" }),
      opportunita({ id: "o2", contactId: "ct-altro-tag", status: "won", monetaryValue: 999, lastStatusChangeAt: "2026-08-10T00:00:00Z" }),
    ];
    const risultato = riepilogoPerTag(contattiTag, appuntamenti, opportunitaVinte, AGOSTO_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO);
    expect(risultato.appuntamenti.totali).toBe(1);
    expect(risultato.opportunita.vendite).toBe(1);
    expect(risultato.opportunita.fatturato).toBe(300);
  });

  it("nessun contatto taggato -> tutto a zero, mai un errore", () => {
    const risultato = riepilogoPerTag([], [appuntamento()], [opportunita({ status: "won" })], AGOSTO_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO);
    expect(risultato).toEqual({
      richieste: 0,
      appuntamenti: { totali: 0, confermati: 0, annullati: 0, effettuati: 0 },
      opportunita: { vendite: 0, fatturato: 0 },
    });
  });
});

describe("riepilogoPerVenditoreGhl", () => {
  it("filtra appuntamenti/opportunità per assignedUserId/assignedTo", () => {
    const appuntamenti = [
      appuntamento({ id: "a1", assignedUserId: "u1", dateAdded: "2026-08-05T00:00:00Z" }),
      appuntamento({ id: "a2", assignedUserId: "u2", dateAdded: "2026-08-06T00:00:00Z" }),
    ];
    const opportunitaVinte = [
      opportunita({ id: "o1", assignedTo: "u1", status: "won", monetaryValue: 500, lastStatusChangeAt: "2026-08-10T00:00:00Z" }),
      opportunita({ id: "o2", assignedTo: "u2", status: "won", monetaryValue: 999, lastStatusChangeAt: "2026-08-10T00:00:00Z" }),
    ];
    const risultato = riepilogoPerVenditoreGhl("u1", appuntamenti, opportunitaVinte, AGOSTO_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO);
    expect(risultato.appuntamenti.totali).toBe(1);
    expect(risultato.opportunita.vendite).toBe(1);
    expect(risultato.opportunita.fatturato).toBe(500);
  });

  it("conta OGNI appuntamento del venditore, mai deduplicato per contatto (carico di lavoro, non attribuzione marketing)", () => {
    const appuntamenti = [
      appuntamento({ id: "a1", contactId: "stesso-contatto", assignedUserId: "u1", dateAdded: "2026-08-05T00:00:00Z" }),
      appuntamento({ id: "a2", contactId: "stesso-contatto", assignedUserId: "u1", dateAdded: "2026-08-12T00:00:00Z" }),
    ];
    const risultato = riepilogoPerVenditoreGhl("u1", appuntamenti, [], AGOSTO_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO);
    expect(risultato.appuntamenti.totali).toBe(2);
  });

  it("nessun appuntamento/opportunità assegnati a questo venditore -> tutto a zero", () => {
    const risultato = riepilogoPerVenditoreGhl("u-mai-visto", [appuntamento()], [opportunita({ status: "won" })], AGOSTO_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO);
    expect(risultato).toEqual({
      appuntamenti: { totali: 0, confermati: 0, annullati: 0, effettuati: 0 },
      opportunita: { vendite: 0, fatturato: 0 },
    });
  });
});

describe("andamentoPerVenditoreGhl", () => {
  it("mette insieme, settimana per settimana, appuntamenti e vendite assegnati al venditore", () => {
    const appuntamenti = [
      // Settimana di lunedi 3 agosto: due presi, uno gia tenuto e uno annullato.
      appuntamento({ id: "a1", assignedUserId: "u1", dateAdded: "2026-08-04T09:00:00Z", startTime: "2026-08-06T10:00:00Z" }),
      appuntamento({ id: "a2", assignedUserId: "u1", dateAdded: "2026-08-05T09:00:00Z", startTime: "2026-08-07T10:00:00Z", appointmentStatus: "cancelled" }),
      // Settimana di lunedi 24 agosto: preso, l'incontro e dopo l'ora di riferimento.
      appuntamento({ id: "a3", assignedUserId: "u1", dateAdded: "2026-08-25T09:00:00Z", startTime: "2026-08-29T10:00:00Z" }),
      // Di un altro venditore: non conta.
      appuntamento({ id: "a4", assignedUserId: "u2", dateAdded: "2026-08-04T09:00:00Z" }),
    ];
    const vinte = [
      opportunita({ id: "o1", assignedTo: "u1", status: "won", monetaryValue: 3000, lastStatusChangeAt: "2026-08-12T10:00:00Z" }),
      opportunita({ id: "o2", assignedTo: "u1", status: "won", monetaryValue: 1500, lastStatusChangeAt: "2026-08-26T10:00:00Z" }),
      opportunita({ id: "o3", assignedTo: "u2", status: "won", monetaryValue: 9999, lastStatusChangeAt: "2026-08-12T10:00:00Z" }),
    ];
    expect(andamentoPerVenditoreGhl("u1", appuntamenti, vinte, AGOSTO_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO)).toEqual([
      { settimana: "2026-08-03", fissati: 2, effettuati: 1, vendite: 0, fatturato: 0 },
      { settimana: "2026-08-10", fissati: 0, effettuati: 0, vendite: 1, fatturato: 3000 },
      { settimana: "2026-08-24", fissati: 1, effettuati: 0, vendite: 1, fatturato: 1500 },
    ]);
  });

  it("conta ogni appuntamento, anche due con lo stesso contatto; chi non ha nulla non ha settimane", () => {
    const appuntamenti = [
      appuntamento({ id: "a1", contactId: "stesso", assignedUserId: "u1", dateAdded: "2026-08-04T09:00:00Z" }),
      appuntamento({ id: "a2", contactId: "stesso", assignedUserId: "u1", dateAdded: "2026-08-05T09:00:00Z" }),
    ];
    expect(andamentoPerVenditoreGhl("u1", appuntamenti, [], AGOSTO_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO)[0].fissati).toBe(2);
    expect(andamentoPerVenditoreGhl("u-mai-visto", appuntamenti, [], AGOSTO_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO)).toEqual([]);
  });

  it("le settimane ai bordi del periodo sono intere, come nei grafici del marketing", () => {
    // Sabato 1 agosto sta nella settimana di lunedi 27 luglio: un appuntamento preso il 28 luglio vi rientra.
    const appuntamenti = [appuntamento({ id: "a1", assignedUserId: "u1", dateAdded: "2026-07-28T09:00:00Z" })];
    expect(andamentoPerVenditoreGhl("u1", appuntamenti, [], AGOSTO_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO)).toEqual([
      { settimana: "2026-07-27", fissati: 1, effettuati: 1, vendite: 0, fatturato: 0 },
    ]);
  });
});

describe("pipelineDiCategoria", () => {
  it("separa gli id per virgola, toglie spazi e vuoti", () => {
    expect(pipelineDiCategoria({ pipelineGhl: " p1, p2 ,," })).toEqual(["p1", "p2"]);
  });
  it("campo assente o vuoto -> nessuna pipeline", () => {
    expect(pipelineDiCategoria({})).toEqual([]);
    expect(pipelineDiCategoria({ pipelineGhl: "" })).toEqual([]);
  });
});

describe("restringiAllePipeline", () => {
  const elencoOpp = [
    opportunita({ id: "o1", contactId: "it1", pipelineId: "it-piu" }),
    opportunita({ id: "o2", contactId: "es1", pipelineId: "es-piu" }),
    opportunita({ id: "o3", contactId: "es2", pipelineId: "es-meno" }),
  ];
  const elencoApp = [
    appuntamento({ id: "a1", contactId: "it1" }),
    appuntamento({ id: "a2", contactId: "es1" }),
    appuntamento({ id: "a3", contactId: "senza-opportunita" }),
  ];

  it("nessuna pipeline configurata -> tutta la location, invariata", () => {
    const r = restringiAllePipeline(elencoOpp, elencoApp, []);
    expect(r.opportunita).toBe(elencoOpp);
    expect(r.appuntamenti).toBe(elencoApp);
  });

  it("con pipeline: solo le opportunità di quelle pipeline e gli appuntamenti dei loro contatti", () => {
    const r = restringiAllePipeline(elencoOpp, elencoApp, ["es-piu", "es-meno"]);
    expect(r.opportunita.map((o) => o.id)).toEqual(["o2", "o3"]);
    // a1 è di un contatto italiano, a3 di un contatto senza opportunità: nessuno dei due è della sede.
    expect(r.appuntamenti.map((a) => a.id)).toEqual(["a2"]);
  });
});

describe("riepilogoPerPipeline / riepilogoSenzaPipeline", () => {
  const startMs = new Date("2026-09-01T00:00:00Z").getTime();
  const endMs = new Date("2026-09-30T23:59:59.999Z").getTime();
  const elencoOpp = [
    // Cluster "+50": un lead nuovo del periodo, uno vecchio che vince nel periodo.
    opportunita({ id: "o1", contactId: "c1", pipelineId: "piu", createdAt: "2026-09-10T00:00:00Z", status: "open" }),
    opportunita({ id: "o2", contactId: "c2", pipelineId: "piu", createdAt: "2026-06-01T00:00:00Z", status: "won", monetaryValue: 9000, lastStatusChangeAt: "2026-09-20T00:00:00Z" }),
    // Cluster "-50": un lead nuovo del periodo.
    opportunita({ id: "o3", contactId: "c3", pipelineId: "meno", createdAt: "2026-09-12T00:00:00Z", status: "open" }),
    // Pipeline della sede fuori da ogni cluster (concessionari): un lead nuovo e una vendita.
    opportunita({ id: "o4", contactId: "c4", pipelineId: "concessionari", createdAt: "2026-09-15T00:00:00Z", status: "won", monetaryValue: 500, lastStatusChangeAt: "2026-09-25T00:00:00Z" }),
  ];
  const elencoApp = [
    appuntamento({ id: "a1", contactId: "c1", dateAdded: "2026-09-11T00:00:00Z" }),
    appuntamento({ id: "a3", contactId: "c3", dateAdded: "2026-09-13T00:00:00Z" }),
    appuntamento({ id: "a4", contactId: "c4", dateAdded: "2026-09-16T00:00:00Z" }),
  ];

  it("cluster per pipeline: richieste = contatti con opportunità creata nel periodo, appuntamenti dei suoi contatti, vendite delle sue opportunità", () => {
    const piu = riepilogoPerPipeline(["piu"], elencoOpp, elencoApp, startMs, endMs, endMs);
    expect(piu.richieste).toBe(1);
    expect(piu.appuntamenti.totali).toBe(1);
    expect(piu.opportunita).toEqual({ vendite: 1, fatturato: 9000 });

    const meno = riepilogoPerPipeline(["meno"], elencoOpp, elencoApp, startMs, endMs, endMs);
    expect(meno.richieste).toBe(1);
    expect(meno.appuntamenti.totali).toBe(1);
    expect(meno.opportunita).toEqual({ vendite: 0, fatturato: 0 });
  });

  it("stesso contatto con due opportunità nel cluster conta una sola richiesta", () => {
    const doppie = [...elencoOpp, opportunita({ id: "o1bis", contactId: "c1", pipelineId: "piu", createdAt: "2026-09-18T00:00:00Z", status: "open" })];
    expect(riepilogoPerPipeline(["piu"], doppie, elencoApp, startMs, endMs, endMs).richieste).toBe(1);
  });

  it("senza cluster: ciò che sta nelle pipeline della sede fuori da ogni cluster", () => {
    const senza = riepilogoSenzaPipeline(["piu", "meno"], elencoOpp, elencoApp, startMs, endMs, endMs);
    expect(senza.richieste).toBe(1);
    expect(senza.appuntamenti.totali).toBe(1);
    expect(senza.opportunita).toEqual({ vendite: 1, fatturato: 500 });
  });

  it("cluster + senza cluster = totale della sede", () => {
    const piu = riepilogoPerPipeline(["piu"], elencoOpp, elencoApp, startMs, endMs, endMs);
    const meno = riepilogoPerPipeline(["meno"], elencoOpp, elencoApp, startMs, endMs, endMs);
    const senza = riepilogoSenzaPipeline(["piu", "meno"], elencoOpp, elencoApp, startMs, endMs, endMs);
    expect(piu.appuntamenti.totali + meno.appuntamenti.totali + senza.appuntamenti.totali).toBe(elencoApp.length);
    expect(piu.opportunita.fatturato + meno.opportunita.fatturato + senza.opportunita.fatturato).toBe(9500);
  });
});
