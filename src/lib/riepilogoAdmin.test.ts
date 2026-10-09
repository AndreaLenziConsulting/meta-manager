import { describe, expect, it } from "vitest";
import type { SaluteClienteItem } from "./dashboardAdmin";
import { componiRiepilogoAdmin, vociDaGuardare } from "./riepilogoAdmin";
import type { AttivitaClienteRow, Cliente, Sede } from "@/types/kpi";

const OGGI = "2026-10-12";
const APP = "https://app.esempio.it";
const CONSULENTI = [{ consulenteId: "cons-1", nome: "Eliano" }];

function cliente(over: Partial<Cliente>): Cliente {
  return {
    clienteId: "c", nome: "Cliente", accessCode: "x", attivo: true,
    consulenteId: "cons-1", mostraTabExtra: false,
    prodottoId: "", dataInizioProgetto: null, email: "",
    logoUrl: "", colorePrimario: "", coloreSecondario: "", fontPersonalizzato: "",
    driveFolderUrl: "", landingPageUrl: "", appuntamentiFileUrl: "", funnels: [], ...over,
  };
}

function attivita(descrizione: string, dataFine: string): AttivitaClienteRow {
  return {
    attivitaId: descrizione, clienteId: "c", prodottoId: "gtm", taskId: descrizione, blocco: "setup",
    fase: "Fase", descrizione, assegnatari: [], tipo: "", dataInizio: "2026-09-01",
    dataFine, stato: "todo", notaTeam: "", ordine: 0,
  };
}

const sede = (nome: string): Sede => ({ sedeId: nome.toLowerCase(), clienteId: "c", nome, attivo: true }) as Sede;
const BUONA = { stato: "mantieni" as const, metricaUsata: "lead" as const, valoreAttuale: 8, targetUsato: 8 };
const FUORI = { stato: "interveni" as const, metricaUsata: "lead" as const, valoreAttuale: 12.4, targetUsato: 8 };

function item(over: Partial<SaluteClienteItem>): SaluteClienteItem {
  return {
    cliente: cliente({}),
    sedi: [],
    investimento: 0,
    numeroLead: 0,
    valutazione: { stato: "no-target", metricaUsata: null, valoreAttuale: null, targetUsato: null },
    attivitaInRitardo: [],
    sentimentCritico: false,
    ...over,
  };
}

const voci = (items: SaluteClienteItem[]) => vociDaGuardare({ items, consulenti: CONSULENTI, oggi: OGGI, indirizzoApp: APP });

describe("chi richiede attenzione", () => {
  it("solo chi ha il costo oltre il target, attività in ritardo o il clima negativo", () => {
    const esito = voci([
      item({ cliente: cliente({ clienteId: "ok", nome: "Tutto bene" }), valutazione: BUONA }),
      item({ cliente: cliente({ clienteId: "ads", nome: "Ads" }), valutazione: FUORI, sedi: [{ sede: sede("Principale"), investimento: 100, numeroLead: 8, valutazione: FUORI }] }),
      item({ cliente: cliente({ clienteId: "lavori", nome: "Lavori" }), attivitaInRitardo: [attivita("Landing", "2026-10-02")] }),
      item({ cliente: cliente({ clienteId: "clima", nome: "Clima" }), sentimentCritico: true }),
    ]);
    expect(esito.map((v) => v.clienteId)).toEqual(["ads", "lavori", "clima"]);
  });

  it("dice il costo e il target, e con più sedi di quale sede parla", () => {
    const unaSede = voci([item({ valutazione: FUORI, sedi: [{ sede: sede("Principale"), investimento: 100, numeroLead: 8, valutazione: FUORI }] })]);
    expect(unaSede[0].motivi).toEqual(["Costo per lead €12,40 contro un target di €8,00"]);

    const dueSedi = voci([
      item({
        valutazione: FUORI,
        sedi: [
          { sede: sede("Roma"), investimento: 100, numeroLead: 8, valutazione: FUORI },
          { sede: sede("Milano"), investimento: 100, numeroLead: 12, valutazione: BUONA },
        ],
      }),
    ]);
    expect(dueSedi[0].motivi).toEqual(["Roma: Costo per lead €12,40 contro un target di €8,00"]);
  });

  it("elenca le tre attività più in ritardo coi giorni di ritardo, e conta le altre", () => {
    const inRitardo = [attivita("Prima", "2026-09-22"), attivita("Seconda", "2026-10-01"), attivita("Terza", "2026-10-10"), attivita("Quarta", "2026-10-11"), attivita("Quinta", "2026-10-11")];
    const [voce] = voci([item({ attivitaInRitardo: inRitardo })]);
    expect(voce.motivi).toEqual(["5 attività in ritardo"]);
    expect(voce.attivita).toEqual([
      { descrizione: "Prima", giorniDiRitardo: 20 },
      { descrizione: "Seconda", giorniDiRitardo: 11 },
      { descrizione: "Terza", giorniDiRitardo: 2 },
    ]);
    expect(voce.altreAttivita).toBe(2);
  });

  it("mette insieme più ragioni per lo stesso cliente, col consulente e il link alla sua scheda", () => {
    const [voce] = voci([
      item({
        cliente: cliente({ clienteId: "hygge casa", nome: "Hygge Casa" }),
        valutazione: FUORI,
        sedi: [{ sede: sede("Principale"), investimento: 100, numeroLead: 8, valutazione: FUORI }],
        attivitaInRitardo: [attivita("Landing", "2026-10-11")],
        sentimentCritico: true,
      }),
    ]);
    expect(voce.motivi).toEqual(["Costo per lead €12,40 contro un target di €8,00", "1 attività in ritardo", "Clima degli incontri negativo: cliente a rischio"]);
    expect(voce.consulente).toBe("Eliano");
    expect(voce.link).toBe("https://app.esempio.it/dashboard/cliente/hygge%20casa");
  });

  it("un cliente senza consulente fra quelli noti lo dice, invece di restare senza nome", () => {
    expect(voci([item({ cliente: cliente({ consulenteId: "andato-via" }), sentimentCritico: true })])[0].consulente).toBe("nessun consulente assegnato");
  });

  it("prima chi ha sia le ads fuori target sia attività in ritardo, come nella pagina Clienti", () => {
    const esito = voci([
      item({ cliente: cliente({ clienteId: "solo-lavori", nome: "B" }), attivitaInRitardo: [attivita("x", "2026-10-01")] }),
      item({ cliente: cliente({ clienteId: "tutti-e-due", nome: "Z" }), valutazione: FUORI, attivitaInRitardo: [attivita("y", "2026-10-01")] }),
      item({ cliente: cliente({ clienteId: "solo-ads", nome: "A" }), valutazione: FUORI }),
    ]);
    expect(esito.map((v) => v.clienteId)).toEqual(["tutti-e-due", "solo-ads", "solo-lavori"]);
  });
});

