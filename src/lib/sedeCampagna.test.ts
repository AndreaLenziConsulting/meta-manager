import { describe, expect, it } from "vitest";
import { sedePerNuovaCampagna } from "./sedeCampagna";
import type { Sede } from "@/types/kpi";

function sede(overrides: Partial<Sede> = {}): Sede {
  return { sedeId: "agricobots--principale", clienteId: "agricobots", nome: "Italia", adAccountId: "545", attivo: true, ...overrides } as Sede;
}

const italia = sede();
const spagna = sede({ sedeId: "agricobots--spagna", nome: "Spagna" });

describe("sedePerNuovaCampagna", () => {
  it("una sola sede sull'account -> sempre quella, qualunque nome", () => {
    expect(sedePerNuovaCampagna("Agricobots (Spagna) - Dal 7 Luglio", italia, [italia])).toBe("agricobots--principale");
  });

  it("il nome della campagna contiene il nome di una sede -> va a quella, anche se sincronizza l'altra", () => {
    expect(sedePerNuovaCampagna("Agricobots (Spagna) - Dal 7 Luglio", italia, [italia, spagna])).toBe("agricobots--spagna");
    expect(sedePerNuovaCampagna("Agricobots (Concessionari Italia) - Dal 7 Luglio", spagna, [italia, spagna])).toBe("agricobots--principale");
  });

  it("senza distinzione fra maiuscole e minuscole", () => {
    expect(sedePerNuovaCampagna("agricobots SPAGNA lead", italia, [italia, spagna])).toBe("agricobots--spagna");
  });

  it("nessuna sede riconosciuta nel nome -> prima sede dell'account nell'ordine del foglio, da entrambe le sincronizzazioni", () => {
    expect(sedePerNuovaCampagna("Agricobots - Dal 5 Settembre 2026", italia, [italia, spagna])).toBe("agricobots--principale");
    expect(sedePerNuovaCampagna("Agricobots - Dal 5 Settembre 2026", spagna, [italia, spagna])).toBe("agricobots--principale");
  });

  it("più sedi riconosciute nel nome -> ambiguo, sede di default", () => {
    expect(sedePerNuovaCampagna("Agricobots Italia e Spagna", spagna, [italia, spagna])).toBe("agricobots--principale");
  });

  it("ignora sedi non attive, di altri clienti o con un altro ad account", () => {
    const inattiva = sede({ sedeId: "agricobots--francia", nome: "Francia", attivo: false });
    const altroAccount = sede({ sedeId: "agricobots--germania", nome: "Germania", adAccountId: "999" });
    const altroCliente = sede({ sedeId: "altro--spagna", clienteId: "altro", nome: "Spagna" });
    expect(sedePerNuovaCampagna("Agricobots Francia", italia, [italia, inattiva])).toBe("agricobots--principale");
    expect(sedePerNuovaCampagna("Agricobots Germania", italia, [italia, altroAccount])).toBe("agricobots--principale");
    expect(sedePerNuovaCampagna("Agricobots Spagna", italia, [italia, altroCliente])).toBe("agricobots--principale");
  });

  it("un nome sede troppo corto non viene mai cercato dentro il nome campagna", () => {
    const corta = sede({ sedeId: "agricobots--it", nome: "IT" });
    expect(sedePerNuovaCampagna("Agricobots IT - lead", spagna, [spagna, corta])).toBe("agricobots--spagna");
  });
});
