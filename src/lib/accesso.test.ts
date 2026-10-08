import { beforeAll, describe, expect, it } from "vitest";
import { chiEntra, passwordGiaUsata } from "./accesso";
import { creaImpronta } from "./password";
import type { CredenzialeAccesso } from "@/types/kpi";

let squadra: CredenzialeAccesso[];

beforeAll(async () => {
  squadra = [
    { ruolo: "consulente", id: "eliano", attivo: true, password: await creaImpronta("Password-Eliano-1") },
    // Non ancora convertita: scritta com'era prima dell'08/10/2026.
    { ruolo: "consulente", id: "marco", attivo: true, password: "Password-Marco-1" },
    { ruolo: "consulente", id: "uscito", attivo: false, password: await creaImpronta("Password-Uscito-1") },
    { ruolo: "consulente", id: "senza", attivo: true, password: "" },
    { ruolo: "commerciale", id: "stefano", attivo: true, password: await creaImpronta("Password-Stefano-1") },
  ];
});

describe("chiEntra", () => {
  it("riconosce il consulente dalla sua password", async () => {
    expect(await chiEntra("Password-Eliano-1", squadra)).toEqual({ ruolo: "consulente", consulenteId: "eliano" });
  });

  it("riconosce il commerciale, con il suo ruolo", async () => {
    expect(await chiEntra("Password-Stefano-1", squadra)).toEqual({ ruolo: "commerciale", commercialeId: "stefano" });
  });

  it("una password ancora salvata in chiaro fa entrare lo stesso", async () => {
    expect(await chiEntra("Password-Marco-1", squadra)).toEqual({ ruolo: "consulente", consulenteId: "marco" });
  });

  it("una persona non attiva non entra, nemmeno con la password giusta", async () => {
    expect(await chiEntra("Password-Uscito-1", squadra)).toBeNull();
  });

  it("password sbagliata o vuota: nessuno (chi non ha una password non entra con il campo vuoto)", async () => {
    expect(await chiEntra("Password-Di-Nessuno", squadra)).toBeNull();
    expect(await chiEntra("", squadra)).toBeNull();
  });

  it("con la stessa password vince il consulente, che viene prima nell'elenco", async () => {
    const doppia = [...squadra, { ruolo: "commerciale" as const, id: "omonimo", attivo: true, password: "Password-Marco-1" }];
    expect(await chiEntra("Password-Marco-1", doppia)).toEqual({ ruolo: "consulente", consulenteId: "marco" });
  });
});

describe("passwordGiaUsata", () => {
  it("vero se è di un altro, anche di un altro ruolo o non attivo", async () => {
    expect(await passwordGiaUsata("Password-Eliano-1", squadra)).toBe(true);
    expect(await passwordGiaUsata("Password-Stefano-1", squadra, { ruolo: "consulente", id: "eliano" })).toBe(true);
    expect(await passwordGiaUsata("Password-Uscito-1", squadra)).toBe(true);
  });

  it("falso se è libera, o se è già quella della persona a cui la si reimposta", async () => {
    expect(await passwordGiaUsata("Password-Nuova-9", squadra)).toBe(false);
    expect(await passwordGiaUsata("Password-Eliano-1", squadra, { ruolo: "consulente", id: "eliano" })).toBe(false);
  });

  it("stesso id in due ruoli diversi: sono due persone", async () => {
    expect(await passwordGiaUsata("Password-Stefano-1", squadra, { ruolo: "consulente", id: "stefano" })).toBe(true);
  });
});
