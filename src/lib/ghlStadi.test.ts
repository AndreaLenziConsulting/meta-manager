import { describe, expect, it } from "vitest";
import { applicaStadi, erroreStadi, leggiDaStadi, nomiStadi, normalizzaStadi, stadiEscludibili, usoStadi, type PipelineConStadi } from "./ghlStadi";
import { appuntamentiGhlPerSettimana, riepilogoAppuntamenti, riepilogoOpportunita } from "./ghl";
import type { GhlOpportunita, StadiGhl } from "@/types/ghl";

// Due pipeline con gli stessi stadi (come Agricobots: una per fascia di ettari), più una diversa.
const stadiDi = (prefisso: string) => [
  { id: `${prefisso}-lead`, name: "Lead R2", position: 0 },
  { id: `${prefisso}-contatto`, name: "Contatto Stabilito", position: 1 },
  { id: `${prefisso}-prog`, name: "Videocall 1 - Programmata", position: 2 },
  { id: `${prefisso}-eff`, name: "Videocall 1 - Effettuata", position: 3 },
  { id: `${prefisso}-acconto`, name: "Acconto Versato - Diventa Cliente", position: 4 },
  { id: `${prefisso}-old`, name: "OLD", position: 5 },
];
const PIPELINE: PipelineConStadi[] = [
  { id: "p-grandi", name: "ATOMATIKA (IT) | +30 ettari", stadi: stadiDi("g") },
  { id: "p-piccoli", name: "ATOMATIKA (IT) | -30 ettari", stadi: stadiDi("p") },
  {
    id: "p-rivenditori",
    name: "CONCESSIONARI",
    stadi: [
      { id: "r-chiamare", name: "Da chiamare", position: 0 },
      { id: "r-fissata", name: "Call fissata", position: 1 },
    ],
  },
];
const STADI: StadiGhl = { appuntamentoFissato: "Videocall 1 - Programmata", appuntamentoEffettuato: "Videocall 1 - Effettuata", vendita: "Acconto Versato - Diventa Cliente", ignorati: ["OLD"] };

let n = 0;
function opp(over: Partial<GhlOpportunita>): GhlOpportunita {
  n++;
  return {
    id: `o${n}`,
    name: `Opportunità ${n}`,
    pipelineId: "p-grandi",
    pipelineStageId: "g-lead",
    monetaryValue: 0,
    status: "open",
    source: "",
    contactId: `c${n}`,
    createdAt: "2026-08-01T10:00:00Z",
    lastStatusChangeAt: "2026-08-01T10:00:00Z",
    lastStageChangeAt: "2026-09-15T10:00:00Z",
    ...over,
  };
}

const SETTEMBRE = { da: new Date("2026-09-01T00:00:00Z").getTime(), a: new Date("2026-09-30T23:59:59Z").getTime() };
const ORA = new Date("2026-10-08T12:00:00Z").getTime();

