import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as archivio from "./archivio";
import { usaDatabase } from "./connessione";
import { apriDatabaseInMemoria } from "./inMemoria";
import type { Database } from "./tipi";
import { SENTINELLA_NON_ASSEGNATO } from "@/lib/assegnatari";
import type { AttivitaClienteRow, MetaDailyRow, TemplateTask } from "@/types/kpi";

// Tutte le scritture dell'archivio su un Postgres vero in memoria, creato dalle stesse migrazioni
// del database reale. I test di una sezione partono da ciò che hanno lasciato quelli prima: il
// database è uno solo per tutto il file, come nell'app.
let db: Database;
beforeAll(async () => {
  db = await apriDatabaseInMemoria();
  usaDatabase(db);
}, 60_000);
afterAll(async () => {
  usaDatabase(undefined);
  await db.chiudi();
});

const nuovoCliente = (clienteId: string, accessCode: string) => ({
  clienteId,
  nome: `Cliente ${clienteId}`,
  accessCode,
  consulenteId: "fc",
  mostraTabExtra: false,
  prodottoId: "",
  dataInizioProgetto: null,
});
const nuovaSede = (sedeId: string, clienteId: string) => ({ sedeId, clienteId, nome: "Principale", adAccountId: "111", targetCpa: null, targetCpl: 20 });

function attivita(over: Partial<AttivitaClienteRow>): AttivitaClienteRow {
  return {
    attivitaId: "a1",
    clienteId: "alc",
    prodottoId: "",
    taskId: "T1",
    blocco: "",
    fase: "",
    descrizione: "Attività",
    assegnatari: ["Francesco"],
    tipo: "",
    dataInizio: "2026-10-01",
    dataFine: "2026-10-10",
    stato: "todo",
    notaTeam: "",
    ordine: 1,
    ...over,
  };
}

function modello(over: Partial<TemplateTask>): TemplateTask {
  return {
    prodottoId: "prova",
    taskId: "P1",
    blocco: "setup",
    fase: "Sett. 1",
    descrizione: "Prima",
    assegnatari: ["Project Manager"],
    tipo: "PM",
    settimanaInizio: 1,
    settimanaFine: 1,
    giorniTesto: "gg 1",
    nota: "",
    ordine: 1,
    ...over,
  };
}

function giornaliero(over: Partial<MetaDailyRow>): MetaDailyRow {
  return { data: "2026-10-01", clienteId: "alc", campaignId: "c1", spesa: 10, impressions: 100, clicks: 5, ctr: 0.05, cpc: 2, cpm: 100, lead: 1, clicLink: 4, ...over };
}

describe("clienti", () => {
  it("crea un cliente attivo, senza funnel, e lo rilegge uguale", async () => {
    await archivio.creaCliente({ ...nuovoCliente("alc", "codice-alc"), dataInizioProgetto: "2026-09-01", email: "a@esempio.it" });
    await archivio.creaCliente(nuovoCliente("beta", "codice-beta"));
    const clienti = await archivio.getClienti();
    expect(clienti.map((c) => c.clienteId)).toEqual(["alc", "beta"]);
    expect(clienti[0]).toMatchObject({ attivo: true, funnels: [], dataInizioProgetto: "2026-09-01", email: "a@esempio.it", logoUrl: "" });
    expect(clienti[1].dataInizioProgetto).toBeNull();
  });

  it("due clienti con lo stesso id: errore, come sul foglio", async () => {
    await expect(archivio.creaCliente(nuovoCliente("alc", "altro"))).rejects.toThrow('Esiste già un cliente con id "alc"');
  });

  it("aggiorna solo i campi indicati; gli altri restano com'erano", async () => {
    await archivio.aggiornaCliente({ clienteId: "alc", nome: "ALC Srl", funnels: [{ id: "f1", nome: "Webinar", url: "https://esempio.it" }] });
    const alc = (await archivio.getClienti()).find((c) => c.clienteId === "alc");
    expect(alc).toMatchObject({ nome: "ALC Srl", email: "a@esempio.it", attivo: true, funnels: [{ id: "f1", nome: "Webinar", url: "https://esempio.it" }] });
    await archivio.aggiornaCliente({ clienteId: "alc", attivo: false });
    expect((await archivio.getClienti()).find((c) => c.clienteId === "alc")).toMatchObject({ nome: "ALC Srl", attivo: false });
    await archivio.aggiornaCliente({ clienteId: "alc", attivo: true });
  });

  it("aggiornare un cliente che non esiste: errore, anche senza campi da cambiare", async () => {
    await expect(archivio.aggiornaCliente({ clienteId: "nessuno" })).rejects.toThrow("Cliente non trovato: nessuno");
  });

  it("si trova dal codice di accesso; un codice sconosciuto non trova nessuno", async () => {
    expect((await archivio.getClienteByAccessCode("codice-beta"))?.clienteId).toBe("beta");
    expect(await archivio.getClienteByAccessCode("sbagliato")).toBeNull();
  });
});

