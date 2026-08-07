import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getClienti } from "@/lib/sheets";
import { clientiVisibili } from "@/lib/authz";
import { DashboardClient } from "@/components/DashboardClient";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const sessione = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  if (!sessione) {
    redirect("/login");
  }

  const clienti = clientiVisibili(sessione, await getClienti()).map((c) => ({
    clienteId: c.clienteId,
    nome: c.nome,
  }));

  return <DashboardClient clientiIniziali={clienti} ruolo={sessione.ruolo} />;
}