describe("la configurazione degli stadi", () => {
  it("arriva sempre nella forma completa, senza spazi e senza doppioni", () => {
    expect(normalizzaStadi(null)).toEqual({ appuntamentoFissato: "", appuntamentoEffettuato: "", vendita: "", ignorati: [] });
    expect(normalizzaStadi({ appuntamentoFissato: "  Programmata ", ignorati: ["OLD", " OLD ", "", 7] })).toEqual({ appuntamentoFissato: "Programmata", appuntamentoEffettuato: "", vendita: "", ignorati: ["OLD"] });
  });

  it("gli appuntamenti si leggono dagli stadi solo con entrambi gli stadi; le vendite con il loro", () => {
    expect(usoStadi(undefined)).toEqual({ appuntamenti: false, vendite: false });
    expect(usoStadi(STADI)).toEqual({ appuntamenti: true, vendite: true });
    expect(usoStadi({ ...STADI, appuntamentoEffettuato: "" })).toEqual({ appuntamenti: false, vendite: true });
    expect(usoStadi({ ...STADI, vendita: "" })).toEqual({ appuntamenti: true, vendite: false });
  });

  it("rifiuta una configurazione a metà o che si contraddice", () => {
    expect(erroreStadi(STADI)).toBeNull();
    expect(erroreStadi(normalizzaStadi({}))).toBeNull();
    expect(erroreStadi({ ...STADI, appuntamentoEffettuato: "" })).toContain("servono tutti e due");
    expect(erroreStadi({ ...STADI, appuntamentoEffettuato: "videocall 1 - programmata" })).toContain("devono essere diversi");
    expect(erroreStadi({ ...STADI, ignorati: ["Videocall 1 - Effettuata"] })).toContain("non può stare anche fra quelli da non contare");
  });

  it("propone i nomi degli stadi una volta sola, nell'ordine delle pipeline", () => {
    expect(nomiStadi(PIPELINE)).toEqual(["Lead R2", "Contatto Stabilito", "Videocall 1 - Programmata", "Videocall 1 - Effettuata", "Acconto Versato - Diventa Cliente", "OLD", "Da chiamare", "Call fissata"]);
  });
});

describe("gli stadi che si possono escludere", () => {
  it("solo quelli che vengono dopo il primo stadio scelto, senza gli stadi scelti", () => {
    expect(stadiEscludibili(PIPELINE, { ...STADI, ignorati: [] })).toEqual(["OLD"]);
    // Senza lo stadio dell'effettuato scelto, quello stadio viene dopo la soglia: si può escludere.
    expect(stadiEscludibili(PIPELINE, { appuntamentoFissato: "Videocall 1 - Programmata", appuntamentoEffettuato: "", vendita: "", ignorati: [] })).toEqual(["Videocall 1 - Effettuata", "Acconto Versato - Diventa Cliente", "OLD"]);
  });

  it("senza nessuno stadio scelto non c'è nulla da escludere; uno già escluso resta visibile", () => {
    expect(stadiEscludibili(PIPELINE, normalizzaStadi({}))).toEqual([]);
    expect(stadiEscludibili(PIPELINE, { ...STADI, ignorati: ["Stadio che non c'è più"] })).toEqual(["OLD", "Stadio che non c'è più"]);
  });
});

describe("appuntamenti dagli stadi", () => {
  it("chi sta nello stadio dell'appuntamento, o in uno successivo, ha un appuntamento; prima no", () => {
    const { appuntamenti } = leggiDaStadi(
      [opp({ pipelineStageId: "g-contatto" }), opp({ pipelineStageId: "g-prog" }), opp({ pipelineStageId: "g-eff" }), opp({ pipelineStageId: "g-acconto" })],
      PIPELINE,
      STADI
    );
    expect(appuntamenti).toHaveLength(3);
    expect(riepilogoAppuntamenti(appuntamenti, SETTEMBRE.da, SETTEMBRE.a, ORA)).toEqual({ totali: 3, confermati: 3, annullati: 0, effettuati: 2 });
  });

  it("si contano alla data dell'ultimo spostamento, anche nel grafico per settimana", () => {
    const lista = [
      opp({ pipelineStageId: "g-prog", lastStageChangeAt: "2026-08-20T09:00:00Z" }),
      opp({ pipelineStageId: "g-eff", lastStageChangeAt: "2026-09-08T09:00:00Z" }),
      opp({ pipelineStageId: "g-prog", lastStageChangeAt: "2026-09-10T09:00:00Z" }),
    ];
    const { appuntamenti } = leggiDaStadi(lista, PIPELINE, STADI);
    expect(riepilogoAppuntamenti(appuntamenti, SETTEMBRE.da, SETTEMBRE.a, ORA).totali).toBe(2);
    expect(appuntamentiGhlPerSettimana(appuntamenti, SETTEMBRE.da, SETTEMBRE.a, ORA)).toEqual([{ settimana: "2026-09-07", fissati: 2, effettuati: 1 }]);
  });

  it("uno stadio da non contare non conta, anche se viene dopo", () => {
    const { appuntamenti, vendute } = leggiDaStadi([opp({ pipelineStageId: "g-old" })], PIPELINE, STADI);
    expect(appuntamenti).toEqual([]);
    expect(vendute).toEqual([]);
    // Senza quell'esclusione l'ultimo stadio della pipeline passerebbe per una vendita.
    expect(leggiDaStadi([opp({ pipelineStageId: "g-old" })], PIPELINE, { ...STADI, ignorati: [] }).vendute).toHaveLength(1);
  });

  it("lo stesso nome vale per tutte le pipeline della sede; maiuscole e spazi non contano", () => {
    const stadi = { ...STADI, appuntamentoFissato: "videocall 1 -  programmata" };
    const { appuntamenti } = leggiDaStadi([opp({ pipelineStageId: "g-prog" }), opp({ pipelineId: "p-piccoli", pipelineStageId: "p-eff" })], PIPELINE, stadi);
    expect(appuntamenti.map((a) => a.contactId)).toHaveLength(2);
  });

  it("porta con sé il contatto e il venditore, come un appuntamento del calendario", () => {
    const { appuntamenti } = leggiDaStadi([opp({ id: "x1", contactId: "ct-9", assignedTo: "u-anna", pipelineStageId: "g-prog" })], PIPELINE, STADI);
    expect(appuntamenti[0]).toMatchObject({ id: "stadio:x1", contactId: "ct-9", assignedUserId: "u-anna", deleted: false, dateAdded: "2026-09-15T10:00:00Z" });
  });
});

