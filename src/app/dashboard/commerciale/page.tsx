import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessione } from "@/lib/auth";
import { getCommerciali, getProspect, getReportCommerciale } from "@/lib/sheets";
import { prospectVisibili } from "@/lib/authz";
import { NuovoProspectForm } from "@/components/NuovoProspectForm";
import { Badge } from "@/components/ui/Badge";
import { Intestazione, CLASSE_TITOLO_SEZIONE } from "@/components/ui/Intestazione";
import { Nota } from "@/components/ui/Nota";
import { formatDataBreve } from "@/lib/format";

export const metadata: Metadata = { title: "Prospect" };

export default async function ProspectListaPage() {
  const sessione = await getSessione();
  if (!sessione) {
    redirect("/login");
  }
  if (sessione.ruolo === "consulente") {
    redirect("/dashboard");
  }

  // getCommerciali() serve solo all'admin (sceglie a chi assegnare il nuovo prospect, vedi
  // NuovoProspectForm) — recuperato comunque in parallelo con le altre letture, costo trascurabile
  // anche quando è il commerciale a vedere la pagina e non gli serve.
  const [prospect, report, commerciali] = await Promise.all([getProspect(), getReportCommerciale(), getCommerciali()]);
  const visibili = prospectVisibili(sessione, prospect);
  const ultimoReportPer = new Map<string, string>();
  for (const r of report) {
    const attuale = ultimoReportPer.get(r.prospectId);
    if (!attuale || r.data > attuale) ultimoReportPer.set(r.prospectId, r.data);
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      <Intestazione
        sopratitolo={sessione.ruolo === "admin" ? "Tutti i commerciali" : "I tuoi prospect"}
        titolo="Prospect."
        sottotitolo="Le aziende in trattativa e i report delle chiamate commerciali."
      />

      {sessione.ruolo === "commerciale" && <NuovoProspectForm />}
      {sessione.ruolo === "admin" && (
        <NuovoProspectForm
          commerciali={commerciali.filter((c) => c.attivo).map((c) => ({ commercialeId: c.commercialeId, nome: c.nome }))}
        />
      )}

      {visibili.length === 0 ? (
        <Nota etichetta="Nessun prospect">
          <p>Non c&apos;è ancora nessun prospect. Creane uno con il pulsante qui sopra.</p>
        </Nota>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibili.map((p) => (
            <a
              key={p.prospectId}
              href={`/dashboard/commerciale/${encodeURIComponent(p.prospectId)}`}
              className="flex flex-col gap-2 rounded-xl border border-linea bg-surface-card shadow-[var(--shadow-card)] p-5 hover:shadow-[var(--shadow-alta)] transition"
            >
              <p className={`${CLASSE_TITOLO_SEZIONE} truncate`}>{p.ragioneSociale}</p>
              {/* Lo stato è scritto, non affidato a un'icona di 13px col significato nel tooltip. */}
              {(p.clienteId || p.consulenteSuggeritoId) && (
                <p>{p.clienteId ? <Badge tono="successo">Convertito in cliente</Badge> : <Badge tono="info">Proposto per la conversione</Badge>}</p>
              )}
              {p.tipoBusiness && <p className="text-sm text-ink-500">{p.tipoBusiness}</p>}
              <p className="text-xs text-ink-500 mt-auto pt-3 border-t border-linea">
                {ultimoReportPer.has(p.prospectId)
                  ? `Ultimo report: ${formatDataBreve(ultimoReportPer.get(p.prospectId) ?? "")}`
                  : "Nessun report ancora"}
              </p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
