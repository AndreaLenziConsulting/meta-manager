import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessione } from "@/lib/auth";
import { getConsulenti, getProdotti, getProspect } from "@/lib/sheets";
import { puoVedereProspect } from "@/lib/authz";
import { calcolaCalcolatoreBudget } from "@/lib/roiSimulatore";
import { formatEuro } from "@/lib/format";
import { ProspectTab } from "@/components/ProspectTab";
import { ProspectDatiCommerciali } from "@/components/ProspectDatiCommerciali";
import { Intestazione } from "@/components/ui/Intestazione";

// Nella scheda del browser il nome dell'azienda, solo per chi può vedere quel prospect.
export async function generateMetadata({ params }: { params: Promise<{ prospectId: string }> }): Promise<Metadata> {
  const { prospectId } = await params;
  const sessione = await getSessione();
  if (!sessione || sessione.ruolo === "consulente") return {};
  const prospect = await getProspect();
  if (!puoVedereProspect(sessione, prospectId, prospect)) return {};
  return { title: prospect.find((x) => x.prospectId === prospectId)?.ragioneSociale ?? "Prospect" };
}

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
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      <div className="space-y-3">
        <Link href="/dashboard/commerciale" className="inline-flex min-h-8 items-center text-sm font-semibold text-brand hover:underline">
          ← Tutti i prospect
        </Link>
        <Intestazione
          sopratitolo="Prospect"
          titolo={p.ragioneSociale}
          sottotitolo={
            [p.tipoBusiness, p.fatturato, p.sedi].filter(Boolean).join(" · ") || "Nessun dato anagrafico ancora: arriva con il primo report."
          }
        />
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
        className="block rounded-xl border border-linea bg-surface-card shadow-[var(--shadow-card)] p-4 hover:border-brand transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-bold text-ink-900">Calcolatore Budget</p>
            <p className="text-sm text-ink-500 mt-0.5 truncate">
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