describe("sedi e ciò che appartiene a una sede", () => {
  it("crea una sede attiva; i target non indicati restano non impostati", async () => {
    await archivio.creaSede(nuovaSede("alc--principale", "alc"));
    await archivio.creaSede({ ...nuovaSede("alc--seconda", "alc"), nome: "Seconda" });
    await expect(archivio.creaSede(nuovaSede("alc--principale", "alc"))).rejects.toThrow('Esiste già una sede con id "alc--principale"');
    const [sede] = await archivio.getSedi();
    expect(sede).toMatchObject({ sedeId: "alc--principale", attivo: true, targetCpa: null, targetCpl: 20, targetBudgetMensile: null, tutteLeCampagne: false });
  });

  it("un target si può togliere (null) senza toccare gli altri campi", async () => {
    await archivio.aggiornaSede({ sedeId: "alc--principale", targetCpl: null, targetBudgetMensile: 1500, tutteLeCampagne: true });
    const [sede] = await archivio.getSedi();
    expect(sede).toMatchObject({ targetCpl: null, targetBudgetMensile: 1500, tutteLeCampagne: true, nome: "Principale", adAccountId: "111" });
    await expect(archivio.aggiornaSede({ sedeId: "nessuna", nome: "x" })).rejects.toThrow("Sede non trovata: nessuna");
  });

  it("connessione GHL: nasce attiva e senza calendari; calendari e pipeline restano nell'ordine dato", async () => {
    await archivio.creaGhlConnessione({ connessioneId: "g1", sedeId: "alc--seconda", locationId: "loc", privateToken: "token" });
    await expect(archivio.creaGhlConnessione({ connessioneId: "g1", sedeId: "alc--seconda", locationId: "loc", privateToken: "t" })).rejects.toThrow(
      'Esiste già una connessione GHL con id "g1"'
    );
    await archivio.aggiornaGhlConnessione({ connessioneId: "g1", calendarIds: ["cal-b", "cal-a"], pipelineIds: ["p1"] });
    const [ghl] = await archivio.getGhlConnessioni();
    expect(ghl).toMatchObject({ attivo: true, privateToken: "token", calendarIds: ["cal-b", "cal-a"], pipelineIds: ["p1"], note: "" });
    expect(ghl.creataIl).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    await expect(archivio.aggiornaGhlConnessione({ connessioneId: "nessuna", note: "x" })).rejects.toThrow("Connessione GHL non trovata: nessuna");
  });

  it("categorie commerciali: lette in ordine di `ordine`, aggiornabili, eliminabili", async () => {
    const base = { sedeId: "alc--seconda", targetBudgetMensile: null, targetLeadSettimana: null, targetAppuntamentiSettimana: null, targetFatturatoMensile: null };
    await archivio.creaCategoriaCommerciale({ ...base, categoriaId: "cat-b", nome: "+30 ettari", ordine: 2 });
    await archivio.creaCategoriaCommerciale({ ...base, categoriaId: "cat-a", nome: "-30 ettari", ordine: 1 });
    await archivio.aggiornaCategoriaCommerciale({ categoriaId: "cat-b", tagGhl: "+30", pipelineGhl: "pip", targetLeadSettimana: 12 });
    const categorie = await archivio.getCategorieCommerciali();
    expect(categorie.map((c) => c.categoriaId)).toEqual(["cat-a", "cat-b"]);
    // Il nome che comincia con "+" resta testo (nel foglio serviva un apostrofo per non farlo diventare una formula).
    expect(categorie[1]).toMatchObject({ nome: "+30 ettari", tagGhl: "+30", pipelineGhl: "pip", targetLeadSettimana: 12, attivo: true });
    await archivio.eliminaCategoriaCommerciale("cat-a");
    await expect(archivio.eliminaCategoriaCommerciale("cat-a")).rejects.toThrow("Riga non trovata in CategorieCommerciali: cat-a");
  });

  it("venditori: crea, aggiorna, elimina", async () => {
    await archivio.creaVenditore({ venditoreId: "v1", sedeId: "alc--seconda", nome: "Luca", capienzaAppuntamentiMensile: 40 });
    await archivio.aggiornaVenditore({ venditoreId: "v1", ghlUserId: "u-9", attivo: false });
    expect(await archivio.getVenditori()).toEqual([{ venditoreId: "v1", sedeId: "alc--seconda", nome: "Luca", capienzaAppuntamentiMensile: 40, attivo: false, ghlUserId: "u-9" }]);
    await expect(archivio.aggiornaVenditore({ venditoreId: "nessuno", nome: "x" })).rejects.toThrow("Venditore non trovato: nessuno");
  });

  it("connessioni ai canali: la migrazione ne crea una Meta per ogni sede con un ad account, una volta sola", async () => {
    expect((await archivio.migraConnessioniMeta()).connessioniCreate).toEqual(["alc--principale", "alc--seconda"]);
    expect((await archivio.migraConnessioniMeta()).connessioniCreate).toEqual([]);
    await archivio.aggiornaConnessioneCanale({ connessioneId: "alc--seconda--meta", note: "verificata" });
    const connessioni = await archivio.getConnessioniCanale();
    expect(connessioni.map((c) => c.connessioneId)).toEqual(["alc--principale--meta", "alc--seconda--meta"]);
    expect(connessioni[1]).toMatchObject({ canale: "meta", accountId: "111", attivo: true, note: "verificata" });
  });

  it("eliminare una sede porta via connessione GHL, categorie, venditori e connessioni ai canali", async () => {
    await archivio.eliminaSede("alc--seconda");
    expect(await archivio.getGhlConnessioni()).toEqual([]);
    expect(await archivio.getCategorieCommerciali()).toEqual([]);
    expect(await archivio.getVenditori()).toEqual([]);
    expect((await archivio.getConnessioniCanale()).map((c) => c.connessioneId)).toEqual(["alc--principale--meta"]);
    await expect(archivio.eliminaSede("alc--seconda")).rejects.toThrow("Sede non trovata: alc--seconda");
  });
});

