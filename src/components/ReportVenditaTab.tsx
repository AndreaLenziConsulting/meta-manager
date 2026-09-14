"use client";

import { useEffect, useState } from "react";
import { formatDataBreve } from "@/lib/format";
import { ReportCommercialeView } from "@/components/ReportCommercialeView";
import type { ReportCommercialeRow } from "@/types/prospect";

/**
 * Tab "Vendita" della scheda cliente — sola lettura, mai sul link pubblico (stesso gate `!code` di
 * Attività in SchedaCliente.tsx): storico dei report commerciali del prospect che si è convertito
 * in questo cliente, incluso il Calcolatore Budget compilato in fase di vendita (ticket medio,
 * margine, CPL, tassi, piano annuale stagionale) — dati che il consulente non vedrebbe altrimenti,
 * vedi GET /api/clienti/report-vendita. Stesso pattern a righe collassabili di ProspectTab.tsx, qui
 * sempre in sola lettura: nessun pulsante "Modifica report"/PDF/email, il report di vendita è
 * storico, non più editabile da qui (resta editabile solo dal prospect originale, se non ancora
 * disattivato).
 */
export function ReportVenditaTab({ clienteId }: { clienteId: string }) {
  const [reportLista, setReportLista] = useState<ReportCommercialeRow[] | null>(null);
  const [espanso, setEspanso] = useState<string | null>(null);

  useEffect(() => {
    let annullato = false;
    fetch(`/api/clienti/report-vendita?clienteId=${encodeURIComponent(clienteId)}`)
      .then((res) => res.json())
      .then((data: { report: ReportCommercialeRow[] }) => {
        if (annullato) return;
        const report = data.report ?? [];
        setReportLista(report);
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

  if (reportLista.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-ink-300 bg-surface-card p-8 text-center">
        <p className="text-sm text-ink-500">Nessun report commerciale di vendita collegato a questo cliente.</p>
      </div>
    );
  }

  return (
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
  );
}
