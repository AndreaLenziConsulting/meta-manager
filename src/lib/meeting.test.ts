import { describe, expect, it } from "vitest";
import {
  campiVisibiliCliente,
  dataItalianaAIso,
  generaAttivitaDaMeeting,
  hashMeetingId,
  scadenzaTask,
} from "./meeting";
import type { MeetingDataLoose } from "@/types/meeting";

describe("dataItalianaAIso", () => {
  it("converte DD/MM/YYYY in ISO", () => {
    expect(dataItalianaAIso("11/08/2026")).toBe("2026-08-11");
  });

  it("tollera giorno/mese senza zero-padding (l'LLM a monte non è garantito)", () => {
    expect(dataItalianaAIso("1/8/2026")).toBe("2026-08-01");
  });

  it("rifiuta date che non esistono (es. 31 febbraio), non le normalizza silenziosamente", () => {
    expect(dataItalianaAIso("31/02/2026")).toBeNull();
  });

  it("rifiuta mese/giorno fuori range e formati diversi da DD/MM/YYYY", () => {
    expect(dataItalianaAIso("32/13/2026")).toBeNull();
    expect(dataItalianaAIso("2026-08-11")).toBeNull();
    expect(dataItalianaAIso("11-08-2026")).toBeNull();
  });

  it("input vuoto/assente -> null, mai un throw", () => {
    expect(dataItalianaAIso("")).toBeNull();
    expect(dataItalianaAIso(undefined)).toBeNull();
  });
});

describe("scadenzaTask", () => {
  it("aggiunge 7 giorni", () => {
    expect(scadenzaTask("2026-08-11")).toBe("2026-08-18");
  });

  it("attraversa correttamente un cambio di mese/anno", () => {
    expect(scadenzaTask("2026-12-28")).toBe("2027-01-04");
  });
});

describe("hashMeetingId", () => {
  it("è deterministico: stesso cliente+url -> stesso id", () => {
    const a = hashMeetingId("alc-01", "https://fathom.video/share/abc123");
    const b = hashMeetingId("alc-01", "https://fathom.video/share/abc123");
    expect(a).toBe(b);
  });

  it("url diverso -> id diverso", () => {
    const a = hashMeetingId("alc-01", "https://fathom.video/share/abc123");
    const b = hashMeetingId("alc-01", "https://fathom.video/share/xyz789");
    expect(a).not.toBe(b);
  });

  it("cliente diverso, stesso url -> id diverso (namespacing per cliente)", () => {
    const a = hashMeetingId("alc-01", "https://fathom.video/share/abc123");
    const b = hashMeetingId("alc-02", "https://fathom.video/share/abc123");
    expect(a).not.toBe(b);
  });

  it("inizia con il clienteId, leggibile a colpo d'occhio sul foglio", () => {
    expect(hashMeetingId("alc-01", "https://fathom.video/share/abc123")).toMatch(/^alc-01::[0-9a-f]{8}$/);
  });
});

describe("generaAttivitaDaMeeting", () => {
  const actionItems = [
    { text: "Inviare il catalogo aggiornato", assignee: "Mario Rossi" },
    { text: "Richiamare il fornitore per i tempi di consegna" }, // senza assignee
  ];

  it("una riga per action item, con id/date/assignee corretti", () => {
    const righe = generaAttivitaDaMeeting("alc-01", "alc-01::abc12345", "2026-08-11", "Call mensile", actionItems);
    expect(righe).toHaveLength(2);

    expect(righe[0].attivitaId).toBe("alc-01::m-alc-01::abc12345-0");
    expect(righe[0].clienteId).toBe("alc-01");
    expect(righe[0].prodottoId).toBe("meeting");
    expect(righe[0].descrizione).toBe("Inviare il catalogo aggiornato");
    expect(righe[0].responsabile).toBe("Mario Rossi");
    expect(righe[0].dataInizio).toBe("2026-08-11");
    expect(righe[0].dataFine).toBe("2026-08-18");
    expect(righe[0].stato).toBe("todo");
    expect(righe[0].fase).toBe("Meeting: Call mensile (11 ago 2026)");
  });

  it("assignee mancante -> 'Da assegnare', mai una stringa vuota", () => {
    const righe = generaAttivitaDaMeeting("alc-01", "m1", "2026-08-11", "Call", actionItems);
    expect(righe[1].responsabile).toBe("Da assegnare");
  });

  it("ordine cronologico crescente con l'indice, sempre più grande di un template prodotto", () => {
    const righe = generaAttivitaDaMeeting("alc-01", "m1", "2026-08-11", "Call", actionItems);
    expect(righe[1].ordine).toBeGreaterThan(righe[0].ordine);
    expect(righe[0].ordine).toBeGreaterThan(1000); // ordine dei template prodotto sono piccoli interi (1..55)
  });

  it("due meeting con date diverse hanno ordine coerente con la cronologia", () => {
    const primo = generaAttivitaDaMeeting("alc-01", "m1", "2026-08-11", "Call 1", [actionItems[0]]);
    const secondo = generaAttivitaDaMeeting("alc-01", "m2", "2026-09-01", "Call 2", [actionItems[0]]);
    expect(secondo[0].ordine).toBeGreaterThan(primo[0].ordine);
  });

  it("nessun action item -> nessuna riga, non un errore", () => {
    expect(generaAttivitaDaMeeting("alc-01", "m1", "2026-08-11", "Call", [])).toEqual([]);
  });
});