describe("campagne e dati giornalieri", () => {
  it("le campagne nuove entrano una volta sola, col tipo dedotto dal nome (saltando l'etichetta [ALC])", async () => {
    const candidate = [
      { campaignId: "c1", clienteId: "alc", sedeId: "alc--principale", nomeCampagna: "[ALC] [Prospecting] Lead" },
      { campaignId: "c2", clienteId: "alc", sedeId: "alc--principale", nomeCampagna: "[ALC] Lead senza tipo" },
      { campaignId: "c1", clienteId: "alc", sedeId: "alc--principale", nomeCampagna: "doppione nello stesso lotto" },
    ];
    await archivio.ensureCampagneMappate(candidate);
    await archivio.ensureCampagneMappate([...candidate, { campaignId: "c3", clienteId: "beta", sedeId: "beta--principale", nomeCampagna: "[Retargeting] 30gg", canale: "google" }]);
    const campagne = await archivio.getCampagne();
    expect(campagne.map((c) => `${c.canale}/${c.campaignId}/${c.tipoCampagna}`)).toEqual(["meta/c1/Prospecting", "meta/c2/", "google/c3/Retargeting"]);
    expect(campagne[0]).toMatchObject({ nomeCampagna: "[ALC] [Prospecting] Lead", stato: "" });
  });

  it("cambia lo stato solo dove è diverso, e scrive il cambio nello storico", async () => {
    await archivio.aggiornaStatoCampagne(new Map([["c1", "ACTIVE"], ["c2", ""], ["sconosciuta", "PAUSED"]]));
    expect((await archivio.getCampagne()).map((c) => c.stato)).toEqual(["ACTIVE", "", ""]);
    const storico = await archivio.getStoricoStatoCampagne();
    expect(storico).toHaveLength(1);
    expect(storico[0]).toMatchObject({ campaignId: "c1", clienteId: "alc", nomeCampagna: "[ALC] [Prospecting] Lead", statoPrecedente: "", statoNuovo: "ACTIVE" });

    await archivio.aggiornaStatoCampagne(new Map([["c1", "ACTIVE"]])); // nessun cambio: nessuna riga in più
    await archivio.aggiornaStatoCampagne(new Map([["c1", "PAUSED"]]));
    expect(await archivio.getStoricoStatoCampagne()).toHaveLength(2);
    const ultimo = await archivio.getUltimoCambioPerCampagna();
    expect([...ultimo.keys()]).toEqual(["c1"]);
    expect(ultimo.get("c1")).toBe((await archivio.getStoricoStatoCampagne())[1].cambiatoIl);
  });

  it("sposta a un'altra sede solo le campagne Meta indicate di quel cliente, e dice quante", async () => {
    await archivio.creaSede({ ...nuovaSede("alc--spagna", "alc"), nome: "Spagna" });
    expect(await archivio.spostaCampagneASede("alc", ["c1", "c3", "inesistente"], "alc--spagna")).toBe(1);
    expect(await archivio.spostaCampagneASede("alc", ["c1"], "alc--spagna")).toBe(0); // è già lì
    expect(await archivio.spostaCampagneASede("alc", [], "alc--spagna")).toBe(0);
    expect((await archivio.getCampagne()).map((c) => c.sedeId)).toEqual(["alc--spagna", "alc--principale", "beta--principale"]);
  });

  it("dati giornalieri: una riga nuova entra, una con la stessa chiave viene sostituita", async () => {
    await archivio.upsertMetaDailyRows([giornaliero({}), giornaliero({ data: "2026-10-02", spesa: 20 })]);
    await archivio.upsertMetaDailyRows([
      giornaliero({ spesa: 12.5, lead: 3 }), // stessa chiave del primo giorno
      giornaliero({ clienteId: "beta", spesa: 7 }), // stessa campagna e giorno, altro cliente: è un'altra riga
      giornaliero({ canale: "google", spesa: 9, lead: 0.5 }), // altro canale: un'altra riga ancora
    ]);
    const righe = await archivio.getMetaDaily();
    expect(righe.map((r) => `${r.canale}/${r.clienteId}/${r.data}/${r.spesa}/${r.lead}`)).toEqual([
      "meta/alc/2026-10-01/12.5/3",
      "meta/alc/2026-10-02/20/1",
      "meta/beta/2026-10-01/7/1",
      "google/alc/2026-10-01/9/0.5",
    ]);
  });

  it("due righe con la stessa chiave nello stesso lotto: vale l'ultima, senza errori", async () => {
    await archivio.upsertMetaDailyRows([giornaliero({ data: "2026-10-03", spesa: 1 }), giornaliero({ data: "2026-10-03", spesa: 2, impressions: 150.4 })]);
    const riga = (await archivio.getMetaDaily()).find((r) => r.data === "2026-10-03");
    expect(riga).toMatchObject({ spesa: 2, impressions: 150 });
  });

  it("un lotto più grande del limite per query entra tutto", async () => {
    const tante = Array.from({ length: 2300 }, (_, i) => giornaliero({ campaignId: `lotto-${i}`, data: "2026-09-01", spesa: 1 }));
    await archivio.upsertMetaDailyRows(tante);
    expect((await archivio.getMetaDaily()).filter((r) => r.data === "2026-09-01")).toHaveLength(2300);
  });
});

