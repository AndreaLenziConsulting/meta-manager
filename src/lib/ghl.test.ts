import { describe, expect, it } from "vitest";
import { riepilogoAppuntamenti, riepilogoOpportunita } from "./ghl";
import type { GhlAppuntamento, GhlOpportunita } from "@/types/ghl";

function appuntamento(overrides: Partial<GhlAppuntamento> = {}): GhlAppuntamento {
  return {
    id: "a1",
    calendarId: "c1",
    contactId: "ct1",
    title: "Consulenza",
    appointmentStatus: "confirmed",
    startTime: "2026-01-01T10:00:00+01:00",
    endTime: "2026-01-01T10:30:00+01:00",
    dateAdded: "2026-08-05T09:00:00Z",
    deleted: false,
    ...overrides,
  };
}

function opportunita(overrides: Partial<GhlOpportunita> = {}): GhlOpportunita {
  return {
    id: "o1",
    name: "Mario Rossi",
    monetaryValue: 0,
    status: "open",
    source: "Lead Ads",
    contactId: "ct1",
    createdAt: "2026-01-01T10:00:00Z",
    lastStatusChangeAt: "2026-01-01T10:00:00Z",
    ...overrides,
  };
}

const AGOSTO_INIZIO = new Date("2026-08-01T00:00:00Z").getTime();
const AGOSTO_FINE = new Date("2026-08-31T23:59:59Z").getTime();
// Riferimento fisso per "ora" nei test di `effettuati` — mai il vero Date.now(), stesso motivo
// per cui AGOSTO_INIZIO/AGOSTO_FINE sopra sono costanti e non derivate dalla data reale.
const ORA_RIFERIMENTO = new Date("2026-08-27T12:00:00Z").getTime();

describe("riepilogoAppuntamenti", () => {
  it("nessun appuntamento -> tutti zero", () => {
    expect(riepilogoAppuntamenti([], AGOSTO_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO)).toEqual({
      totali: 0,
      confermati: 0,
      annullati: 0,
      effettuati: 0,
    });
  });

  it("conta confermati e annullati separatamente dal totale, per dateAdded nel periodo", () => {
    const lista = [
      appuntamento({ id: "1", appointmentStatus: "confirmed" }),
      appuntamento({ id: "2", appointmentStatus: "confirmed" }),
      appuntamento({ id: "3", appointmentStatus: "cancelled" }),
    ];
    expect(riepilogoAppuntamenti(lista, AGOSTO_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO)).toEqual({
      totali: 3,
      confermati: 2,
      annullati: 1,
      effettuati: 2, // i 2 confermati hanno startTime (1 gennaio) già passato rispetto a ORA_RIFERIMENTO
    });
  });

  it("esclude gli appuntamenti eliminati dal totale (e da effettuati)", () => {
    const lista = [appuntamento({ id: "1", deleted: true }), appuntamento({ id: "2", deleted: false })];
    expect(riepilogoAppuntamenti(lista, AGOSTO_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO)).toEqual({
      totali: 1,
      confermati: 1,
      annullati: 0,
      effettuati: 1,
    });
  });

  it("uno stato diverso da confirmed/cancelled (es. non ancora osservato in produzione) non è né confermato né annullato", () => {
    const lista = [appuntamento({ appointmentStatus: "showed" })];
    expect(riepilogoAppuntamenti(lista, AGOSTO_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO)).toEqual({
      totali: 1,
      confermati: 0,
      annullati: 0,
      effettuati: 1, // non è "cancelled" ed è nel passato -> standard operativo lo conta come effettuato
    });
  });

  it("conta per QUANDO È STATA FATTA LA PRENOTAZIONE (dateAdded), non per quando si tiene l'incontro (startTime)", () => {
    // Prenotato ad agosto per un incontro a ottobre (magari poi riprogrammato): resta "fissato ad agosto".
    const prenotatoAdAgosto = appuntamento({ id: "1", dateAdded: "2026-08-10T00:00:00Z", startTime: "2026-10-01T10:00:00Z" });
    // Prenotato a luglio per un incontro ad agosto: NON è un appuntamento fissato ad agosto.
    const prenotatoALuglio = appuntamento({ id: "2", dateAdded: "2026-07-20T00:00:00Z", startTime: "2026-08-05T10:00:00Z" });
    expect(riepilogoAppuntamenti([prenotatoAdAgosto, prenotatoALuglio], AGOSTO_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO)).toEqual({
      totali: 1,
      confermati: 1,
      annullati: 0,
      effettuati: 0, // l'unico fissato ad agosto ha l'incontro il 1° ottobre: ancora nel futuro, non effettuato
    });
  });

  describe("effettuati — standard operativo: incontro passato (startTime) e mai annullato", () => {
    it("confermato con incontro già passato -> effettuato", () => {
      const lista = [appuntamento({ appointmentStatus: "confirmed", startTime: "2026-08-01T10:00:00Z" })];
      expect(riepilogoAppuntamenti(lista, AGOSTO_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO).effettuati).toBe(1);
    });

    it("confermato ma incontro ancora nel futuro -> NON effettuato", () => {
      const lista = [appuntamento({ appointmentStatus: "confirmed", startTime: "2026-09-01T10:00:00Z" })];
      expect(riepilogoAppuntamenti(lista, AGOSTO_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO).effettuati).toBe(0);
    });

    it("annullato, anche con incontro passato -> mai effettuato", () => {
      const lista = [appuntamento({ appointmentStatus: "cancelled", startTime: "2026-08-01T10:00:00Z" })];
      expect(riepilogoAppuntamenti(lista, AGOSTO_INIZIO, AGOSTO_FINE, ORA_RIFERIMENTO).effettuati).toBe(0);
    });
  });
});

describe("riepilogoOpportunita", () => {
  it("nessuna opportunità -> tutti zero", () => {
    expect(riepilogoOpportunita([], AGOSTO_INIZIO, AGOSTO_FINE)).toEqual({ vendite: 0, fatturato: 0 });
  });

  it("somma il monetaryValue solo delle opportunità vinte NEL PERIODO (per lastStatusChangeAt, non createdAt)", () => {
    const lista = [
      opportunita({ id: "1", status: "won", monetaryValue: 1000, createdAt: "2026-01-01T00:00:00Z", lastStatusChangeAt: "2026-08-05T00:00:00Z" }),
      opportunita({ id: "2", status: "won", monetaryValue: 2500, lastStatusChangeAt: "2026-08-20T00:00:00Z" }),
      opportunita({ id: "3", status: "open", monetaryValue: 9999, lastStatusChangeAt: "2026-08-10T00:00:00Z" }),
      opportunita({ id: "4", status: "lost", monetaryValue: 500, lastStatusChangeAt: "2026-08-10T00:00:00Z" }),
    ];
    // La n.1 è stata CREATA a gennaio ma VINTA ad agosto: deve comunque contare come vendita di agosto.
    expect(riepilogoOpportunita(lista, AGOSTO_INIZIO, AGOSTO_FINE)).toEqual({ vendite: 2, fatturato: 3500 });
  });

  it("esclude un'opportunità vinta fuori dal periodo anche se creata dentro", () => {
    const lista = [opportunita({ status: "won", monetaryValue: 1000, createdAt: "2026-08-01T00:00:00Z", lastStatusChangeAt: "2026-09-15T00:00:00Z" })];
    expect(riepilogoOpportunita(lista, AGOSTO_INIZIO, AGOSTO_FINE)).toEqual({ vendite: 0, fatturato: 0 });
  });
});
