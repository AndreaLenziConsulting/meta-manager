import { describe, expect, it } from "vitest";
import { andamentoSentiment, classificaSentiment, raggruppaMeetingPerCliente, sentimentCritico } from "./sentimentCliente";
import type { MeetingClienteRow } from "@/types/meeting";

function meeting(over: Partial<MeetingClienteRow>): MeetingClienteRow {
  return {
    meetingId: "m1", clienteId: "c1", data: "2026-09-01", titolo: "Call",
    sentiment: "", aggiornatoIl: "2026-09-01T10:00:00Z", dati: {}, ...over,
  };
}

describe("classificaSentiment", () => {
  it("riconosce i tre stati attesi, case insensitive e con spazi iniziali", () => {
    expect(classificaSentiment("Positivo — cliente molto contento")).toBe("positivo");
    expect(classificaSentiment("  neutro, nessuna criticità")).toBe("neutro");
    expect(classificaSentiment("NEGATIVO — insoddisfatto")).toBe("negativo");
  });

  it("stringa vuota o senza il pattern atteso -> sconosciuto, mai indovinato", () => {
    expect(classificaSentiment("")).toBe("sconosciuto");
    expect(classificaSentiment("Il cliente ha menzionato che il budget è negativo quest'anno")).toBe("sconosciuto");
  });
});

describe("sentimentCritico", () => {
  it("true solo per 'negativo'", () => {
    expect(sentimentCritico("Negativo — il cliente si aspettava risultati migliori")).toBe(true);
    expect(sentimentCritico("Positivo — cliente molto contento")).toBe(false);
    expect(sentimentCritico("")).toBe(false);
  });
});

describe("raggruppaMeetingPerCliente", () => {
  it("raggruppa i meeting di più clienti mescolati", () => {
    const mappa = raggruppaMeetingPerCliente([
      meeting({ meetingId: "a", clienteId: "cliente-1" }),
      meeting({ meetingId: "b", clienteId: "cliente-2" }),
      meeting({ meetingId: "c", clienteId: "cliente-1" }),
    ]);
    expect(mappa.get("cliente-1")?.map((m) => m.meetingId)).toEqual(["a", "c"]);
    expect(mappa.get("cliente-2")?.map((m) => m.meetingId)).toEqual(["b"]);
  });

  it("array vuoto -> mappa vuota", () => {
    expect(raggruppaMeetingPerCliente([]).size).toBe(0);
  });
});

describe("andamentoSentiment", () => {
  it("serie in ordine cronologico (più vecchio prima), indipendentemente dall'ordine di input", () => {
    const risultato = andamentoSentiment([
      meeting({ meetingId: "recente", data: "2026-09-01", sentiment: "Positivo" }),
      meeting({ meetingId: "vecchio", data: "2026-07-01", sentiment: "Neutro" }),
    ]);
    expect(risultato.serie.map((p) => p.meetingId)).toEqual(["vecchio", "recente"]);
    expect(risultato.serie.map((p) => p.stato)).toEqual(["neutro", "positivo"]);
  });

  it("un solo meeting negativo in tutto lo storico -> a rischio (unico segnale disponibile)", () => {
    expect(andamentoSentiment([meeting({ sentiment: "Negativo — insoddisfatto" })]).aRischio).toBe(true);
  });

  it("un solo meeting positivo/neutro -> non a rischio", () => {
    expect(andamentoSentiment([meeting({ sentiment: "Positivo" })]).aRischio).toBe(false);
  });

  it("ultimi 2 meeting entrambi negativi -> a rischio, anche con storico più vecchio positivo", () => {
    const risultato = andamentoSentiment([
      meeting({ meetingId: "1", data: "2026-07-01", sentiment: "Positivo" }),
      meeting({ meetingId: "2", data: "2026-08-01", sentiment: "Negativo" }),
      meeting({ meetingId: "3", data: "2026-09-01", sentiment: "Negativo" }),
    ]);
    expect(risultato.aRischio).toBe(true);
  });

  it("un solo negativo tra gli ultimi due -> NON a rischio (evita di segnalare un singolo giudizio isolato come tendenza)", () => {
    const risultato = andamentoSentiment([
      meeting({ meetingId: "1", data: "2026-08-01", sentiment: "Negativo" }),
      meeting({ meetingId: "2", data: "2026-09-01", sentiment: "Positivo" }),
    ]);
    expect(risultato.aRischio).toBe(false);
  });

  it("nessun meeting -> serie vuota, non a rischio", () => {
    const risultato = andamentoSentiment([]);
    expect(risultato.serie).toEqual([]);
    expect(risultato.aRischio).toBe(false);
  });
});
