"use client";

import { useEffect, useState } from "react";
import { formatDataBreve } from "@/lib/format";
import { ReportCommercialeView } from "@/components/ReportCommercialeView";
import { SimulatoreRoi } from "@/components/SimulatoreRoi";
import type { CalcolatoreBudgetInput, ReportCommercialeRow } from "@/types/prospect";

/** Come haValori in SimulatoreRoi.tsx (non esportata da lì) — decide se vale la pena mostrare il
 * riquadro Calcolatore Budget qui sopra, invece di un titolo con sotto un componente che si
 * autonasconde (SimulatoreRoi ritorna null se !editable && vuoto, ma il titolo/riquadro attorno
 * resterebbe comunque visibile senza questo controllo qui). */
function haValoriCalcolatore(v: CalcolatoreBudgetInput | null): boolean {
  return !!v && Object.values(v).some((x) => x !== null);
}

/**
 * Tab "Vendita" della scheda cliente — sola lettura, mai sul link pubblico (stesso gate `!code` di
 * Attività in SchedaCliente.tsx): il Calcolatore Budget del prospect che si è convertito in questo
 * cliente (sezione a parte del prospect, non più dentro i report) più lo storico dei suoi report
 * commerciali — dati che il consulente non vedrebbe altrimenti, vedi GET
 * /api/clienti/report-vendita. Stesso pattern a righe collassabili di ProspectTab.tsx per i report,
 * qui sempre in sola lettura: nessun pulsante "Modifica report"/PDF/email, storico non più
 * editabile da qui (resta editabile solo dal prospect originale, se non ancora disattivato).
 */
export function ReportVenditaTab({ clienteId }: { clienteId: string }) {
  const [reportLista, setReportLista] = useState<ReportCommercialeRow[] | null>(null);
  const [calcolatoreBudget, setCalcolatoreBudget] = useState<CalcolatoreBudgetInput | null>(null);
  const [espanso, setEspanso] = useState<string | null>(null);

  useEffect(() => {
    let annullato = false;
    fetch(`/api/clienti/report-vendita?clienteId=${encodeURIComponent(clienteId)}`)
      .then((res) => res.json())
      .then((data: { report: ReportCommercialeRow[]; calcolatoreBudget: CalcolatoreBudgetInput | null }) => {
        if (annullato) return;
        const report = data.report ?? [];
        setReportLista(report);
        setCalcolatoreBudget(data.calcolatoreBudget ?? null);
        if (report.length > 0) setEspanso(report[0].reportId);
      })
      .catch(() => {
        if (!annullato) setReportLista([]);
      });
    return () => {
      annullato = true;
    };
  }, [clienteId]);

  if (reportLista === null) {
    return <p className="text-sm text-ink-500">Caricamento…</p>;
  }

  const haCalcolatore = haValoriCalcolatore(calcolatoreBudget);

  if (reportLista.length === 0 && !haCalcolatore) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-ink-300 bg-surface-card p-8 text-center">
        <p className="text-sm text-ink-500">Nessun report commerciale né calcolatore di vendita collegato a questo cliente.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {haCalcolatore && (
        <div className="rounded-2xl border border-ink-300 bg-surface-card shadow-sm p-5 sm:p-6">
          <p className="text-sm font-semibold text-ink-900">Calcolatore Budget</p>
          <p className="text-xs text-ink-500 mt-0.5 mb-1">Proiezione compilata dal commerciale prima della vendita.</p>
          <SimulatoreRoi value={calcolatoreBudget} onChange={() => {}} editable={false} />
        </div>
      )}

      {reportLista.length > 0 && (
        <div className="space-y-3">
          {reportLista.map((r) => {
            const aperto = espanso === r.reportId;
            return (
              <div key={r.reportId} className="space-y-2">
                <button
                  type="button"
                  onClick={() => setEspanso(aperto ? null : r.reportId)}
                  className="w-full text-left px-5 py-3.5 flex items-center justify-between gap-3 rounded-2xl border border-ink-300 bg-surface-card shadow-sm transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-900 truncate">{r.dati.titolo || "(senza titolo)"}</p>
                    <p className="text-xs text-ink-500">{formatDataBreve(r.data)}</p>
                  </div>
                  <span className="text-ink-300 text-xs flex-shrink-0">{aperto ? "▲" : "▼"}</span>
                </button>

                {aperto && <ReportCommercialeView report={r.dati} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