describe("attività, tappe e meeting", () => {
  it("aggiunge solo le attività che non esistono già", async () => {
    await archivio.creaAttivitaPerCliente([attivita({}), attivita({ attivitaId: "a2", assegnatari: [], dataFine: "2026-10-20" })]);
    await archivio.creaAttivitaPerCliente([attivita({ descrizione: "non deve sovrascrivere" }), attivita({ attivitaId: "a3", taskId: "m-alc::abc-0" })]);
    const tutte = await archivio.getAttivitaCliente();
    expect(tutte.map((a) => a.attivitaId)).toEqual(["a1", "a2", "a3"]);
    expect(tutte[0].descrizione).toBe("Attività");
    // Nessun assegnatario = "Da assegnare", come leggeva il foglio da una cella vuota.
    expect(tutte[1].assegnatari).toEqual([SENTINELLA_NON_ASSEGNATO]);
  });

  it("stato con o senza nota, scadenza, assegnatari: ognuno tocca solo il suo campo", async () => {
    await archivio.aggiornaStatoAttivita("a1", "blocked", "manca il materiale");
    await archivio.aggiornaStatoAttivita("a1", "wip"); // senza nota: la nota resta
    await archivio.aggiornaScadenzaAttivita("a1", "2026-11-05");
    await archivio.aggiornaAssegnatariAttivita("a1", ["Cliente", "Alina"]);
    const a1 = (await archivio.getAttivitaCliente())[0];
    expect(a1).toMatchObject({ stato: "wip", notaTeam: "manca il materiale", dataFine: "2026-11-05", dataInizio: "2026-10-01", assegnatari: ["Cliente", "Alina"] });
  });

  it("un'attività che non esiste: gli stessi errori del foglio", async () => {
    await expect(archivio.aggiornaStatoAttivita("nessuna", "done")).rejects.toThrow("Attività non trovata: nessuna");
    await expect(archivio.aggiornaScadenzaAttivita("nessuna", "2026-11-05")).rejects.toThrow("Attività non trovata: nessuna");
    await expect(archivio.eliminaAttivita("nessuna")).rejects.toThrow("Riga non trovata in AttivitaCliente: nessuna");
    await archivio.eliminaAttivita("a2");
    expect((await archivio.getAttivitaCliente()).map((a) => a.attivitaId)).toEqual(["a1", "a3"]);
  });

  it("una tappa si registra una volta sola", async () => {
    await archivio.registraFaseCompletata("alc", "Fase 1", "2026-10-05");
    await archivio.registraFaseCompletata("alc", "Fase 1", "2026-10-06");
    expect(await archivio.getFasiCompletate()).toEqual([{ clienteId: "alc", fase: "Fase 1", completataIl: "2026-10-05" }]);
  });

  it("un meeting nuovo viene creato, lo stesso meeting salvato di nuovo viene aggiornato", async () => {
    const meeting = { meetingId: "alc::abc", clienteId: "alc", data: "2026-10-02", titolo: "Allineamento", sentiment: "Positivo", aggiornatoIl: "2026-10-02T15:00:00.000Z", dati: { title: "Allineamento", highlights: ["uno"] } };
    expect(await archivio.salvaMeeting(meeting)).toEqual({ aggiornato: false });
    expect(await archivio.salvaMeeting({ ...meeting, sentiment: "Negativo", dati: { title: "Allineamento", highlights: ["uno", "due"] } })).toEqual({ aggiornato: true });
    expect(await archivio.getMeetingCliente()).toEqual([{ ...meeting, sentiment: "Negativo", dati: { title: "Allineamento", highlights: ["uno", "due"] } }]);
  });

  it("eliminare un meeting porta via le attività nate da quel meeting, e solo quelle", async () => {
    await archivio.eliminaMeeting("alc::abc");
    expect(await archivio.getMeetingCliente()).toEqual([]);
    expect((await archivio.getAttivitaCliente()).map((a) => a.attivitaId)).toEqual(["a1"]);
    await expect(archivio.eliminaMeeting("alc::abc")).rejects.toThrow("Riga non trovata in MeetingCliente: alc::abc");
  });
});

