import { createHmac, timingSafeEqual } from "crypto";

const SESSION_COOKIE = "mmalc_session";
const SESSION_VALUE = "team-authenticated";

function sign(value: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET non configurato");
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function verifyTeamPassword(password: string): boolean {
  const expected = process.env.TEAM_PASSWORD;
  if (!expected) throw new Error("TEAM_PASSWORD non configurato");
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createSessionCookieValue(): string {
  return `${SESSION_VALUE}.${sign(SESSION_VALUE)}`;
}

export function isValidSessionCookieValue(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;
  const [value, signature] = cookieValue.split(".");
  if (!value || !signature || value !== SESSION_VALUE) return false;
  const expected = sign(SESSION_VALUE);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
