"use client";

import { useEffect, useState } from "react";
import { formatDataBreve } from "@/lib/format";
import { buildEmailTextCommerciale } from "@/lib/reportCommercialeEmail";
import { ReportCommercialeView } from "@/components/ReportCommercialeView";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import type { ReportCommercialeDataLoose, ReportCommercialeRow } from "@/types/prospect";

type Props = {
  prospectId: string;
  ragioneSociale: string;
  prospectEmail?: string;
};

/**
 * "Scarica PDF" / "Genera email di follow-up" — stesso schema di MeetingAzioni in MeetingTab.tsx
 * (stesso comportamento "lifted state" del testo email quando è nell'anteprima pre-salvataggio,
 * così una correzione a mano prima di salvare è quella davvero inviata).
 */
function ReportAzioni({
  prospectId,
  report,
  ragioneSociale,
  testoEmailControllato,
  onCambiaTestoEmail,
}: {
  prospectId: string;
  report: ReportCommercialeDataLoose;
  ragioneSociale: string;
  testoEmailControllato?: string | null;
  onCambiaTestoEmail?: (v: string | null) => void;
}) {
  const [scaricando, setScaricando] = useState(false);
  const [errorePdf, setErrorePdf] = useState<string | null>(null);
  const [mostraEmail, setMostraEmail] = useState(false);
  const [testoEmailInterno, setTestoEmailInterno] = useState<string | null>(null);
  const testoEmail = onCambiaTestoEmail ? (testoEmailControllato ?? null) : testoEmailInterno;
  const setTestoEmail = onCambiaTestoEmail ?? setTestoEmailInterno;
  const [copiato, setCopiato] = useState(false);

  async function handleScaricaPdf() {
    setScaricando(true);
    setErrorePdf(null);
    try {
      const res = await fetch("/api/report-commerciale/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId, report }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Errore generazione PDF");
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      const slug = (ragioneSociale || report.titolo || "report").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
      const dataSlug = (report.data || "").replace(/\//g, "-");
      a.download = `report-${slug}${dataSlug ? `-${dataSlug}` : ""}.pdf`;
      a.click();
      URL.revokeObjectURL(objUrl);
    } catch (err) {
      setErrorePdf(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setScaricando(false);
    }
  }

  function handleGeneraEmail() {
    if (!mostraEmail) setTestoEmail(buildEmailTextCommerciale(report, ragioneSociale, ""));
    setMostraEmail((v) => !v);
  }

  async function handleCopiaEmail() {
    if (!testoEmail) return;
    await navigator.clipboard.writeText(testoEmail);
    setCopiato(true);
    setTimeout(() => setCopiato(false), 2500);
  }

  return (
    <div className="pt-3 mt-3 border-t border-ink-300/60 space-y-2.5">
      <div className="flex flex-wrap gap-2.5">
        <Button type="button" variant="secondary" onClick={handleScaricaPdf} disabled={scaricando}>
          {scaricando ? "Generazione PDF…" : "Scarica PDF"}
        </Button>
        <Button type="button" variant="secondary" onClick={handleGeneraEmail}>
          {mostraEmail ? "Nascondi email" : "Genera email di follow-up"}
        </Button>
      </div>
      {errorePdf && <p className="text-xs text-red-600">{errorePdf}</p>}
      {mostraEmail && testoEmail !== null && (
        <div className="space-y-1.5">
          <textarea
            className="w-full rounded-xl border border-ink-300 px-3 py-2.5 text-xs leading-relaxed outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition resize-none"
            rows={8}
            value={testoEmail}
            onChange={(e) => setTestoEmail(e.target.value)}
          />
          <Button type="button" onClick={handleCopiaEmail}>
            {copiato ? "Copiato ✓" : "Copia email"}
          </Button>
        </div>
      )}
    </div>
  );
}

export function ProspectTab({ prospectId, ragioneSociale, prospectEmail }: Props) {
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [reportLista, setReportLista] = useState<ReportCommercialeRow[] | null>(null);
  const [espanso, setEspanso] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const [mostraForm, setMostraForm] = useState(false);
  const [url, setUrl] = useState("");
  const [estraendo, setEstraendo] = useState(false);
  const [anteprima, setAnteprima] = useState<ReportCommercialeDataLoose | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroreForm, setErroreForm] = useState<string | null>(null);

  const [inviaAutomatica, setInviaAutomatica] = useState(!!prospectEmail);
  const [emailBozza, setEmailBozza] = useState<string | null>(null);
  const [esitoInvio, setEsitoInvio] = useState<{ inviata: boolean; errore: string | null } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [bozza, setBozza] = useState<ReportCommercialeDataLoose | null>(null);
  const [salvandoEdit, setSalvandoEdit] = useState(false);
  const [erroreEdit, setErroreEdit] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve()
      .then(() => {
        setCaricamento(true);
        setErrore(null);
        return fetch(`/api/report-commerciale?prospectId=${encodeURIComponent(prospectId)}`, { signal: controller.signal });
      })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Errore nel caricamento dei report");
        }
        return res.json();
      })
      .then((data: { report: ReportCommercialeRow[] }) => setReportLista(data.report))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setErrore(err.message);
      })
      .finally(() => setCaricamento(false));

    return () => controller.abort();
  }, [prospectId, refreshTick]);

  async function handleEstrai(e: React.FormEvent) {
    e.preventDefault();
    setEstraendo(true);
    setErroreForm(null);
    setEsitoInvio(null);
    try {
      const res = await fetch("/api/report-commerciale/estrai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId, url }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Estrazione non riuscita");
      // Ragione sociale/tipo business/fatturato/sedi: quanto già salvato sul prospect resta come
      // base, l'estrazione lo sovrascrive solo se ha trovato qualcosa di non vuoto — vedi memoria
      // di progetto ("salvato come impostazione del cliente").
      const estratto = body as ReportCommercialeDataLoose;
      setAnteprima({
        ...estratto,
        ragioneSociale: estratto.ragioneSociale || ragioneSociale,
      });
      setInviaAutomatica(!!prospectEmail);
      setEmailBozza(null);
    } catch (err) {
      setErroreForm(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setEstraendo(false);
    }
  }

  async function handleSalva() {
    if (!anteprima) return;
    setSalvando(true);
    setErroreForm(null);
    try {
      const res = await fetch("/api/report-commerciale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospectId,
          report: anteprima,
          inviaEmailAutomatica: inviaAutomatica,
          testoEmailBozza: emailBozza ?? undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Salvataggio non riuscito");
      if (inviaAutomatica && !body.aggiornato) {
        setEsitoInvio({ inviata: !!body.emailInviata, errore: body.erroreEmail ?? (body.emailInviata ? null : "errore sconosciuto") });
      }
      setAnteprima(null);
      setUrl("");
      setMostraForm(false);
      setRefreshTick((t) => t + 1);
    } catch (err) {
      setErroreForm(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSalvando(false);
    }
  }

  function iniziaModifica(r: ReportCommercialeRow) {
    setEditingId(r.reportId);
    setBozza({ ...r.dati });
    setErroreEdit(null);
  }

  function annullaModifica() {
    setEditingId(null);
    setBozza(null);
    setErroreEdit(null);
  }

  async function salvaModifica() {
    if (!bozza) return;
    setSalvandoEdit(true);
    setErroreEdit(null);
    try {
      const res = await fetch("/api/report-commerciale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId, report: bozza }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Salvataggio non riuscito");
      setEditingId(null);
      setBozza(null);
      setRefreshTick((t) => t + 1);
    } catch (err) {
      setErroreEdit(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSalvandoEdit(false);
    }
  }

  if (caricamento && !reportLista) return <p className="text-sm text-ink-500">Caricamento…</p>;
  if (errore && !reportLista) return <p className="text-sm text-red-600">{errore}</p>;

  return (
    <div className="space-y-3">
      {errore && <p className="text-sm text-red-600">{errore}</p>}

      {esitoInvio && (
        <div
          className={`rounded-xl border p-3 flex items-start justify-between gap-3 text-xs ${
            esitoInvio.inviata ? "bg-green-50 border-green-100 text-green-700" : "bg-yellow-50 border-yellow-100 text-yellow-800"
          }`}
        >
          <p>
            {esitoInvio.inviata
              ? `Report salvato ed email inviata${prospectEmail ? ` a ${prospectEmail}` : ""}.`
              : `Report salvato, ma l'invio email non è riuscito: ${esitoInvio.errore}. Usa "Genera email di follow-up" sul report salvato per copiarla a mano.`}
          </p>
          <button type="button" onClick={() => setEsitoInvio(null)} className="text-current opacity-60 hover:opacity-100 flex-shrink-0 cursor-pointer" aria-label="Chiudi">
            ×
          </button>
        </div>
      )}

      {!anteprima && (
        <div className="rounded-2xl border border-ink-300 bg-surface-card shadow-sm p-4">
          {!mostraForm ? (
            <Button type="button" onClick={() => setMostraForm(true)}>
              + Nuovo report
            </Button>
          ) : (
            <form onSubmit={handleEstrai} className="space-y-2">
              <Field label="Link della chiamata (Fathom, Circleback o Loom)">
                <div className="flex flex-wrap gap-2">
                  <Input
                    className="flex-1 min-w-[220px]"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://…"
                    required
                  />
                  <Button type="submit" disabled={estraendo || !url}>
                    {estraendo ? "Estrazione…" : "Estrai"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setMostraForm(false);
                      setUrl("");
                      setErroreForm(null);
                    }}
                  >
                    Annulla
                  </Button>
                </div>
              </Field>
              {estraendo && (
                <p className="text-xs text-ink-500">
                  Estrazione in corso — scraping della pagina più lettura del modello, con eventuale nuovo
                  tentativo automatico in caso di errore transitorio: può richiedere fino a due minuti e mezzo…
                </p>
              )}
              {erroreForm && <p className="text-xs text-red-600">{erroreForm}</p>}
            </form>
          )}
        </div>
      )}

      {anteprima && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-ink-900">Anteprima — verifica e modifica prima di salvare</h4>

          <ReportCommercialeView report={anteprima} onChange={(u) => setAnteprima({ ...anteprima, ...u })} />

          <ReportAzioni
            prospectId={prospectId}
            report={anteprima}
            ragioneSociale={ragioneSociale}
            testoEmailControllato={emailBozza}
            onCambiaTestoEmail={setEmailBozza}
          />

          <label className={`flex items-center gap-2 text-xs pt-1 ${prospectEmail ? "text-ink-700 cursor-pointer" : "text-ink-300"}`}>
            <input
              type="checkbox"
              checked={inviaAutomatica}
              disabled={!prospectEmail}
              onChange={(e) => setInviaAutomatica(e.target.checked)}
              className="accent-current text-brand"
            />
            {prospectEmail
              ? `Invia email al prospect in automatico (a ${prospectEmail}, con PDF allegato)`
              : "Invia email al prospect in automatico — aggiungi l'email del prospect per abilitarlo"}
          </label>

          {erroreForm && <p className="text-xs text-red-600">{erroreForm}</p>}

          <div className="flex gap-2 pt-2 border-t border-ink-300/60">
            <Button type="button" onClick={handleSalva} disabled={salvando}>
              {salvando ? (inviaAutomatica ? "Salvataggio e invio…" : "Salvataggio…") : "Salva"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAnteprima(null)}>
              Annulla
            </Button>
          </div>
        </div>
      )}

      {reportLista?.length === 0 && !anteprima && (
        <div className="rounded-2xl border-2 border-dashed border-ink-300 bg-surface-card p-8 text-center">
          <p className="text-sm text-ink-500">Nessun report registrato.</p>
        </div>
      )}

      {reportLista?.map((r) => {
        const aperto = espanso === r.reportId;
        const inModifica = editingId === r.reportId && bozza;
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

            {aperto && inModifica && bozza && (
              <div className="space-y-3">
                <ReportCommercialeView report={bozza} onChange={(u) => setBozza({ ...bozza, ...u })} />
                {erroreEdit && <p className="text-xs text-red-600">{erroreEdit}</p>}
                <div className="flex gap-2">
                  <Button type="button" onClick={salvaModifica} disabled={salvandoEdit}>
                    {salvandoEdit ? "Salvataggio…" : "Salva modifiche"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={annullaModifica}>
                    Annulla
                  </Button>
                </div>
              </div>
            )}

            {aperto && !inModifica && (
              <div className="space-y-3">
                <ReportCommercialeView report={r.dati} />
                <div className="flex justify-end">
                  <button type="button" onClick={() => iniziaModifica(r)} className="text-xs font-semibold text-brand hover:underline cursor-pointer">
                    ✎ Modifica report
                  </button>
                </div>
                <ReportAzioni prospectId={prospectId} report={r.dati} ragioneSociale={ragioneSociale} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