describe("l'email", () => {
  const base = { datiFermi: [], clientiValutati: 24, da: "2026-10-06", a: OGGI, oggi: OGGI, indirizzoApp: APP };
  const unaVoce = voci([item({ cliente: cliente({ clienteId: "hygge", nome: "Hygge & Casa <srl>" }), attivitaInRitardo: [attivita("Rifare la <landing>", "2026-10-10")] })]);

  it("l'oggetto dice quanti clienti sono da guardare e su quanti", () => {
    expect(componiRiepilogoAdmin({ ...base, voci: unaVoce }).oggetto).toBe("Clienti da guardare: 1 su 24 (12 ott 2026)");
    expect(componiRiepilogoAdmin({ ...base, voci: [] }).oggetto).toBe("Clienti: nessuno richiede attenzione (12 ott 2026)");
  });

  it("senza nulla da segnalare parte lo stesso, e lo dice", () => {
    const vuoto = componiRiepilogoAdmin({ ...base, voci: [] });
    expect(vuoto.clientiDaGuardare).toBe(0);
    expect(vuoto.testo).toContain("Nessuno dei 24 clienti attivi richiede attenzione");
    expect(vuoto.html).toContain("Nessun cliente richiede attenzione");
  });

  it("il testo semplice riporta cliente, consulente, ragioni, attività e link", () => {
    const { testo } = componiRiepilogoAdmin({ ...base, voci: unaVoce });
    expect(testo).toContain("1 cliente richiede attenzione, su 24 attivi.");
    expect(testo).toContain("Hygge & Casa <srl> — Eliano");
    expect(testo).toContain("- 1 attività in ritardo");
    expect(testo).toContain("· Rifare la <landing> (scaduta da 2 giorni)");
    expect(testo).toContain("https://app.esempio.it/dashboard/cliente/hygge");
    expect(testo).toContain("(6 ott 2026 – 12 ott 2026)");
  });

  it("nell'html i nomi scritti dalle persone non diventano codice", () => {
    const { html } = componiRiepilogoAdmin({ ...base, voci: unaVoce });
    expect(html).toContain("Hygge &amp; Casa &lt;srl&gt;");
    expect(html).toContain("Rifare la &lt;landing&gt;");
    expect(html).not.toContain("<srl>");
    expect(html).toContain('href="https://app.esempio.it/dashboard/cliente/hygge"');
  });

  it("i dati Meta fermi stanno in testa, anche quando nessun cliente è da guardare", () => {
    const datiFermi = [
      { nomeCliente: "Agricobots", nomeSede: "Spagna", ultimoGiorno: "2026-10-05", causa: "sincronizzazione" as const },
      { nomeCliente: "Nuovo", nomeSede: null, ultimoGiorno: null, causa: "accesso" as const },
    ];
    const esito = componiRiepilogoAdmin({ ...base, voci: [], datiFermi });
    expect(esito.oggetto).toBe("Clienti: nessuno da guardare, ma dati Meta fermi (12 ott 2026)");
    expect(esito.datiFermi).toBe(2);
    expect(esito.testo).toContain("- Agricobots (Spagna): dati fermi al 5 ott 2026 — su Meta c'è spesa che in app non è arrivata");
    expect(esito.testo).toContain("- Nuovo: dati fermi da sempre — Meta rifiuta la lettura: va controllato l'accesso");
    expect(esito.html).toContain("Dati Meta fermi");
  });
});
