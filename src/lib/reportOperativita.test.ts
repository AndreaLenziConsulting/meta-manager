import { describe, expect, it } from "vitest";
import { buildReportOperativitaRow, nowTimestamp } from "./reportOperativita";
import type { MeetingDataLoose } from "@/types/meeting";

describe("nowTimestamp", () => {
  it("formatta DD/MM/YYYY HH.MM.SS con zero-padding", () => {
    expect(nowTimestamp(new Date(2026, 7, 5, 9, 3, 7))).toBe("05/08/2026 09.03.07");
  });

  it("non fa zero-padding sull'anno, anche se corto/insolito", () => {
    expect(nowTimestamp(new Date(999, 0, 1, 0, 0, 0))).toBe("01/01/999 00.00.00");
  });
});

describe("buildReportOperativitaRow", () => {
  it("produce le 12 colonne nell'ordine atteso, con dataConsulenza prioritaria su date", () => {
    const meeting: MeetingDataLoose = {
      date: "10/08/2026",
      dataConsulenza: "11/08/2026",
      referente: "Marco Rebuzzi",
      taskSettimana: "Marco: preparare il funnel",
      taskMese: "Obiettivo 5 vendite",
      programmaTrimestre: "Lancio Q3",
      sentiment: "Positivo",
      kpiReali: "CPL 3,20€",
      kpiStorico: "CPL 4,00€",
      kpiTargetMarketing: "CPL < 3€",
      kpiTargetCommerciali: "5 vendite/mese",
    };
    expect(buildReportOperativitaRow("Moby", meeting, "05/08/2026 09.03.07")).toEqual([
      "05/08/2026 09.03.07",
      "Moby",
      "Marco Rebuzzi",
      "11/08/2026",
      "Marco: preparare il funnel",
      "Obiettivo 5 vendite",
      "Lancio Q3",
      "Positivo",
      "CPL 3,20€",
      "CPL 4,00€",
      "CPL < 3€",
      "5 vendite/mese",
    ]);
  });

  it("usa date come fallback quando dataConsulenza è assente", () => {
    const meeting: MeetingDataLoose = { date: "10/08/2026" };
    const row = buildReportOperativitaRow("Moby", meeting, "ts");
    expect(row[3]).toBe("10/08/2026");
  });

  it("default a stringa vuota su tutti i campi opzionali mancanti", () => {
    const row = buildReportOperativitaRow("Moby", {}, "ts");
    expect(row).toEqual(["ts", "Moby", "", "", "", "", "", "", "", "", "", ""]);
  });

  it("usa sempre clienteNome esplicito, mai meeting.cliente", () => {
    const meeting: MeetingDataLoose = { cliente: "Nome sbagliato dedotto dall'LLM" };
    const row = buildReportOperativitaRow("Moby", meeting, "ts");
    expect(row[1]).toBe("Moby");
    expect(row).not.toContain("Nome sbagliato dedotto dall'LLM");
  });
});