describe("vendite dagli stadi", () => {
  it("chi ha raggiunto lo stadio della vendita è una vendita in quella data, col valore che ha su GHL", () => {
    const { vendute } = leggiDaStadi(
      [opp({ pipelineStageId: "g-acconto", monetaryValue: 12000, lastStageChangeAt: "2026-09-20T09:00:00Z" }), opp({ pipelineStageId: "g-eff" }), opp({ pipelineStageId: "g-acconto", lastStageChangeAt: "2026-10-02T09:00:00Z" })],
      PIPELINE,
      STADI
    );
    expect(riepilogoOpportunita(vendute, SETTEMBRE.da, SETTEMBRE.a)).toEqual({ vendite: 1, fatturato: 12000 });
  });

  it("lo stato \"vinta\" di GHL da solo non fa una vendita, se le vendite si leggono dagli stadi", () => {
    expect(leggiDaStadi([opp({ pipelineStageId: "g-prog", status: "won" })], PIPELINE, STADI).vendute).toEqual([]);
  });
});

describe("ciò che non si può contare", () => {
  it("senza configurazione non torna nulla: decide il chiamante da dove leggere", () => {
    const tutto = [opp({ pipelineStageId: "g-prog" }), opp({ pipelineStageId: "g-acconto" })];
    expect(leggiDaStadi(tutto, PIPELINE, normalizzaStadi({}))).toEqual({ appuntamenti: [], vendute: [], nonTrovati: [] });
    const soloVendite = leggiDaStadi(tutto, PIPELINE, { ...STADI, appuntamentoFissato: "", appuntamentoEffettuato: "" });
    expect(soloVendite.appuntamenti).toEqual([]);
    expect(soloVendite.vendute).toHaveLength(1);
  });

  it("segnala le pipeline della sede in cui uno stadio configurato non esiste, e lì non conta", () => {
    const esito = leggiDaStadi([opp({ pipelineStageId: "g-prog" }), opp({ pipelineId: "p-rivenditori", pipelineStageId: "r-fissata" })], PIPELINE, STADI);
    expect(esito.appuntamenti).toHaveLength(1);
    expect(esito.nonTrovati).toEqual(["CONCESSIONARI: Videocall 1 - Programmata", "CONCESSIONARI: Videocall 1 - Effettuata", "CONCESSIONARI: Acconto Versato - Diventa Cliente"]);
  });

  it("una pipeline senza opportunità della sede non viene segnalata", () => {
    expect(leggiDaStadi([opp({ pipelineStageId: "g-prog" })], PIPELINE, STADI).nonTrovati).toEqual([]);
  });

  it("un'opportunità senza stadio o senza data dell'ultimo spostamento resta fuori", () => {
    const esito = leggiDaStadi([opp({ pipelineStageId: undefined }), opp({ pipelineStageId: "g-prog", lastStageChangeAt: undefined }), opp({ pipelineStageId: "inventato" })], PIPELINE, STADI);
    expect(esito.appuntamenti).toEqual([]);
  });
});

