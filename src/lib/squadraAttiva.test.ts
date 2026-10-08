import { describe, expect, it } from "vitest";
import { chiaveSquadra, creaControlloSquadra } from "./squadraAttiva";

describe("controllo che chi ha già fatto l'accesso sia ancora attivo", () => {
  it("un consulente attivo passa, uno che non è più nell'elenco no; l'amministratore sempre", async () => {
    const controllo = creaControlloSquadra(async () => new Set([chiaveSquadra("consulente", "eliano"), chiaveSquadra("commerciale", "stefano")]));
    expect(await controllo.ancoraAttiva({ ruolo: "consulente", consulenteId: "eliano" })).toBe(true);
    expect(await controllo.ancoraAttiva({ ruolo: "commerciale", commercialeId: "stefano" })).toBe(true);
    expect(await controllo.ancoraAttiva({ ruolo: "consulente", consulenteId: "uscito" })).toBe(false);
    expect(await controllo.ancoraAttiva({ ruolo: "admin" })).toBe(true);
  });

  it("stesso id, ruolo diverso: sono due persone", async () => {
    const controllo = creaControlloSquadra(async () => new Set([chiaveSquadra("commerciale", "mario")]));
    expect(await controllo.ancoraAttiva({ ruolo: "consulente", consulenteId: "mario" })).toBe(false);
  });

  it("l'elenco si rilegge solo quando è scaduto, o quando gli si dice di dimenticarlo", async () => {
    let ora = 1_000;
    let letture = 0;
    let attivi = new Set([chiaveSquadra("consulente", "eliano")]);
    const controllo = creaControlloSquadra(
      async () => {
        letture++;
        return attivi;
      },
      30_000,
      () => ora
    );
    const eliano = { ruolo: "consulente" as const, consulenteId: "eliano" };

    expect(await controllo.ancoraAttiva(eliano)).toBe(true);
    expect(await controllo.ancoraAttiva(eliano)).toBe(true);
    expect(letture).toBe(1);

    // Disattivato da un'altra istanza: qui si vede allo scadere.
    attivi = new Set();
    ora += 29_000;
    expect(await controllo.ancoraAttiva(eliano)).toBe(true);
    ora += 2_000;
    expect(await controllo.ancoraAttiva(eliano)).toBe(false);
    expect(letture).toBe(2);

    // Riattivato da questa istanza: si vede subito.
    attivi = new Set([chiaveSquadra("consulente", "eliano")]);
    controllo.dimentica();
    expect(await controllo.ancoraAttiva(eliano)).toBe(true);
    expect(letture).toBe(3);
  });

  it("una lettura fallita non resta in memoria: la richiesta dopo riprova", async () => {
    let fallisci = true;
    const controllo = creaControlloSquadra(async () => {
      if (fallisci) throw new Error("database non raggiungibile");
      return new Set([chiaveSquadra("consulente", "eliano")]);
    });
    const eliano = { ruolo: "consulente" as const, consulenteId: "eliano" };
    await expect(controllo.ancoraAttiva(eliano)).rejects.toThrow("database non raggiungibile");
    fallisci = false;
    expect(await controllo.ancoraAttiva(eliano)).toBe(true);
  });
});
