import { describe, expect, it } from "vitest";
import { sentimentCritico, ultimoMeetingPerCliente } from "./sentimentCliente";
import type { MeetingClienteRow } from "@/types/meeting";

function meeting(over: Partial<MeetingClienteRow>): MeetingClienteRow {
  return {
    meetingId: "m1", clienteId: "c1", data: "2026-09-01", titolo: "Call",
    sentiment: "", aggiornatoIl: "2026-09-01T10:00:00Z", dati: {}, ...over,
  };
}

describe("sentimentCritico", () => {
  it("riconosce 'Negativo' seguito da una giustificazione", () => {
    expect(sentimentCritico("Negativo — il cliente si aspettava risultati migliori")).toBe(true);
  });

  it("case insensitive e con spazi iniziali", () => {
    expect(sentimentCritico("  negativo, cliente preoccupato")).toBe(true);
  });

  it("non scambia 'positivo'/'neutro' per negativo", () => {
    expect(sentimentCritico("Positivo — cliente molto contento")).toBe(false);
    expect(sentimentCritico("Neutro, nessuna criticità particolare")).toBe(false);
  });

  it("stringa vuota o senza il pattern atteso -> non critico (falso negativo preferibile)", () => {
    expect(sentimentCritico("")).toBe(false);
    expect(sentimentCritico("Il cliente ha menzionato che il budget è negativo quest'anno")).toBe(false);
  });
});

describe("ultimoMeetingPerCliente", () => {
  it("prende il meeting più recente per data, per ciascun cliente", () => {
    const meetings = [
      meeting({ clienteId: "a", data: "2026-08-01", sentiment: "Positivo" }),
      meeting({ clienteId: "a", data: "2026-09-01", sentiment: "Negativo — insoddisfatto" }),
      meeting({ clienteId: "b", data: "2026-09-05", sentiment: "Neutro" }),
    ];
    const ultimo = ultimoMeetingPerCliente(meetings);
    expect(ultimo.get("a")?.data).toBe("2026-09-01");
    expect(ultimo.get("a")?.sentiment).toBe("Negativo — insoddisfatto");
    expect(ultimo.get("b")?.data).toBe("2026-09-05");
  });

  it("array vuoto -> mappa vuota, mai un errore", () => {
    expect(ultimoMeetingPerCliente([]).size).toBe(0);
  });

  it("clienti diversi restano indipendenti", () => {
    const ultimo = ultimoMeetingPerCliente([meeting({ clienteId: "x" }), meeting({ clienteId: "y" })]);
    expect(ultimo.size).toBe(2);
  });
});