describe("prospect e report commerciali", () => {
  it("crea un prospect attivo; i target e il calcolatore nascono non impostati", async () => {
    await archivio.creaProspect({ prospectId: "p1", ragioneSociale: "Serramenti Srl", commercialeId: "mr", creatoIl: "2026-09-20T09:00:00.000Z" });
    await expect(archivio.creaProspect({ prospectId: "p1", ragioneSociale: "x", commercialeId: "mr", creatoIl: "2026-09-20T09:00:00.000Z" })).rejects.toThrow(
      'Esiste già un prospect con id "p1"'
    );
    const [p] = await archivio.getProspect();
    expect(p).toMatchObject({ attivo: true, creatoIl: "2026-09-20T09:00:00.000Z", targetCpl: null, calcolatoreBudget: null, clienteId: "", nomeContatto: "", tipoBusiness: "" });
  });

  it("aggiorna il calcolatore e i target, e li può togliere", async () => {
    const calcolatore = { fatturatoMensile: 45000, ticketMedio: 9000, margine: 0.3, cpl: 15, tassoAppuntamento: 0.2, tassoChiusura: 0.5, variazioneStagionale: null };
    await archivio.aggiornaProspect({ prospectId: "p1", calcolatoreBudget: calcolatore, targetCpl: 15, nomeContatto: "Giulia", clienteId: "alc" });
    expect((await archivio.getProspect())[0]).toMatchObject({ calcolatoreBudget: calcolatore, targetCpl: 15, nomeContatto: "Giulia", clienteId: "alc", ragioneSociale: "Serramenti Srl" });
    await archivio.aggiornaProspect({ prospectId: "p1", calcolatoreBudget: null, targetCpl: null });
    expect((await archivio.getProspect())[0]).toMatchObject({ calcolatoreBudget: null, targetCpl: null, nomeContatto: "Giulia" });
    await expect(archivio.aggiornaProspect({ prospectId: "nessuno", sedi: "x" })).rejects.toThrow("Prospect non trovato: nessuno");
  });

  it("un report nuovo viene creato, lo stesso report salvato di nuovo viene aggiornato; col prospect se ne va anche lui", async () => {
    const report = { reportId: "r1", prospectId: "p1", commercialeId: "mr", data: "2026-09-30", aggiornatoIl: "2026-09-30T12:00:00.000Z", dati: { titolo: "Prima chiamata" } };
    expect(await archivio.salvaReportCommerciale(report)).toEqual({ aggiornato: false });
    expect(await archivio.salvaReportCommerciale({ ...report, dati: { titolo: "Prima chiamata", sedi: "Bergamo" } })).toEqual({ aggiornato: true });
    expect(await archivio.getReportCommerciale()).toEqual([{ ...report, dati: { titolo: "Prima chiamata", sedi: "Bergamo" } }]);
    await archivio.eliminaProspect("p1");
    expect(await archivio.getReportCommerciale()).toEqual([]);
    await expect(archivio.eliminaProspect("p1")).rejects.toThrow("Prospect non trovato: p1");
  });
});

