import { NextRequest, NextResponse } from "next/server";
import { createSessionCookieValue, verifyTeamPassword, SESSION_COOKIE_NAME } from "@/lib/auth";
import { chiEntra } from "@/lib/accesso";
import { getCredenzialiAccesso } from "@/lib/archivio";
import type { Sessione } from "@/types/kpi";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { password } = (await req.json()) as { password?: string };

  if (!password) {
    return NextResponse.json({ error: "Password errata" }, { status: 401 });
  }

  let sessione: Sessione | null = null;

  if (verifyTeamPassword(password)) {
    sessione = { ruolo: "admin" };
  } else {
    // Consulenti e commerciali: la password si confronta con l'impronta salvata di ognuno (vedi
    // src/lib/accesso.ts e src/lib/password.ts), prima i consulenti.
    sessione = await chiEntra(password, await getCredenzialiAccesso());
  }

  if (!sessione) {
    return NextResponse.json({ error: "Password errata" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(sessione), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

/** Esce dalla sessione corrente (indicatore account nella sidebar, vedi AccountMenu.tsx). */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
