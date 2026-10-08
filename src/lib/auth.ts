import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getCommerciali, getConsulenti } from "@/lib/archivio";
import { chiaveSquadra, creaControlloSquadra } from "@/lib/squadraAttiva";
import type { Sessione } from "@/types/kpi";

const SESSION_COOKIE = "mmalc_session";

function sign(value: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET non configurato");
  return createHmac("sha256", secret).update(value).digest("hex");
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function verifyTeamPassword(password: string): boolean {
  const expected = process.env.TEAM_PASSWORD;
  if (!expected) throw new Error("TEAM_PASSWORD non configurato");
  return timingSafeStringEqual(password, expected);
}

/** Verifica l'header Authorization del cron Vercel a tempo costante. Fail-closed se CRON_SECRET non è configurato. */
export function verifyCronSecret(authHeader: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return timingSafeStringEqual(authHeader ?? "", `Bearer ${expected}`);
}

/**
 * Come verifyCronSecret sopra, ma per il webhook GHL "prospect da appuntamento" (vedi POST
 * /api/ghl/webhook-prospect, 11/2026): stesso schema Authorization: Bearer, stesso fail-closed se
 * GHL_WEBHOOK_SECRET non è configurato — una richiesta in arrivo da fuori (GHL, non un utente
 * loggato) va autenticata comunque, non solo autorizzata come per una sessione.
 */
export function verifyGhlWebhookSecret(authHeader: string | null): boolean {
  const expected = process.env.GHL_WEBHOOK_SECRET;
  if (!expected) return false;
  return timingSafeStringEqual(authHeader ?? "", `Bearer ${expected}`);
}

// Il secondo campo del payload è l'id del ruolo (consulenteId o commercialeId, mai entrambi) — un
// solo slot generico, coerente con Sessione che non è una union discriminata.
export function createSessionCookieValue(sessione: Sessione): string {
  const id = sessione.consulenteId ?? sessione.commercialeId ?? "";
  const payload = `${sessione.ruolo}:${id}`;
  return `${payload}.${sign(payload)}`;
}

export function parseSessionCookieValue(cookieValue: string | undefined): Sessione | null {
  if (!cookieValue) return null;
  const idx = cookieValue.lastIndexOf(".");
  if (idx < 0) return null;
  const payload = cookieValue.slice(0, idx);
  const signature = cookieValue.slice(idx + 1);
  if (!timingSafeStringEqual(signature, sign(payload))) return null;

  const [ruolo, id] = payload.split(":");
  if (ruolo === "admin") return { ruolo: "admin" };
  if (ruolo === "consulente" && id) return { ruolo: "consulente", consulenteId: id };
  if (ruolo === "commerciale" && id) return { ruolo: "commerciale", commercialeId: id };
  return null;
}

/** Verifica solo la firma del cookie, senza controllare che la persona sia ancora attiva: per quello c'è getSessione. */
export function isValidSessionCookieValue(cookieValue: string | undefined): boolean {
  return parseSessionCookieValue(cookieValue) !== null;
}

// Uno solo per istanza del server, come il collegamento al database (vedi src/lib/db/connessione.ts).
const globale = globalThis as typeof globalThis & { __controlloSquadra?: ReturnType<typeof creaControlloSquadra> };

function controlloSquadra() {
  if (!globale.__controlloSquadra) {
    globale.__controlloSquadra = creaControlloSquadra(async () => {
      const [consulenti, commerciali] = await Promise.all([getConsulenti(), getCommerciali()]);
      return new Set([
        ...consulenti.filter((c) => c.attivo).map((c) => chiaveSquadra("consulente", c.consulenteId)),
        ...commerciali.filter((c) => c.attivo).map((c) => chiaveSquadra("commerciale", c.commercialeId)),
      ]);
    });
  }
  return globale.__controlloSquadra;
}

/** Da chiamare dopo aver attivato, disattivato, aggiunto o eliminato qualcuno: l'elenco degli attivi si rilegge subito. */
export function squadraCambiata(): void {
  controlloSquadra().dimentica();
}

/**
 * Legge e valida la sessione dal cookie della richiesta corrente (route handler o server component).
 * Una firma valida non basta: un consulente o un commerciale disattivato o eliminato dopo aver fatto
 * l'accesso non ha più una sessione (vedi src/lib/squadraAttiva.ts).
 */
export async function getSessione(): Promise<Sessione | null> {
  const cookieStore = await cookies();
  const sessione = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!sessione) return null;
  return (await controlloSquadra().ancoraAttiva(sessione)) ? sessione : null;
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
