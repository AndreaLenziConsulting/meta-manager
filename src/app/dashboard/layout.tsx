import { redirect } from "next/navigation";
import { getSessione } from "@/lib/auth";
import { getCommerciali, getConsulenti } from "@/lib/sheets";
import { DashboardShell } from "@/components/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sessione = await getSessione();

  if (!sessione) {
    redirect("/login");
  }

  // Nome da mostrare nell'indicatore account (AccountMenu.tsx) — null per l'admin, che non ha un
  // nome proprio (password condivisa di team, nessun id associato in Sessione).
  let nomeAccount: string | null = null;
  if (sessione.ruolo === "consulente") {
    const consulenti = await getConsulenti();
    nomeAccount = consulenti.find((c) => c.consulenteId === sessione.consulenteId)?.nome ?? null;
  } else if (sessione.ruolo === "commerciale") {
    const commerciali = await getCommerciali();
    nomeAccount = commerciali.find((c) => c.commercialeId === sessione.commercialeId)?.nome ?? null;
  }

  return (
    <DashboardShell ruolo={sessione.ruolo} nomeAccount={nomeAccount}>
      {children}
    </DashboardShell>
  );
}