describe("applicaStadi: ciò che /api/ghl usa al posto di calendari e stato vinta", () => {
  const dalCalendario = [{ id: "cal-1", calendarId: "k", contactId: "c-cal", title: "", appointmentStatus: "confirmed", startTime: "2026-09-10T10:00:00Z", endTime: "2026-09-10T11:00:00Z", dateAdded: "2026-09-05T10:00:00Z", deleted: false }];
  const opportunita = [
    opp({ id: "a", pipelineStageId: "g-prog" }),
    opp({ id: "b", pipelineStageId: "g-acconto", monetaryValue: 5000, lastStageChangeAt: "2026-09-20T09:00:00Z" }),
    opp({ id: "c", pipelineStageId: "g-lead", status: "won", lastStatusChangeAt: "2026-09-12T09:00:00Z" }),
  ];

  it("senza configurazione non cambia nulla", () => {
    const esito = applicaStadi({ opportunita, appuntamentiCalendario: dalCalendario, pipeline: PIPELINE, stadi: undefined });
    expect(esito.opportunita).toBe(opportunita);
    expect(esito.appuntamenti).toBe(dalCalendario);
    expect(esito.daStadi).toBeUndefined();
    expect(applicaStadi({ opportunita, appuntamentiCalendario: dalCalendario, pipeline: PIPELINE, stadi: normalizzaStadi({}) }).daStadi).toBeUndefined();
  });

  it("con gli stadi: gli appuntamenti del calendario lasciano il posto, e vinta è solo chi ha raggiunto lo stadio", () => {
    const esito = applicaStadi({ opportunita, appuntamentiCalendario: dalCalendario, pipeline: PIPELINE, stadi: STADI });
    expect(esito.appuntamenti.map((a) => a.id).sort()).toEqual(["stadio:a", "stadio:b"]);
    expect(esito.opportunita.map((o) => [o.id, o.status])).toEqual([["a", "open"], ["b", "won"], ["c", "open"]]);
    expect(riepilogoOpportunita(esito.opportunita, SETTEMBRE.da, SETTEMBRE.a)).toEqual({ vendite: 1, fatturato: 5000 });
    expect(esito.daStadi).toEqual({ appuntamenti: true, vendite: true, nonTrovati: [] });
  });

  it("solo le vendite dagli stadi: gli appuntamenti restano quelli del calendario", () => {
    const esito = applicaStadi({ opportunita, appuntamentiCalendario: dalCalendario, pipeline: PIPELINE, stadi: { ...STADI, appuntamentoFissato: "", appuntamentoEffettuato: "" } });
    expect(esito.appuntamenti).toBe(dalCalendario);
    expect(esito.daStadi).toMatchObject({ appuntamenti: false, vendite: true });
  });

  it("solo gli appuntamenti dagli stadi: le vendite restano quelle con lo stato vinta", () => {
    const esito = applicaStadi({ opportunita, appuntamentiCalendario: dalCalendario, pipeline: PIPELINE, stadi: { ...STADI, vendita: "" } });
    expect(esito.opportunita).toBe(opportunita);
    expect(riepilogoOpportunita(esito.opportunita, SETTEMBRE.da, SETTEMBRE.a).vendite).toBe(1);
  });
});
