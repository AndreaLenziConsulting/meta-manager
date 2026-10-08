import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eseguiCopia, preparaCopia, type DatiFoglio } from "./copiaDaFoglio";
import { apriDatabaseInMemoria } from "./inMemoria";
import type { Database } from "./tipi";

// Un foglio minuscolo ma con tutti i casi che contano: liste da tenere in ordine, JSON, campi
// facoltativi vuoti, una riga orfana, un doppione sui dati giornalieri, un decimale dove serve un intero.
function foglio(): DatiFoglio {
  return {
    consulenti: [{ consulenteId: "fc", nome: "Francesco", attivo: true, email: "" }],
    commerciali: [{ commercialeId: "mr", nome: "Matteo", attivo: true, email: "" }],
    credenziali: [
      { ruolo: "consulente", id: "fc", attivo: true, password: "segreta-fc" },
      { ruolo: "commerciale", id: "mr", attivo: true, password: "segreta-mr" },
    ],
    prodotti: [{ prodottoId: "gtm", nome: "GTM", attivo: true, durataSettimane: 12, note: "" }],
    templateAttivita: [
      {
        prodottoId: "gtm",
        taskId: "T1",
        blocco: "setup",
        fase: "Fase 1",
        descrizione: "Prima attività",
        assegnatari: ["Project Manager", "Cliente"],
        tipo: "",
        settimanaInizio: 1,
        settimanaFine: 2,
        giorniTesto: "",
        nota: "",
        ordine: 1,
      },
    ],
    clienti: [
      {
        clienteId: "alc",
        nome: "ALC",
        accessCode: "codice-alc",
        attivo: true,
        consulenteId: "fc",
        mostraTabExtra: true,
        prodottoId: "gtm",
        dataInizioProgetto: "2026-09-01",
        email: "",
        logoUrl: "",
        colorePrimario: "",
        coloreSecondario: "",
        fontPersonalizzato: "",
        driveFolderUrl: "",
        landingPageUrl: "",
        appuntamentiFileUrl: "",
        funnels: [{ id: "f1", nome: "Webinar", url: "https://esempio.it" }],
      },
      {
        // Senza codice di accesso, consulente, prodotto né data: campi facoltativi vuoti.
        clienteId: "nuovo",
        nome: "Nuovo",
        accessCode: "",
        attivo: true,
        consulenteId: "",
        mostraTabExtra: false,
        prodottoId: "",
        dataInizioProgetto: null,
        email: "",
        logoUrl: "",
        colorePrimario: "",
        coloreSecondario: "",
        fontPersonalizzato: "",
        driveFolderUrl: "",
        landingPageUrl: "",
        appuntamentiFileUrl: "",
        funnels: [],
      },
    ],
    sedi: [
      {
        sedeId: "alc--principale",
        clienteId: "alc",
        nome: "Principale",
        adAccountId: "123",
        targetCpa: null,
        targetCpl: 30,
        tipoConversioneLead: "",
        attivo: true,
        targetBudgetMensile: null,
        targetLeadSettimana: null,
        targetAppuntamentiSettimana: null,
        targetFatturatoMensile: null,
        tutteLeCampagne: true,
      },
    ],
    ghlConnessioni: [
      {
        connessioneId: "g1",
        sedeId: "alc--principale",
        locationId: "loc",
        privateToken: "token",
        attivo: true,
        note: "",
        creataIl: "2026-09-01T10:00:00.000Z",
        calendarIds: ["cal-b", "cal-a"],
        pipelineIds: [],
      },
    ],
    connessioniCanale: [
      { connessioneId: "c1", sedeId: "alc--principale", canale: "meta", accountId: "123", tipoConversioneLead: "", attivo: true, note: "", creataIl: "2026-09-01T10:00:00.000Z" },
      // La sua sede è stata eliminata: non può entrare, e deve risultare fra le scartate.
      { connessioneId: "c-orfana", sedeId: "sede-eliminata", canale: "meta", accountId: "9", tipoConversioneLead: "", attivo: true, note: "", creataIl: "" },
    ],
    categorieCommerciali: [],
    venditori: [],
    campagne: [
      { campaignId: "c1", clienteId: "alc", sedeId: "alc--principale", nomeCampagna: "[ALC] Lead", tipoCampagna: "Prospecting", stato: "ACTIVE" },
      // Campagna di una sede eliminata: storico, resta.
      { campaignId: "c2", clienteId: "alc", sedeId: "sede-eliminata", nomeCampagna: "Vecchia", tipoCampagna: "", stato: "PAUSED" },
    ],
    storicoStato: [{ cambiatoIl: "2026-10-01T08:00:00.000Z", campaignId: "c1", clienteId: "alc", nomeCampagna: "[ALC] Lead", statoPrecedente: "PAUSED", statoNuovo: "ACTIVE" }],
    metaDaily: [
      { data: "2026-10-01", clienteId: "alc", campaignId: "c1", spesa: 10, impressions: 100, clicks: 5, ctr: 0.05, cpc: 2, cpm: 100, lead: 1, clicLink: 4 },
      // Stessa chiave della riga sopra: vale questa, l'ultima.
      { data: "2026-10-01", clienteId: "alc", campaignId: "c1", spesa: 12.5, impressions: 120.4, clicks: 6, ctr: 0.05, cpc: 2, cpm: 100, lead: 2, clicLink: 4 },
      // Stessa campagna e stesso giorno ma sotto un altro cliente: è un'altra riga.
      { data: "2026-10-01", clienteId: "nuovo", campaignId: "c1", spesa: 3, impressions: 30, clicks: 1, ctr: 0.03, cpc: 3, cpm: 100, lead: 0, clicLink: 1 },
    ],
    risultatiCommerciali: [],
    risultatiVenditori: [],
    attivita: [
      {
        attivitaId: "a1",
        clienteId: "alc",
        prodottoId: "gtm",
        taskId: "T1",
        blocco: "setup",
        fase: "Fase 1",
        descrizione: "Prima attività",
        assegnatari: ["Francesco", "Cliente"],
        tipo: "",
        dataInizio: "2026-09-01",
        dataFine: "2026-09-10",
        stato: "wip",
        notaTeam: "",
        ordine: 1,
      },
    ],
    fasiCompletate: [{ clienteId: "alc", fase: "Fase 0", completataIl: "2026-09-05" }],
    meeting: [{ meetingId: "m1", clienteId: "alc", data: "2026-10-02", titolo: "Allineamento", sentiment: "Positivo", aggiornatoIl: "2026-10-02T15:00:00.000Z", dati: { title: "Allineamento", highlights: ["uno", "due"] } }],
    prospect: [
      {
        prospectId: "p1",
        ragioneSociale: "Serramenti Srl",
        nomeContatto: "",
        tipoBusiness: "",
        fatturato: "",
        sedi: "",
        email: "",
        commercialeId: "mr",
        attivo: true,
        creatoIl: "2026-09-20T09:00:00.000Z",
        driveFolderUrl: "",
        mediaBudgetMensile: null,
        targetCpl: null,
        targetCpaAppuntamento: null,
        targetLeadSettimana: null,
        targetAppuntamentiSettimana: null,
        targetFatturatoMensile: null,
        targetMargineVenditaPct: null,
        clienteId: "",
        consulenteSuggeritoId: "",
        calcolatoreBudget: null,
      },
    ],
    reportCommerciale: [{ reportId: "r1", prospectId: "p1", commercialeId: "mr", data: "2026-09-30", aggiornatoIl: "2026-09-30T12:00:00.000Z", dati: { titolo: "Prima chiamata" } }],
  };
}

