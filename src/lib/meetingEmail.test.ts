import { describe, expect, it } from "vitest";
import { buildEmailText } from "./meetingEmail";
import type { MeetingDataLoose } from "@/types/meeting";

describe("buildEmailText", () => {
  it("include oggetto con clienteNome e data, saluto, e firma con referente", () => {
    const meeting: MeetingDataLoose = { dataConsulenza: "11/08/2026", referente: "Marco Rebuzzi" };
    const text = buildEmailText(meeting, "Moby");
    expect(text).toContain("Oggetto: Follow-up meeting — Moby 11/08/2026");
    expect(text).toContain("Ciao,");
    expect(text.trim().endsWith("Marco Rebuzzi\nAndrea Lenzi Consulting")).toBe(true);
  });

  it("usa date come fallback quando dataConsulenza è assente", () => {
    const meeting: MeetingDataLoose = { date: "10/08/2026" };
    const text = buildEmailText(meeting, "Moby");
    expect(text).toContain("10/08/2026");
  });

  it("firma con placeholder quando referente è assente", () => {
    const text = buildEmailText({}, "Moby");
    expect(text).toContain("[Il tuo nome]");
  });

  it("omette le sezioni opzionali quando i campi sono assenti", () => {
    const text = buildEmailText({}, "Moby");
    expect(text).not.toContain("In sintesi:");
    expect(text).not.toContain("Punti chiave emersi:");
    expect(text).not.toContain("Next steps:");
    expect(text).not.toContain("Recording completo:");
  });

  it("include summary/highlights/actionItems quando presenti, con formato numerato e assegnatario", () => {
    const meeting: MeetingDataLoose = {
      summary: "Riassunto del meeting.",
      highlights: ["Punto A", "Punto B"],
      actionItems: [{ text: "Preparare il funnel", assignee: "Marco" }, { text: "Rivedere landing" }],
      rawUrl: "https://fathom.video/share/abc",
    };
    const text = buildEmailText(meeting, "Moby");
    expect(text).toContain("In sintesi:\nRiassunto del meeting.");
    expect(text).toContain("• Punto A");
    expect(text).toContain("• Punto B");
    expect(text).toContain("1. Preparare il funnel [Marco]");
    expect(text).toContain("2. Rivedere landing");
    expect(text).not.toContain("2. Rivedere landing [");
    expect(text).toContain("Recording completo: https://fathom.video/share/abc");
  });

  it("clienteNome vuoto -> oggetto senza trattino appeso", () => {
    const text = buildEmailText({}, "");
    expect(text.split("\n")[0]).toBe("Oggetto: Follow-up meeting");
  });
});
