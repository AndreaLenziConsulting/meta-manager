import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessione } from "@/lib/auth";
import { getConsulenti, getProdotti, getProspect } from "@/lib/sheets";
import { puoVedereProspect } from "@/lib/authz";
import { calcolaCalcolatoreBudget } from "@/lib/roiSimulatore";
import { formatEuro } from "@/lib/format";
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

  // Riepilogo del Calcolatore Budget (sezione a parte, vedi la sua pagina dedicata) — solo per
  // dare un'anteprima dei numeri già compilati senza doverci entrare; il calcolo vero vive lì.
  const outputCalcolatore = p.calcolatoreBudget ? calcolaCalcolatoreBudget(p.calcolatoreBudget) : null;

  return (
    <div className="max-w-screen-2xl mx-auto px-6 sm:px-8 py-8 space-y-6">
      <div>
        <Link href="/dashboard/commerciale" className="text-xs font-semibold text-brand hover:underline">
          ← Tutti i prospect
        </Link>
        <h2 className="font-heading font-bold text-2xl text-ink-900 mt-2">{p.ragioneSociale}</h2>
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

      <Link
        href={`/dashboard/commerciale/${encodeURIComponent(p.prospectId)}/calcolatore`}
        className="block rounded-2xl border border-ink-300 bg-surface-card shadow-sm p-4 hover:border-brand transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-900">Calcolatore Budget</p>
            <p className="text-xs text-ink-500 mt-0.5 truncate">
              {outputCalcolatore?.budgetMensile != null
                ? `Budget necessario ${formatEuro(outputCalcolatore.budgetMensile)} · Fatturato obiettivo ${formatEuro(p.calcolatoreBudget?.fatturatoMensile ?? null)}`
                : "Non ancora compilato — ricava budget, appuntamenti e lead necessari da un fatturato obiettivo"}
            </p>
          </div>
          <span className="text-brand text-lg flex-shrink-0" aria-hidden>
            →
          </span>
        </div>
      </Link>

      <ProspectTab prospectId={p.prospectId} ragioneSociale={p.ragioneSociale} prospectEmail={p.email || undefined} />
    </div>
  );
}
