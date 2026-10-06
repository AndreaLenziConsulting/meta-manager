import { describe, expect, it } from "vitest";
import { campagneDaConsiderare, campagnePredefinite, haNomeAlc, leggiFiltroCampagne } from "./campagneAlc";
import type { Campagna } from "@/types/kpi";

function campagna(campaignId: string, nomeCampagna: string, overrides: Partial<Campagna> = {}): Campagna {
  return { campaignId, clienteId: "visma", sedeId: "visma--principale", nomeCampagna, tipoCampagna: "", stato: "ACTIVE", ...overrides };
}

const SEDE = { clienteId: "visma", sedeId: "visma--principale" };

describe("haNomeAlc", () => {
  it("riconosce ALC come parola a sé, in qualunque combinazione di maiuscole", () => {
    expect(haNomeAlc("[ALC] Visma | Catalogo | Settembre 2026")).toBe(true);
    expect(haNomeAlc("ALC - TF | Lead Gen CONSULENZA | ABO")).toBe(true);
    expect(haNomeAlc("Alc lead ads ottobre")).toBe(true);
    expect(haNomeAlc("visma_alc_catalogo")).toBe(true);
    expect(haNomeAlc("Campagna cucine - alc")).toBe(true);
    expect(haNomeAlc("ALC2026 promo")).toBe(true);
  });

  it("non lo riconosce dentro un'altra parola", () => {
    expect(haNomeAlc("Scuola Calcio - iscrizioni")).toBe(false);
    expect(haNomeAlc("Divani Alcantara -30%")).toBe(false);
    expect(haNomeAlc("Falco Arredamenti | Lead")).toBe(false);
    expect(haNomeAlc("Calc 2026")).toBe(false);
  });

  it("nomi reali senza ALC", () => {
    expect(haNomeAlc("Ale Contatti x Catalogo Febal Campagna")).toBe(false);
    expect(haNomeAlc("CONSEA | Sicurezza Lavoro | settembre 2026")).toBe(false);
    expect(haNomeAlc("Acquisition Control - Lead Ads - Dal 21 Settembre")).toBe(false);
    expect(haNomeAlc("")).toBe(false);
  });
});

describe("campagnePredefinite", () => {
  const campagne = [
    campagna("1", "[ALC] Visma | Catalogo | Settembre 2026"),
    campagna("2", "[ALC] Visma | Weekend Reset", { stato: "PAUSED" }),
    campagna("3", "Ale Contatti x Catalogo Febal Campagna"),
    campagna("4", "[ALC] Altra sede", { sedeId: "visma--milano" }),
    campagna("5", "[ALC] Altro cliente", { clienteId: "serveco", sedeId: "serveco--principale" }),
  ];

  it("solo le campagne ALC della sede, attive o no", () => {
    expect(campagnePredefinite(SEDE, campagne)).toEqual(new Set(["1", "2"]));
  });

  it("sede senza nessuna campagna ALC -> nessun filtro (valgono tutte), mai un insieme vuoto", () => {
    const sedeSenza = { clienteId: "agricobots", sedeId: "agricobots--principale" };
    const sue = [campagna("9", "Agricobots - Dal 5 Settembre 2026", sedeSenza)];
    expect(campagnePredefinite(sedeSenza, [...campagne, ...sue])).toBeNull();
    expect(campagnePredefinite(SEDE, [])).toBeNull();
  });

  it("sede con 'tutte le campagne' attivo -> nessun filtro anche se ha campagne ALC", () => {
    expect(campagnePredefinite({ ...SEDE, tutteLeCampagne: true }, campagne)).toBeNull();
  });
});

describe("leggiFiltroCampagne", () => {
  it("parametro assente o vuoto -> predefinito", () => {
    expect(leggiFiltroCampagne(null)).toEqual({ tipo: "predefinito" });
    expect(leggiFiltroCampagne("")).toEqual({ tipo: "predefinito" });
    expect(leggiFiltroCampagne(" , ")).toEqual({ tipo: "predefinito" });
  });

  it("'tutte' -> tutte le campagne", () => {
    expect(leggiFiltroCampagne("tutte")).toEqual({ tipo: "tutte" });
  });

  it("elenco di id -> scelta a mano", () => {
    expect(leggiFiltroCampagne("120,345")).toEqual({ tipo: "scelte", ids: new Set(["120", "345"]) });
  });
});

describe("campagneDaConsiderare", () => {
  const campagne = [campagna("1", "[ALC] Visma | Catalogo"), campagna("3", "Ale Contatti x Catalogo")];

  it("predefinito -> le campagne ALC della sede", () => {
    expect(campagneDaConsiderare({ tipo: "predefinito" }, SEDE, campagne)).toEqual(new Set(["1"]));
  });

  it("'tutte' scavalca il predefinito", () => {
    expect(campagneDaConsiderare({ tipo: "tutte" }, SEDE, campagne)).toBeNull();
  });

  it("una scelta a mano vale così com'è, anche se include campagne senza ALC", () => {
    expect(campagneDaConsiderare({ tipo: "scelte", ids: new Set(["3"]) }, SEDE, campagne)).toEqual(new Set(["3"]));
  });
});
