import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessione } from "@/lib/auth";
import { getProspect } from "@/lib/archivio";
import { puoVedereProspect } from "@/lib/authz";
import { CalcolatoreBudgetProspect } from "@/components/CalcolatoreBudgetProspect";
import { Intestazione } from "@/components/ui/Intestazione";

export const metadata: Metadata = { title: "Calcolatore Budget" };

/**
 * Sezione a parte del prospect, fuori dal report (vedi Prospect.calcolatoreBudget in
 * types/prospect.ts): stesso gate di accesso della pagina prospect principale
 * (dashboard/commerciale/[prospectId]/page.tsx) — un consulente non arriva mai qui, un
 * commerciale solo sui propri prospect, l'admin su tutti.
 */
export default async function CalcolatoreProspectPage({ params }: { params: Promise<{ prospectId: string }> }) {
  const { prospectId } = await params;
  const sessione = await getSessione();
  if (!sessione) {
    redirect("/login");
  }
  if (sessione.ruolo === "consulente") {
    redirect("/dashboard");
  }

  const prospetti = await getProspect();
  if (!puoVedereProspect(sessione, prospectId, prospetti)) {
    redirect("/dashboard/commerciale");
  }
  const prospect = prospetti.find((p) => p.prospectId === prospectId)!;

  return (
    <div className="max-w-screen-md mx-auto px-4 sm:px-8 py-8 space-y-6">
      <div className="space-y-3">
        <Link
          href={`/dashboard/commerciale/${encodeURIComponent(prospectId)}`}
          className="inline-flex min-h-8 items-center text-sm font-semibold text-brand hover:underline"
        >
          ← {prospect.ragioneSociale}
        </Link>
        <Intestazione
          sopratitolo="Prospect"
          titolo="Calcolatore Budget."
          sottotitolo="Da un fatturato mensile obiettivo a budget, appuntamenti e lead necessari. Diventano i target della sede quando converti il prospect in cliente."
        />
      </div>

      <CalcolatoreBudgetProspect prospect={prospect} />
    </div>
  );
}
