import { redirect } from "next/navigation";
import { getSessione } from "@/lib/auth";
import { getProspect } from "@/lib/sheets";
import { puoVedereProspect } from "@/lib/authz";
import { ProspectTab } from "@/components/ProspectTab";
import { ProspectDatiCommerciali } from "@/components/ProspectDatiCommerciali";

export default async function ProspectDettaglioPage({ params }: { params: Promise<{ prospectId: string }> }) {
  const { prospectId } = await params;
  const sessione = await getSessione();
  if (!sessione) {
    redirect("/login");
  }
  if (sessione.ruolo === "consulente") {
    redirect("/dashboard");
  }

  const prospect = await getProspect();
  if (!puoVedereProspect(sessione, prospectId, prospect)) {
    redirect("/dashboard/commerciale");
  }
  const p = prospect.find((x) => x.prospectId === prospectId)!;

  return (
    <div className="max-w-screen-2xl mx-auto px-6 sm:px-8 py-8 space-y-6">
      <div>
        <h2 className="font-heading font-bold text-2xl text-ink-900">{p.ragioneSociale}</h2>
        <p className="text-sm text-ink-500 mt-1">
          {[p.tipoBusiness, p.fatturato, p.sedi].filter(Boolean).join(" · ") || "Nessun dato anagrafico ancora — verrà popolato dal primo report."}
        </p>
      </div>
      <ProspectDatiCommerciali prospect={p} />
      <ProspectTab prospectId={p.prospectId} ragioneSociale={p.ragioneSociale} prospectEmail={p.email || undefined} />
    </div>
  );
}
