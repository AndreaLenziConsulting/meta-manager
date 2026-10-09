import { describe, expect, it } from "vitest";
import { costruisciSaluteClienti, finestraSalute } from "./saluteClienti";
import type { AttivitaClienteRow, Campagna, Cliente, MetaDailyRow, Sede } from "@/types/kpi";
import type { MeetingClienteRow } from "@/types/meeting";

const cliente = (clienteId: string): Cliente =>
  ({ clienteId, nome: clienteId.toUpperCase(), accessCode: "x", attivo: true, consulenteId: "cons-1", mostraTabExtra: false, prodottoId: "", dataInizioProgetto: null, email: "", logoUrl: "", colorePrimario: "", coloreSecondario: "", fontPersonalizzato: "", driveFolderUrl: "", landingPageUrl: "", appuntamentiFileUrl: "", funnels: [] }) as Cliente;
const sede = (sedeId: string, clienteId: string, targetCpl: number | null): Sede => ({ sedeId, clienteId, nome: sedeId, attivo: true, adAccountId: "1", targetCpa: null, targetCpl }) as Sede;
const campagna = (campaignId: string, clienteId: string, sedeId: string): Campagna => ({ campaignId, clienteId, sedeId, nomeCampagna: campaignId, tipoCampagna: "Lead", stato: "ACTIVE" }) as Campagna;
const giorno = (data: string, clienteId: string, campaignId: string, spesa: number, lead: number): MetaDailyRow => ({ data, clienteId, campaignId, spesa, impressions: 100, clicks: 10, ctr: 0.1, cpc: 1, cpm: 10, lead, clicLink: 8 });
const attivita = (clienteId: string, dataFine: string, stato: AttivitaClienteRow["stato"]): AttivitaClienteRow => ({ attivitaId: `${clienteId}-${dataFine}`, clienteId, prodottoId: "", taskId: dataFine, blocco: "", fase: "", descrizione: "Attività", assegnatari: [], tipo: "", dataInizio: "2026-09-01", dataFine, stato, notaTeam: "", ordine: 0 });

describe("finestraSalute", () => {
  it("sono gli ultimi sette giorni, oggi compreso", () => {
    expect(finestraSalute("2026-10-12")).toEqual({ da: "2026-10-06", a: "2026-10-12" });
    expect(finestraSalute("2026-03-03")).toEqual({ da: "2026-02-25", a: "2026-03-03" });
  });
});

describe("costruisciSaluteClienti", () => {
  const OGGI = "2026-10-12";
  const { da, a } = finestraSalute(OGGI);
  const base = { da, a, oggi: OGGI, meeting: [] as MeetingClienteRow[] };

  it("giudica il costo per lead della settimana contro il target della sede, e somma spesa e lead", () => {
    const [item] = costruisciSaluteClienti({
      ...base,
      clienti: [cliente("alfa")],
      sedi: [sede("alfa--principale", "alfa", 10)],
      campagne: [campagna("c1", "alfa", "alfa--principale")],
      // 300 € e 10 lead nella settimana: 30 € a lead contro un target di 10. Il giorno fuori finestra non conta.
      metaDaily: [giorno("2026-10-07", "alfa", "c1", 200, 6), giorno("2026-10-11", "alfa", "c1", 100, 4), giorno("2026-10-01", "alfa", "c1", 900, 90)],
      attivita: [],
    });
    expect(item.investimento).toBe(300);
    expect(item.numeroLead).toBe(10);
    expect(item.valutazione).toMatchObject({ stato: "interveni", metricaUsata: "lead", valoreAttuale: 30, targetUsato: 10 });
  });

  it("con più sedi vince la peggiore; un cliente senza sedi attive resta senza giudizio", () => {
    const items = costruisciSaluteClienti({
      ...base,
      clienti: [cliente("alfa"), cliente("vuoto")],
      sedi: [sede("alfa--roma", "alfa", 10), sede("alfa--milano", "alfa", 10)],
      campagne: [campagna("c1", "alfa", "alfa--roma"), campagna("c2", "alfa", "alfa--milano")],
      metaDaily: [giorno("2026-10-08", "alfa", "c1", 300, 10), giorno("2026-10-08", "alfa", "c2", 300, 40)],
      attivita: [],
    });
    expect(items[0].sedi.map((s) => s.valutazione.stato)).toEqual(["interveni", "scala"]);
    expect(items[0].valutazione.stato).toBe("interveni");
    expect(items[1]).toMatchObject({ sedi: [], investimento: 0, valutazione: { stato: "no-target" } });
  });

  it("le attività in ritardo sono quelle scadute prima di oggi e non fatte, di quel cliente", () => {
    const [alfa, beta] = costruisciSaluteClienti({
      ...base,
      clienti: [cliente("alfa"), cliente("beta")],
      sedi: [],
      campagne: [],
      metaDaily: [],
      attivita: [attivita("alfa", "2026-10-05", "todo"), attivita("alfa", "2026-10-06", "done"), attivita("alfa", OGGI, "todo"), attivita("beta", "2026-10-01", "blocked")],
    });
    expect(alfa.attivitaInRitardo.map((x) => x.dataFine)).toEqual(["2026-10-05"]);
    expect(beta.attivitaInRitardo).toHaveLength(1);
  });
});
