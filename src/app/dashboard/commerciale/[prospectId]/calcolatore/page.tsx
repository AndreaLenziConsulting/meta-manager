import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessione } from "@/lib/auth";
import { getProspect } from "@/lib/sheets";
import { puoVedereProspect } from "@/lib/authz";
import { CalcolatoreBudgetProspect } from "@/components/CalcolatoreBudgetProspect";

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
    <div className="max-w-screen-md mx-auto px-6 sm:px-8 py-8 space-y-6">
      <div>
        <Link
          href={`/dashboard/commerciale/${encodeURIComponent(prospectId)}`}
          className="text-xs font-semibold text-brand hover:underline"
        >
          ← {prospect.ragioneSociale}
        </Link>
        <h2 className="font-heading font-bold text-2xl text-ink-900 mt-2">Calcolatore Budget</h2>
        <p className="text-sm text-ink-500 mt-1">
          Da un fatturato mensile obiettivo a budget, appuntamenti e lead necessari — questi numeri vengono proposti
          come target della Sede quando converti il prospect in cliente.
        </p>
      </div>

      <CalcolatoreBudgetProspect prospect={prospect} />
    </div>
  );
}
