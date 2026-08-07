import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { isValidSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getClienti } from "@/lib/sheets";
import { DashboardClient } from "@/components/DashboardClient";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!isValidSessionCookieValue(session)) {
    redirect("/login");
  }

  const clienti = (await getClienti())
    .filter((c) => c.attivo)
    .map((c) => ({ clienteId: c.clienteId, nome: c.nome }));

  return <DashboardClient clientiIniziali={clienti} />;
}
