import { describe, expect, it } from "vitest";
import { clientiVisibili, puoVedereCliente } from "./authz";
import type { Cliente, Sessione } from "@/types/kpi";

function cliente(over: Partial<Cliente>): Cliente {
  return {
    clienteId: "c", nome: "Cliente", adAccountId: "1", accessCode: "x", attivo: true,
    consulenteId: "cons-1", targetCpa: null, targetCpl: null, mostraTabExtra: false,
    prodottoId: "", dataInizioProgetto: null, tipoConversioneLead: "", email: "", ...over,
  };
}

const CLIENTI: Cliente[] = [
  cliente({ clienteId: "a", consulenteId: "cons-1", attivo: true }),
  cliente({ clienteId: "b", consulenteId: "cons-2", attivo: true }),
  cliente({ clienteId: "c-inattivo", consulenteId: "cons-1", attivo: false }),
];

describe("clientiVisibili", () => {
  it("admin vede tutti i clienti attivi, di qualunque consulente", () => {
    const sessione: Sessione = { ruolo: "admin" };
    const visibili = clientiVisibili(sessione, CLIENTI);
    expect(visibili.map((c) => c.clienteId)).toEqual(["a", "b"]);
  });

  it("consulente vede solo i propri clienti attivi", () => {
    const sessione: Sessione = { ruolo: "consulente", consulenteId: "cons-1" };
    const visibili = clientiVisibili(sessione, CLIENTI);
    expect(visibili.map((c) => c.clienteId)).toEqual(["a"]);
  });

  it("un cliente inattivo non è mai visibile, nemmeno al proprio consulente", () => {
    const sessione: Sessione = { ruolo: "consulente", consulenteId: "cons-1" };
    const visibili = clientiVisibili(sessione, CLIENTI);
    expect(visibili.some((c) => c.clienteId === "c-inattivo")).toBe(false);
  });

  it("consulente senza clienti assegnati -> lista vuota, non un errore", () => {
    const sessione: Sessione = { ruolo: "consulente", consulenteId: "cons-senza-clienti" };
    expect(clientiVisibili(sessione, CLIENTI)).toEqual([]);
  });
});

describe("puoVedereCliente", () => {
  it("admin può vedere qualunque cliente attivo", () => {
    expect(puoVedereCliente({ ruolo: "admin" }, "b", CLIENTI)).toBe(true);
  });

  it("consulente può vedere un proprio cliente", () => {
    expect(puoVedereCliente({ ruolo: "consulente", consulenteId: "cons-1" }, "a", CLIENTI)).toBe(true);
  });

  it("consulente non può vedere un cliente di un altro consulente", () => {
    expect(puoVedereCliente({ ruolo: "consulente", consulenteId: "cons-1" }, "b", CLIENTI)).toBe(false);
  });

  it("nessuno può vedere un cliente inattivo, nemmeno il proprio consulente", () => {
    expect(puoVedereCliente({ ruolo: "consulente", consulenteId: "cons-1" }, "c-inattivo", CLIENTI)).toBe(false);
  });

  it("clienteId inesistente -> false, non un errore", () => {
    expect(puoVedereCliente({ ruolo: "admin" }, "non-esiste", CLIENTI)).toBe(false);
  });
});
