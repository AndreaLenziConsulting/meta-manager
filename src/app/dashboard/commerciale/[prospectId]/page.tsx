import { redirect } from "next/navigation";
import { getSessione } from "@/lib/auth";
import { getConsulenti, getProdotti, getProspect } from "@/lib/sheets";
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

  // Hand-off commerciale→consulente ("Proponi conversione"/"Converti in cliente" in
  // ProspectDatiCommerciali): il commerciale propone (sceglie un consulente da suggerire, serve la
  // lista), solo l'admin esegue davvero la conversione (stesso gate di POST /api/clienti, serve
  // anche prodotti). Nessun fetch in più per un consulente, che non arriva mai a questa pagina
  // (redirect sopra).
  const ruoloAdmin = sessione.ruolo === "admin";
  const ruoloCommerciale = sessione.ruolo === "commerciale";
  const consulenti = ruoloAdmin || ruoloCommerciale ? await getConsulenti() : null;
  const prodotti = ruoloAdmin ? await getProdotti() : null;

  return (
    <div className="max-w-screen-2xl mx-auto px-6 sm:px-8 py-8 space-y-6">
      <div>
        <h2 className="font-heading font-bold text-2xl text-ink-900">{p.ragioneSociale}</h2>
        <p className="text-sm text-ink-500 mt-1">
          {[p.tipoBusiness, p.fatturato, p.sedi].filter(Boolean).join(" · ") || "Nessun dato anagrafico ancora — verrà popolato dal primo report."}
        </p>
      </div>
      <ProspectDatiCommerciali
        prospect={p}
        ruoloAdmin={ruoloAdmin}
        ruoloCommerciale={ruoloCommerciale}
        consulenti={consulenti?.filter((c) => c.attivo).map((c) => ({ consulenteId: c.consulenteId, nome: c.nome }))}
        prodotti={prodotti?.filter((pr) => pr.attivo).map((pr) => ({ prodottoId: pr.prodottoId, nome: pr.nome }))}
      />
      <ProspectTab prospectId={p.prospectId} ragioneSociale={p.ragioneSociale} prospectEmail={p.email || undefined} />
    </div>
  );
}
