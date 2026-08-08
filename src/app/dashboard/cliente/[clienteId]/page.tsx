import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getClienti } from "@/lib/sheets";
import { puoVedereCliente } from "@/lib/authz";
import { SchedaCliente } from "@/components/SchedaCliente";

export default async function ClienteSchedaPage({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params;
  const cookieStore = await cookies();
  const sessione = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  if (!sessione) {
    redirect("/login");
  }

  const clienti = await getClienti();
  if (!puoVedereCliente(sessione, clienteId, clienti)) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <SchedaCliente clienteId={clienteId} tuttiITab />
    </div>
  );
}