describe("squadra: consulenti e commerciali gestiti dall'app", () => {
  it("una persona nuova nasce attiva; l'elenco che arriva alle pagine non contiene la password", async () => {
    await archivio.creaMembroSquadra({ ruolo: "consulente", id: "mario", nome: "Mario Rossi", email: "mario@esempio.it", password: "impronta-mario" });
    await archivio.creaMembroSquadra({ ruolo: "commerciale", id: "mario", nome: "Mario Venditore", email: "", password: "impronta-mario-comm" });
    const consulente = (await archivio.getConsulenti()).find((c) => c.consulenteId === "mario");
    expect(consulente).toEqual({ consulenteId: "mario", nome: "Mario Rossi", attivo: true, email: "mario@esempio.it" });
    expect(consulente).not.toHaveProperty("password");
    expect((await archivio.getCommerciali()).find((c) => c.commercialeId === "mario")).toEqual({ commercialeId: "mario", nome: "Mario Venditore", attivo: true, email: "" });
  });

  it("le credenziali si leggono a parte: prima i consulenti, poi i commerciali, ognuno col suo ruolo", async () => {
    expect(await archivio.getCredenzialiAccesso()).toEqual([
      { ruolo: "consulente", id: "mario", attivo: true, password: "impronta-mario" },
      { ruolo: "commerciale", id: "mario", attivo: true, password: "impronta-mario-comm" },
    ]);
  });

  it("due persone con lo stesso id nello stesso ruolo: errore", async () => {
    await expect(archivio.creaMembroSquadra({ ruolo: "consulente", id: "mario", nome: "Altro", email: "", password: "x" })).rejects.toThrow('Esiste già un consulente con id "mario"');
    await expect(archivio.creaMembroSquadra({ ruolo: "commerciale", id: "mario", nome: "Altro", email: "", password: "x" })).rejects.toThrow('Esiste già un commerciale con id "mario"');
  });

  it("aggiorna solo i campi indicati: disattivare non tocca la password, cambiare password non tocca il resto", async () => {
    await archivio.aggiornaMembroSquadra({ ruolo: "commerciale", id: "mario", attivo: false });
    await archivio.aggiornaMembroSquadra({ ruolo: "consulente", id: "mario", password: "impronta-nuova" });
    expect(await archivio.getCredenzialiAccesso()).toEqual([
      { ruolo: "consulente", id: "mario", attivo: true, password: "impronta-nuova" },
      { ruolo: "commerciale", id: "mario", attivo: false, password: "impronta-mario-comm" },
    ]);
    expect((await archivio.getConsulenti()).find((c) => c.consulenteId === "mario")?.email).toBe("mario@esempio.it");
  });

  it("un consulente che cambia nome resta l'assegnatario delle sue attività, nei clienti e nei modelli", async () => {
    await archivio.creaCliente(nuovoCliente("gamma", "codice-gamma"));
    await archivio.creaAttivitaPerCliente([
      attivita({ attivitaId: "g1", clienteId: "gamma", assegnatari: ["Mario Rossi", "Cliente"] }),
      attivita({ attivitaId: "g2", clienteId: "gamma", assegnatari: ["Mario"] }),
      attivita({ attivitaId: "g3", clienteId: "gamma", assegnatari: ["Altra Persona"] }),
    ]);
    await archivio.creaProdotto({ prodottoId: "prova", nome: "Prodotto di prova", durataSettimane: 8 });
    await archivio.salvaTemplateTask(modello({ taskId: "P1", assegnatari: ["Mario Rossi"] }));

    await archivio.aggiornaMembroSquadra({ ruolo: "consulente", id: "mario", nome: "Mario Rossi Bianchi" });

    const perId = new Map((await archivio.getAttivitaCliente()).map((a) => [a.attivitaId, a.assegnatari]));
    expect(perId.get("g1")).toEqual(["Mario Rossi Bianchi", "Cliente"]);
    // Il nome di battesimo non è cambiato: le attività intestate a "Mario" restano sue così come sono.
    expect(perId.get("g2")).toEqual(["Mario"]);
    expect(perId.get("g3")).toEqual(["Altra Persona"]);
    expect((await archivio.getTemplateAttivita()).find((t) => t.taskId === "P1")?.assegnatari).toEqual(["Mario Rossi Bianchi"]);
  });

  it("se cambia il nome di battesimo lo seguono anche le attività intestate solo a quello, maiuscole o minuscole che siano", async () => {
    await archivio.creaAttivitaPerCliente([attivita({ attivitaId: "g4", clienteId: "gamma", assegnatari: ["Cliente", "mario "] })]);
    await archivio.aggiornaMembroSquadra({ ruolo: "consulente", id: "mario", nome: "Marino Rossi Bianchi" });
    const perId = new Map((await archivio.getAttivitaCliente()).map((a) => [a.attivitaId, a.assegnatari]));
    expect(perId.get("g1")).toEqual(["Marino Rossi Bianchi", "Cliente"]);
    expect(perId.get("g2")).toEqual(["Marino"]);
    expect(perId.get("g4")).toEqual(["Cliente", "Marino"]);
    expect(perId.get("g3")).toEqual(["Altra Persona"]);
  });

  it("con due consulenti dallo stesso nome di battesimo, le attività intestate solo a quello non si toccano", async () => {
    await archivio.creaMembroSquadra({ ruolo: "consulente", id: "marino-verdi", nome: "Marino Verdi", email: "", password: "impronta-verdi" });
    await archivio.aggiornaMembroSquadra({ ruolo: "consulente", id: "mario", nome: "Mario Rossi Bianchi" });
    const perId = new Map((await archivio.getAttivitaCliente()).map((a) => [a.attivitaId, a.assegnatari]));
    expect(perId.get("g1")).toEqual(["Mario Rossi Bianchi", "Cliente"]);
    expect(perId.get("g2")).toEqual(["Marino"]);
    await archivio.eliminaMembroSquadra("consulente", "marino-verdi");
  });

  it("il nome di un commerciale non è scritto nelle attività: cambiarlo non le tocca", async () => {
    await archivio.aggiornaMembroSquadra({ ruolo: "commerciale", id: "mario", nome: "Altra Persona 2" });
    await archivio.aggiornaMembroSquadra({ ruolo: "commerciale", id: "mario", nome: "Mario Venditore" });
    expect((await archivio.getAttivitaCliente()).find((a) => a.attivitaId === "g3")?.assegnatari).toEqual(["Altra Persona"]);
  });

  it("una persona che non esiste: errore, sia modificandola sia eliminandola", async () => {
    await expect(archivio.aggiornaMembroSquadra({ ruolo: "consulente", id: "nessuno", attivo: false })).rejects.toThrow("Consulente non trovato: nessuno");
    await expect(archivio.eliminaMembroSquadra("commerciale", "nessuno")).rejects.toThrow("Commerciale non trovato: nessuno");
  });

  it("eliminare un commerciale non tocca il consulente con lo stesso id", async () => {
    await archivio.eliminaMembroSquadra("commerciale", "mario");
    expect((await archivio.getCredenzialiAccesso()).map((c) => `${c.ruolo}/${c.id}`)).toEqual(["consulente/mario"]);
  });
});

