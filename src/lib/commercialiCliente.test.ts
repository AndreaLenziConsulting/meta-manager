import { describe, expect, it } from "vitest";
import type { Sede, Venditore } from "@/types/kpi";
import { commercialiDelCliente } from "./commercialiCliente";

function sede(sedeId: string, nome: string, attivo = true): Sede {
  return { sedeId, clienteId: "c1", nome, attivo } as Sede;
}

function venditore(venditoreId: string, sedeId: string, nome: string, attivo = true): Venditore {
  return { venditoreId, sedeId, nome, capienzaAppuntamentiMensile: 0, attivo, ghlUserId: "" };
}

describe("commercialiDelCliente", () => {
  it("con una sede sola dà i nomi senza il nome della sede", () => {
    const esito = commercialiDelCliente([sede("s1", "Principale")], [venditore("v1", "s1", "Vittorio"), venditore("v2", "s1", "Stefano")]);
    expect(esito).toEqual([{ sede: "", nomi: ["Vittorio", "Stefano"] }]);
  });

  it("con più sedi mette il nome della sede, e salta quelle senza venditori", () => {
    const esito = commercialiDelCliente(
      [sede("s1", "Sesto"), sede("s2", "Anagnina"), sede("s3", "Bari")],
      [venditore("v1", "s1", "Giovanni"), venditore("v2", "s1", "Ruben"), venditore("v3", "s2", "Claudia")]
    );
    expect(esito).toEqual([
      { sede: "Sesto", nomi: ["Giovanni", "Ruben"] },
      { sede: "Anagnina", nomi: ["Claudia"] },
    ]);
  });

  it("non conta i venditori non attivi, quelli di altre sedi e le sedi non attive", () => {
    const esito = commercialiDelCliente(
      [sede("s1", "Principale"), sede("s2", "Chiusa", false)],
      [venditore("v1", "s1", "Carlo"), venditore("v2", "s1", "Uscito", false), venditore("v3", "s2", "Altrove"), venditore("v4", "altra-sede", "Estraneo")]
    );
    // Una sola sede attiva: niente nome di sede.
    expect(esito).toEqual([{ sede: "", nomi: ["Carlo"] }]);
  });

  it("nessun venditore registrato: elenco vuoto, lo schema resta generico", () => {
    expect(commercialiDelCliente([sede("s1", "Principale")], [])).toEqual([]);
  });
});
