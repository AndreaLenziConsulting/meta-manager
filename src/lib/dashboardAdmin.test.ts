import { describe, expect, it } from "vitest";
import { calcolaRiepilogo, ordinaPerPriorita, type SaluteClienteItem } from "./dashboardAdmin";
import type { AttivitaClienteRow, Cliente } from "@/types/kpi";

function cliente(over: Partial<Cliente>): Cliente {
  return {
    clienteId: "c", nome: "Cliente", accessCode: "x", attivo: true,
    consulenteId: "cons-1", mostraTabExtra: false,
    prodottoId: "", dataInizioProgetto: null, email: "", ...over,
  };
}

function attivitaFittizia(n: number): AttivitaClienteRow[] {
  return Array.from({ length: n }, (_, i) => ({
    attivitaId: `a${i}`, clienteId: "c", prodottoId: "gtm", taskId: `T${i}`, blocco: "setup",
    fase: "Fase", descrizione: "", responsabile: "", tipo: "", dataInizio: "2026-01-01",
    dataFine: "2026-01-02", stato: "todo" as const, notaTeam: "", ordine: i,
  }));
}

function item(over: Partial<SaluteClienteItem>): SaluteClienteItem {
  return {
    cliente: cliente({ clienteId: over.cliente?.clienteId ?? "c" }),
    sedi: [],
    investimento: 0,
    numeroLead: 0,
    valutazione: { stato: "no-target", metricaUsata: null, valoreAttuale: null, targetUsato: null },
    attivitaInRitardo: [],
    ...over,
  };
}

describe("calcolaRiepilogo", () => {
  it("conta clienti con ads critiche, clienti con attività in ritardo e il totale attività in ritardo", () => {
    const items = [
      item({ cliente: cliente({ clienteId: "a" }), valutazione: { stato: "interveni", metricaUsata: "lead", valoreAttuale: 10, targetUsato: 5 } }),
      item({ cliente: cliente({ clienteId: "b" }), attivitaInRitardo: attivitaFittizia(3) }),
      item({ cliente: cliente({ clienteId: "c" }), valutazione: { stato: "scala", metricaUsata: "lead", valoreAttuale: 1, targetUsato: 5 } }),
    ];
    expect(calcolaRiepilogo(items)).toEqual({
      clientiAdsCritici: 1,
      clientiConAttivitaInRitardo: 1,
      totaleAttivitaInRitardo: 3,
    });
  });

  it("array vuoto -> tutti zero", () => {
    expect(calcolaRiepilogo([])).toEqual({ clientiAdsCritici: 0, clientiConAttivitaInRitardo: 0, totaleAttivitaInRitardo: 0 });
  });
});

describe("ordinaPerPriorita", () => {
  it("ordina: entrambi i problemi, poi solo ads critiche, poi solo ritardo (più attività prima), poi il resto per severità ads", () => {
    const entrambi = item({
      cliente: cliente({ clienteId: "entrambi" }),
      valutazione: { stato: "interveni", metricaUsata: "lead", valoreAttuale: 10, targetUsato: 5 },
      attivitaInRitardo: attivitaFittizia(1),
    });
    const soloAds = item({
      cliente: cliente({ clienteId: "solo-ads" }),
      valutazione: { stato: "interveni", metricaUsata: "lead", valoreAttuale: 10, targetUsato: 5 },
    });
    const soloRitardoTanto = item({ cliente: cliente({ clienteId: "solo-ritardo-tanto" }), attivitaInRitardo: attivitaFittizia(5) });
    const soloRitardoPoco = item({ cliente: cliente({ clienteId: "solo-ritardo-poco" }), attivitaInRitardo: attivitaFittizia(1) });
    const mantieni = item({ cliente: cliente({ clienteId: "mantieni" }), valutazione: { stato: "mantieni", metricaUsata: "lead", valoreAttuale: 5, targetUsato: 5 } });
    const scala = item({ cliente: cliente({ clienteId: "scala" }), valutazione: { stato: "scala", metricaUsata: "lead", valoreAttuale: 1, targetUsato: 5 } });

    // Input volutamente in ordine "sbagliato" per verificare che l'ordinamento non dipenda dall'input.
    const input = [scala, soloRitardoPoco, mantieni, soloAds, soloRitardoTanto, entrambi];
    const risultato = ordinaPerPriorita(input);

    expect(risultato.map((i) => i.cliente.clienteId)).toEqual([
      "entrambi", "solo-ads", "solo-ritardo-tanto", "solo-ritardo-poco", "mantieni", "scala",
    ]);
  });

  it("non muta l'array in input", () => {
    const a = item({ cliente: cliente({ clienteId: "a" }), valutazione: { stato: "scala", metricaUsata: "lead", valoreAttuale: 1, targetUsato: 5 } });
    const b = item({ cliente: cliente({ clienteId: "b" }), valutazione: { stato: "interveni", metricaUsata: "lead", valoreAttuale: 10, targetUsato: 5 } });
    const input = [a, b];
    ordinaPerPriorita(input);
    expect(input).toEqual([a, b]); // ordine originale intatto
  });
});