describe("prodotti e modelli di attività gestiti dall'app", () => {
  it("un prodotto nuovo nasce attivo; lo stesso id due volte è un errore", async () => {
    expect((await archivio.getProdotti()).find((p) => p.prodottoId === "prova")).toEqual({ prodottoId: "prova", nome: "Prodotto di prova", attivo: true, durataSettimane: 8, note: "" });
    await expect(archivio.creaProdotto({ prodottoId: "prova", nome: "Doppio", durataSettimane: 1 })).rejects.toThrow('Esiste già un prodotto con id "prova"');
  });

  it("aggiorna solo i campi indicati; un prodotto che non esiste è un errore", async () => {
    await archivio.aggiornaProdotto({ prodottoId: "prova", durataSettimane: 12.4, note: "nota" });
    expect((await archivio.getProdotti()).find((p) => p.prodottoId === "prova")).toEqual({ prodottoId: "prova", nome: "Prodotto di prova", attivo: true, durataSettimane: 12, note: "nota" });
    await expect(archivio.aggiornaProdotto({ prodottoId: "nessuno", nome: "x" })).rejects.toThrow("Prodotto non trovato: nessuno");
  });

  it("un'attività del modello nuova viene creata, la stessa salvata di nuovo viene aggiornata", async () => {
    expect(await archivio.salvaTemplateTask(modello({ taskId: "P2", descrizione: "Seconda", assegnatari: ["Project Manager", "Cliente"], ordine: 2 }))).toEqual({ aggiornato: false });
    expect(await archivio.salvaTemplateTask(modello({ taskId: "P2", descrizione: "Seconda, rivista", assegnatari: ["Cliente", "Project Manager"], ordine: 2, settimanaFine: 3 }))).toEqual({ aggiornato: true });
    const p2 = (await archivio.getTemplateAttivita()).filter((t) => t.prodottoId === "prova" && t.taskId === "P2");
    expect(p2).toHaveLength(1);
    expect(p2[0]).toMatchObject({ descrizione: "Seconda, rivista", assegnatari: ["Cliente", "Project Manager"], settimanaFine: 3 });
  });

  it("riordina: le attività prendono 1, 2, 3… nell'ordine dato; quelle di altri prodotti restano com'erano", async () => {
    await archivio.creaProdotto({ prodottoId: "altro", nome: "Altro", durataSettimane: 4 });
    await archivio.salvaTemplateTask(modello({ prodottoId: "altro", taskId: "P1", ordine: 7 }));
    await archivio.salvaTemplateTask(modello({ taskId: "P3", ordine: 3 }));
    await archivio.riordinaTemplateAttivita("prova", ["P3", "P1", "P2"]);
    const tutte = await archivio.getTemplateAttivita();
    expect(Object.fromEntries(tutte.filter((t) => t.prodottoId === "prova").map((t) => [t.taskId, t.ordine]))).toEqual({ P3: 1, P1: 2, P2: 3 });
    expect(tutte.find((t) => t.prodottoId === "altro")?.ordine).toBe(7);
  });

  it("elimina un'attività del modello; una che non c'è è un errore", async () => {
    await archivio.eliminaTemplateTask("prova", "P3");
    expect((await archivio.getTemplateAttivita()).filter((t) => t.prodottoId === "prova").map((t) => t.taskId).sort()).toEqual(["P1", "P2"]);
    await expect(archivio.eliminaTemplateTask("prova", "P3")).rejects.toThrow("Riga non trovata in TemplateAttivita: prova/P3");
  });

  it("eliminare un prodotto porta via il suo modello, e solo il suo", async () => {
    await archivio.eliminaProdotto("prova");
    expect((await archivio.getTemplateAttivita()).map((t) => `${t.prodottoId}/${t.taskId}`)).toEqual(["altro/P1"]);
    await expect(archivio.eliminaProdotto("prova")).rejects.toThrow("Prodotto non trovato: prova");
  });
});

