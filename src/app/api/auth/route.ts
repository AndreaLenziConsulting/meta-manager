import { NextRequest, NextResponse } from "next/server";
import { createSessionCookieValue, verifyTeamPassword, SESSION_COOKIE_NAME } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { password } = (await req.json()) as { password?: string };

  if (!password || !verifyTeamPassword(password)) {
    return NextResponse.json({ error: "Password errata" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
