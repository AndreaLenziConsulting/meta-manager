import { redirect } from "next/navigation";
import { getSessione } from "@/lib/auth";
import { getProspect, getReportCommerciale } from "@/lib/sheets";
import { prospectVisibili } from "@/lib/authz";
import { NuovoProspectForm } from "@/components/NuovoProspectForm";

export default async function ProspectListaPage() {
  const sessione = await getSessione();
  if (!sessione) {
    redirect("/login");
  }
  if (sessione.ruolo === "consulente") {
    redirect("/dashboard");
  }

  const [prospect, report] = await Promise.all([getProspect(), getReportCommerciale()]);
  const visibili = prospectVisibili(sessione, prospect);
  const ultimoReportPer = new Map<string, string>();
  for (const r of report) {
    const attuale = ultimoReportPer.get(r.prospectId);
    if (!attuale || r.data > attuale) ultimoReportPer.set(r.prospectId, r.data);
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h2 className="font-heading font-bold text-xl text-ink-900">Prospect</h2>
        <p className="text-sm text-ink-500 mt-1">
          {sessione.ruolo === "admin" ? "Tutti i prospect di tutti i commerciali." : "I tuoi prospect."}
        </p>
      </div>

      {sessione.ruolo === "commerciale" && <NuovoProspectForm />}

      {visibili.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-ink-300 bg-surface-card p-8 text-center">
          <p className="text-sm text-ink-500">Nessun prospect ancora.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibili.map((p) => (
            <a
              key={p.prospectId}
              href={`/dashboard/commerciale/${encodeURIComponent(p.prospectId)}`}
              className="rounded-2xl border border-ink-300 bg-surface-card shadow-sm p-5 hover:shadow-md transition"
            >
              <p className="font-heading font-bold text-ink-900 text-base truncate">{p.ragioneSociale}</p>
              {p.tipoBusiness && <p className="text-xs text-ink-500 mt-0.5">{p.tipoBusiness}</p>}
              <p className="text-[11px] text-ink-500 mt-2.5 pt-2.5 border-t border-ink-300/60">
                {ultimoReportPer.has(p.prospectId) ? `Ultimo report: ${ultimoReportPer.get(p.prospectId)}` : "Nessun report ancora"}
              </p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