describe("risultati inseriti a mano", () => {
  const riga = (tipoCampagna: string, vendite: number, fatturato: number) => ({ tipoCampagna, richieste: 10, appuntamentiFissati: 6, appuntamentiEffettuati: 4, vendite, fatturato });

  it("salva le righe di una sede per un periodo, una per tipo di campagna", async () => {
    await archivio.creaSede(nuovaSede("gamma--principale", "gamma"));
    await archivio.salvaRisultatiCommerciali({ clienteId: "gamma", sedeId: "gamma--principale", periodo: "2026-09-28", righe: [riga("Cucine", 2, 9000.5), riga("", 1, 3000)] });
    expect(await archivio.getRisultatiCommerciali()).toEqual([
      { periodo: "2026-09-28", clienteId: "gamma", sedeId: "gamma--principale", tipoCampagna: "Cucine", richieste: 10, appuntamentiFissati: 6, appuntamentiEffettuati: 4, vendite: 2, fatturato: 9000.5 },
      { periodo: "2026-09-28", clienteId: "gamma", sedeId: "gamma--principale", tipoCampagna: "", richieste: 10, appuntamentiFissati: 6, appuntamentiEffettuati: 4, vendite: 1, fatturato: 3000 },
    ]);
  });

  it("salvare di nuovo lo stesso periodo sostituisce, non somma; gli altri periodi restano", async () => {
    await archivio.salvaRisultatiCommerciali({ clienteId: "gamma", sedeId: "gamma--principale", periodo: "2026-08", righe: [riga("Cucine", 5, 20000)] });
    await archivio.salvaRisultatiCommerciali({ clienteId: "gamma", sedeId: "gamma--principale", periodo: "2026-09-28", righe: [riga("Cucine", 3, 12000)] });
    const righe = await archivio.getRisultatiCommerciali();
    expect(righe.map((r) => `${r.periodo}/${r.tipoCampagna}/${r.vendite}`).sort()).toEqual(["2026-08/Cucine/5", "2026-09-28/Cucine/3"]);
  });

  it("nessuna riga: il periodo torna non compilato", async () => {
    await archivio.salvaRisultatiCommerciali({ clienteId: "gamma", sedeId: "gamma--principale", periodo: "2026-09-28", righe: [] });
    expect((await archivio.getRisultatiCommerciali()).map((r) => r.periodo)).toEqual(["2026-08"]);
  });

  it("due righe uguali per periodo, sede e tipo non possono esistere: se il salvataggio fallisce resta tutto com'era", async () => {
    await expect(
      archivio.salvaRisultatiCommerciali({ clienteId: "gamma", sedeId: "gamma--principale", periodo: "2026-08", righe: [riga("Cucine", 1, 1), riga("Cucine", 2, 2)] })
    ).rejects.toThrow();
    expect((await archivio.getRisultatiCommerciali()).map((r) => `${r.periodo}/${r.vendite}`)).toEqual(["2026-08/5"]);
  });

  it("risultati dei venditori: stesso meccanismo, per sede e mese", async () => {
    await archivio.creaVenditore({ venditoreId: "v-anna", sedeId: "gamma--principale", nome: "Anna", capienzaAppuntamentiMensile: 20 });
    await archivio.creaVenditore({ venditoreId: "v-luca", sedeId: "gamma--principale", nome: "Luca", capienzaAppuntamentiMensile: 15 });
    const mese = (appuntamenti: number) => ({
      sedeId: "gamma--principale",
      mese: "2026-09",
      righe: [
        { venditoreId: "v-anna", appuntamentiFissati: appuntamenti, vendite: 2, fatturato: 8000 },
        { venditoreId: "v-luca", appuntamentiFissati: 4, vendite: 0, fatturato: 0 },
      ],
    });
    await archivio.salvaRisultatiVenditori(mese(9));
    await archivio.salvaRisultatiVenditori(mese(11));
    expect(await archivio.getRisultatiVenditori()).toEqual([
      { mese: "2026-09", sedeId: "gamma--principale", venditoreId: "v-anna", appuntamentiFissati: 11, vendite: 2, fatturato: 8000 },
      { mese: "2026-09", sedeId: "gamma--principale", venditoreId: "v-luca", appuntamentiFissati: 4, vendite: 0, fatturato: 0 },
    ]);
    await archivio.salvaRisultatiVenditori({ sedeId: "gamma--principale", mese: "2026-09", righe: [] });
    expect(await archivio.getRisultatiVenditori()).toEqual([]);
  });

  it("con il cliente se ne vanno i suoi risultati commerciali", async () => {
    await archivio.eliminaCliente("gamma");
    expect(await archivio.getRisultatiCommerciali()).toEqual([]);
  });
});

describe("eliminare un cliente", () => {
  it("porta via sedi, attività e tappe; campagne e dati giornalieri restano come storico", async () => {
    await archivio.eliminaCliente("alc");
    expect((await archivio.getClienti()).map((c) => c.clienteId)).toEqual(["beta"]);
    expect(await archivio.getSedi()).toEqual([]);
    expect(await archivio.getAttivitaCliente()).toEqual([]);
    expect(await archivio.getFasiCompletate()).toEqual([]);
    expect(await archivio.getConnessioniCanale()).toEqual([]);
    expect((await archivio.getCampagne()).filter((c) => c.clienteId === "alc")).toHaveLength(2);
    expect((await archivio.getMetaDaily()).some((r) => r.clienteId === "alc")).toBe(true);
    await expect(archivio.eliminaCliente("alc")).rejects.toThrow("Cliente non trovato: alc");
  });
});

describe("le migrazioni nate per riparare il foglio", () => {
  it("sul database non hanno nulla da fare", async () => {
    expect(await archivio.migraSediEsistenti()).toEqual({ sedeCreatePerCliente: [], campagneBackfillate: 0, risultatiCommercialiBackfillate: 0 });
    expect(await archivio.migraAssegnatariEsistenti()).toEqual({ attivitaCliente: [], templateAttivita: [] });
  });

  it("il vecchio link alla landing page diventa il primo funnel, una volta sola", async () => {
    await archivio.aggiornaCliente({ clienteId: "beta", landingPageUrl: " https://landing.esempio.it " });
    expect(await archivio.migraFunnelClientiEsistenti()).toEqual({ migrati: 1 });
    expect(await archivio.migraFunnelClientiEsistenti()).toEqual({ migrati: 0 });
    expect((await archivio.getClienti())[0].funnels).toMatchObject([{ nome: "Landing page", url: "https://landing.esempio.it" }]);
  });
});
