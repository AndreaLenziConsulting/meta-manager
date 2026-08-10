import { beforeEach, describe, expect, it } from "vitest";
import {
  createSessionCookieValue,
  isValidSessionCookieValue,
  parseSessionCookieValue,
  verifyConsulentePassword,
  verifyCronSecret,
  verifyTeamPassword,
} from "./auth";

beforeEach(() => {
  process.env.SESSION_SECRET = "test-secret-non-in-produzione";
  process.env.TEAM_PASSWORD = "password-team-test";
  process.env.CRON_SECRET = "cron-secret-test";
});

describe("sessione firmata: round-trip e resistenza alla manomissione", () => {
  it("round-trip admin", () => {
    const cookie = createSessionCookieValue({ ruolo: "admin" });
    expect(parseSessionCookieValue(cookie)).toEqual({ ruolo: "admin" });
  });

  it("round-trip consulente con id", () => {
    const cookie = createSessionCookieValue({ ruolo: "consulente", consulenteId: "cons-01" });
    expect(parseSessionCookieValue(cookie)).toEqual({ ruolo: "consulente", consulenteId: "cons-01" });
  });

  it("rifiuta un payload manomesso (cambio ruolo lasciando la firma vecchia)", () => {
    const cookie = createSessionCookieValue({ ruolo: "consulente", consulenteId: "cons-01" });
    const [payload, firma] = [cookie.slice(0, cookie.lastIndexOf(".")), cookie.slice(cookie.lastIndexOf(".") + 1)];
    const manomesso = `admin:${payload.split(":")[1]}.${firma}`;
    expect(parseSessionCookieValue(manomesso)).toBeNull();
  });

  it("rifiuta una firma alterata di un solo carattere", () => {
    const cookie = createSessionCookieValue({ ruolo: "admin" });
    const alterato = cookie.slice(0, -1) + (cookie.endsWith("a") ? "b" : "a");
    expect(parseSessionCookieValue(alterato)).toBeNull();
  });

  it("rifiuta stringhe malformate senza far esplodere nulla", () => {
    expect(parseSessionCookieValue(undefined)).toBeNull();
    expect(parseSessionCookieValue("")).toBeNull();
    expect(parseSessionCookieValue("nessun-punto-separatore")).toBeNull();
  });

  it("rifiuta un ruolo 'consulente' senza consulenteId, anche se firmato correttamente", () => {
    const cookie = createSessionCookieValue({ ruolo: "consulente" });
    expect(parseSessionCookieValue(cookie)).toBeNull();
  });

  it("un cookie firmato con un SESSION_SECRET diverso non è più valido dopo la rotazione", () => {
    const cookie = createSessionCookieValue({ ruolo: "admin" });
    process.env.SESSION_SECRET = "secret-ruotato";
    expect(parseSessionCookieValue(cookie)).toBeNull();
  });

  it("isValidSessionCookieValue rispecchia parseSessionCookieValue", () => {
    const valido = createSessionCookieValue({ ruolo: "admin" });
    expect(isValidSessionCookieValue(valido)).toBe(true);
    expect(isValidSessionCookieValue("invalido")).toBe(false);
  });
});

describe("verifyTeamPassword / verifyConsulentePassword", () => {
  it("accetta solo la password esatta", () => {
    expect(verifyTeamPassword("password-team-test")).toBe(true);
    expect(verifyTeamPassword("altra")).toBe(false);
    expect(verifyTeamPassword("")).toBe(false);
  });

  it("verifyConsulentePassword confronta contro il valore atteso passato esplicitamente", () => {
    expect(verifyConsulentePassword("segreto123", "segreto123")).toBe(true);
    expect(verifyConsulentePassword("segreto123", "altro")).toBe(false);
  });
});

describe("verifyCronSecret", () => {
  it("accetta solo l'header Bearer esatto", () => {
    expect(verifyCronSecret("Bearer cron-secret-test")).toBe(true);
    expect(verifyCronSecret("Bearer sbagliato")).toBe(false);
    expect(verifyCronSecret(null)).toBe(false);
    expect(verifyCronSecret("cron-secret-test")).toBe(false); // manca il prefisso "Bearer "
  });

  it("fail-closed se CRON_SECRET non è configurato", () => {
    delete process.env.CRON_SECRET;
    expect(verifyCronSecret("Bearer undefined")).toBe(false);
    expect(verifyCronSecret(null)).toBe(false);
  });
});
