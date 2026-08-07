import { createHmac, timingSafeEqual } from "crypto";
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

export function verifyConsulentePassword(password: string, atteso: string): boolean {
  return timingSafeStringEqual(password, atteso);
}

export function createSessionCookieValue(sessione: Sessione): string {
  const payload = `${sessione.ruolo}:${sessione.consulenteId ?? ""}`;
  return `${payload}.${sign(payload)}`;
}

export function parseSessionCookieValue(cookieValue: string | undefined): Sessione | null {
  if (!cookieValue) return null;
  const idx = cookieValue.lastIndexOf(".");
  if (idx < 0) return null;
  const payload = cookieValue.slice(0, idx);
  const signature = cookieValue.slice(idx + 1);
  if (!timingSafeStringEqual(signature, sign(payload))) return null;

  const [ruolo, consulenteId] = payload.split(":");
  if (ruolo === "admin") return { ruolo: "admin" };
  if (ruolo === "consulente" && consulenteId) return { ruolo: "consulente", consulenteId };
  return null;
}

/** Verifica solo che la sessione sia valida, senza bisogno del ruolo (usata dove basta "è autenticato"). */
export function isValidSessionCookieValue(cookieValue: string | undefined): boolean {
  return parseSessionCookieValue(cookieValue) !== null;
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