describe("preparaCopia", () => {
  it("la riga di una sede che non esiste più non sparisce in silenzio: è fra le scartate, col motivo", () => {
    const { tabelle, scartate } = preparaCopia(foglio());
    expect(tabelle.connessioni_canale).toHaveLength(1);
    expect(scartate).toEqual([{ tabella: "connessioni_canale", id: "c-orfana", motivo: "la sede non esiste più" }]);
  });

  it("le campagne di una sede eliminata restano: sono storico che l'app conserva di proposito", () => {
    expect(preparaCopia(foglio()).tabelle.campagne).toHaveLength(2);
  });

  it("dati giornalieri: stessa chiave → vale l'ultima riga; il cliente fa parte della chiave", () => {
    const { tabelle, avvisi } = preparaCopia(foglio());
    expect(tabelle.meta_daily).toHaveLength(2);
    expect(tabelle.meta_daily.find((r) => r.cliente_id === "alc")?.spesa).toBe(12.5);
    expect(avvisi.some((a) => a.startsWith("meta_daily: 1 righe con la stessa chiave"))).toBe(true);
  });

  it("un decimale dove serve un intero viene arrotondato e dichiarato fra gli avvisi", () => {
    const { tabelle, avvisi } = preparaCopia(foglio());
    expect(tabelle.meta_daily.find((r) => r.cliente_id === "alc")?.impressions).toBe(120);
    expect(avvisi).toContain("meta_daily.impressions: 1 valori con decimali arrotondati all'intero.");
  });
});