describe("campiVisibiliCliente", () => {
  const meetingCompleto: MeetingDataLoose = {
    title: "Call mensile",
    date: "11/08/2026",
    duration: "45 min",
    participants: ["Mario Rossi", "Giulia Bianchi"],
    summary: "Rivisti i numeri del mese, tutto in linea con gli obiettivi.",
    highlights: ["CPL sotto target", "Show-up rate in crescita"],
    actionItems: [{ text: "Inviare il report", assignee: "Giulia" }],
    rawUrl: "https://fathom.video/share/segreto-non-condivisibile",
    cliente: "Mobilieri Bianchi",
    referente: "Andrea Lenzi",
    dataConsulenza: "11/08/2026",
    taskSettimana: "Chiamare 20 lead entro venerdì",
    taskMese: "Lanciare la nuova offerta",
    programmaTrimestre: "Scalare il budget del 30%",
    sentiment: "Preoccupato — il cliente ha espresso dubbi sul ritorno dell'investimento",
    kpiReali: "CPL 12€, 40 lead",
    kpiStorico: "CPL medio storico 15€",
    kpiTargetMarketing: "CPL target 10€",
    kpiTargetCommerciali: "Tasso di chiusura target 20%",
  };

  it("include solo i campi della whitelist", () => {
    const vista = campiVisibiliCliente("alc-01::abc12345", "2026-08-11", meetingCompleto);
    expect(vista).toEqual({
      meetingId: "alc-01::abc12345",
      titolo: "Call mensile",
      data: "2026-08-11",
      durata: "45 min",
      partecipanti: ["Mario Rossi", "Giulia Bianchi"],
      riassunto: "Rivisti i numeri del mese, tutto in linea con gli obiettivi.",
      azioni: [{ testo: "Inviare il report", assegnatario: "Giulia" }],
    });
  });

  it("nessun campo interno trapela, nemmeno come valore annidato/concatenato", () => {
    const vista = campiVisibiliCliente("alc-01::abc12345", "2026-08-11", meetingCompleto);
    const serializzato = JSON.stringify(vista);
    const campiInterni = [
      meetingCompleto.sentiment,
      meetingCompleto.referente,
      meetingCompleto.dataConsulenza,
      meetingCompleto.taskSettimana,
      meetingCompleto.taskMese,
      meetingCompleto.programmaTrimestre,
      meetingCompleto.kpiReali,
      meetingCompleto.kpiStorico,
      meetingCompleto.kpiTargetMarketing,
      meetingCompleto.kpiTargetCommerciali,
      meetingCompleto.rawUrl,
      meetingCompleto.cliente,
    ];
    for (const valore of campiInterni) {
      expect(serializzato).not.toContain(valore as string);
    }
  });

  it("campi mancanti (template che cambia) -> default sensati, nessun crash", () => {
    const vista = campiVisibiliCliente("m1", "2026-08-11", {});
    expect(vista).toEqual({
      meetingId: "m1",
      titolo: "",
      data: "2026-08-11",
      durata: undefined,
      partecipanti: [],
      riassunto: "",
      azioni: [],
    });
  });
});