describe("eseguiCopia (su un Postgres vero in memoria, creato dalle migrazioni)", () => {
  let db: Database;
  beforeAll(async () => {
    db = await apriDatabaseInMemoria();
  }, 60_000);
  afterAll(async () => {
    await db.chiudi();
  });

  it("scrive ogni tabella e riconta: tante righe quante ne sono state preparate", async () => {
    const esito = await eseguiCopia(db, foglio());
    expect(esito.scritte).toMatchObject({ clienti: 2, sedi: 1, connessioni_canale: 1, campagne: 2, meta_daily: 2, attivita_cliente: 1, meeting_cliente: 1, prospect: 1, report_commerciale: 1 });
    expect(esito.scartate).toHaveLength(1);
  });

  it("le liste restano nell'ordine del foglio, il JSON torna uguale, i campi facoltativi vuoti restano vuoti", async () => {
    const [attivita] = await db.esegui<{ assegnatari: string[]; data_fine: string }>("select assegnatari, data_fine::text from public.attivita_cliente");
    expect(attivita).toEqual({ assegnatari: ["Francesco", "Cliente"], data_fine: "2026-09-10" });

    const [ghl] = await db.esegui<{ calendar_ids: string[]; pipeline_ids: string[] }>("select calendar_ids, pipeline_ids from public.ghl_connessioni");
    expect(ghl).toEqual({ calendar_ids: ["cal-b", "cal-a"], pipeline_ids: [] });

    const [meeting] = await db.esegui<{ dati: unknown }>("select dati from public.meeting_cliente");
    expect(meeting.dati).toEqual({ title: "Allineamento", highlights: ["uno", "due"] });

    const [nuovo] = await db.esegui<{ access_code: string; data_inizio_progetto: string | null; funnels: unknown }>(
      "select access_code, data_inizio_progetto::text, funnels from public.clienti where cliente_id = 'nuovo'"
    );
    expect(nuovo).toEqual({ access_code: "", data_inizio_progetto: null, funnels: [] });

    const [prospect] = await db.esegui<{ calcolatore_budget: unknown; target_cpl: number | null }>("select calcolatore_budget, target_cpl from public.prospect");
    expect(prospect).toEqual({ calcolatore_budget: null, target_cpl: null });
  });

  it("le righe restano nell'ordine del foglio: `posizione` cresce come l'ordine in cui sono state lette", async () => {
    // I due clienti del foglio di prova sono "alc" poi "nuovo": in ordine alfabetico o per chiave
    // sarebbe lo stesso, quindi si controlla sui dati giornalieri, dove la chiave ordinerebbe diversamente.
    const righe = await db.esegui<{ cliente_id: string }>("select cliente_id from public.meta_daily order by posizione");
    expect(righe.map((r) => r.cliente_id)).toEqual(["alc", "nuovo"]);
    const template = await db.esegui<{ posizione: number | string }>("select posizione from public.template_attivita");
    expect(Number(template[0].posizione)).toBe(1);
  });

  it("su un database che ha già dati si ferma, e non tocca nulla", async () => {
    await expect(eseguiCopia(db, foglio())).rejects.toThrow("Il database contiene già dati");
    const [{ n }] = await db.esegui<{ n: number }>("select count(*)::int as n from public.clienti");
    expect(n).toBe(2);
  });

  it("con `sovrascrivi` svuota e riscrive da capo", async () => {
    const dati = foglio();
    dati.clienti = dati.clienti.filter((c) => c.clienteId === "alc");
    dati.metaDaily = dati.metaDaily.filter((r) => r.clienteId === "alc");
    const esito = await eseguiCopia(db, dati, { sovrascrivi: true });
    expect(esito.scritte.clienti).toBe(1);
    expect(esito.scritte.meta_daily).toBe(1);
  });

  it("eliminare un cliente porta via ciò che gli appartiene, ma non lo storico pubblicitario", async () => {
    await db.esegui("delete from public.clienti where cliente_id = 'alc'");
    const conta = async (tabella: string) => (await db.esegui<{ n: number }>(`select count(*)::int as n from public.${tabella}`))[0].n;
    expect(await conta("sedi")).toBe(0);
    expect(await conta("ghl_connessioni")).toBe(0);
    expect(await conta("attivita_cliente")).toBe(0);
    expect(await conta("meeting_cliente")).toBe(0);
    expect(await conta("campagne")).toBe(2);
    expect(await conta("meta_daily")).toBe(1);
  });

  it("due clienti non possono avere lo stesso codice di accesso, ma più clienti possono non averne", async () => {
    await db.esegui("insert into public.clienti (cliente_id, nome, access_code) values ('a', 'A', 'uguale'), ('b', 'B', ''), ('c', 'C', '')");
    await expect(db.esegui("insert into public.clienti (cliente_id, nome, access_code) values ('d', 'D', 'uguale')")).rejects.toThrow();
  });
});
