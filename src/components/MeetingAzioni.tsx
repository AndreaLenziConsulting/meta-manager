"use client";

import { useState } from "react";
import { FileDown, Mail } from "lucide-react";
import { buildEmailText } from "@/lib/meetingEmail";
import type { MeetingDataLoose } from "@/types/meeting";

const inputClass =
  "w-full rounded-xl border border-ink-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition";

/**
 * Bottoni "Scarica PDF" / "Genera email di follow-up" — porting delle azioni di Fast Report
 * (`handleDownloadPDF`/`EmailTemplate.tsx`), montato sia sull'anteprima pre-salvataggio
 * (NuovoMeetingForm.tsx) sia su ogni meeting già salvato nello storico (MeetingTab.tsx) — possibile
 * solo perché qui c'è uno storico persistente, che Fast Report non aveva. Estratto nel suo file
 * (09/09/2026, caricamento registrazione anche dal menù generale) perché serve a entrambi: prima
 * viveva solo dentro MeetingTab.tsx, ora andrebbe duplicato o importato da un componente che non
 * lo possiede più esclusivamente. Solo contesto team: /api/meeting/pdf richiede sessione.
 *
 * `testoEmailControllato`/`onCambiaTestoEmail` (opzionali): se presenti, il testo dell'email vive
 * nello stato del genitore invece che qui — serve solo all'istanza nell'anteprima, dove il testo
 * (eventualmente corretto a mano) deve essere quello davvero usato dall'invio automatico al
 * salvataggio, non uno rigenerato da zero. Le istanze nello storico restano non controllate,
 * comportamento invariato: lì l'invio automatico non si applica.
 */
export function MeetingAzioni({
  clienteId,
  meeting,
  clienteNome,
  testoEmailControllato,
  onCambiaTestoEmail,
}: {
  clienteId: string;
  meeting: MeetingDataLoose;
  clienteNome?: string;
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
      const res = await fetch("/api/meeting/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, meeting }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Errore generazione PDF");
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      const clienteSlug = (clienteNome || meeting.title || "meeting")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 40);
      const dataSlug = (meeting.dataConsulenza || meeting.date || "").replace(/\//g, "-");
      a.download = `report-${clienteSlug}${dataSlug ? `-${dataSlug}` : ""}.pdf`;
      a.click();
      URL.revokeObjectURL(objUrl);
    } catch (err) {
      setErrorePdf(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setScaricando(false);
    }
  }

  function handleGeneraEmail() {
    if (!mostraEmail) setTestoEmail(buildEmailText(meeting, clienteNome ?? ""));
    setMostraEmail((v) => !v);
  }

  async function handleCopiaEmail() {
    if (!testoEmail) return;
    await navigator.clipboard.writeText(testoEmail);
    setCopiato(true);
    setTimeout(() => setCopiato(false), 2500);
  }

  return (
    <div className="pt-3 mt-3 border-t border-ink-300/40 space-y-2.5">
      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={handleScaricaPdf}
          disabled={scaricando}
          className="inline-flex items-center gap-1.5 rounded-xl border-2 border-brand text-sm font-semibold px-4 py-2 text-brand hover:bg-brand-light disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer active:scale-[.98]"
        >
          {scaricando ? (
            "Generazione PDF…"
          ) : (
            <>
              <FileDown size={14} className="flex-shrink-0" />
              Scarica PDF
            </>
          )}
        </button>
        <button
          type="button"
          onClick={handleGeneraEmail}
          className="inline-flex items-center gap-1.5 rounded-xl border-2 border-brand text-sm font-semibold px-4 py-2 text-brand hover:bg-brand-light transition cursor-pointer active:scale-[.98]"
        >
          <Mail size={14} className="flex-shrink-0" />
          {mostraEmail ? "Nascondi email" : "Genera email di follow-up"}
        </button>
      </div>
      {errorePdf && <p className="text-xs text-red-600">{errorePdf}</p>}
      {mostraEmail && testoEmail !== null && (
        <div className="space-y-1.5">
          <textarea
            className={`${inputClass} resize-none text-xs leading-relaxed`}
            rows={8}
            value={testoEmail}
            onChange={(e) => setTestoEmail(e.target.value)}
          />
          <button
            type="button"
            onClick={handleCopiaEmail}
            className="rounded-xl bg-cta hover:bg-cta-dark text-white text-sm font-semibold px-4 py-2 transition cursor-pointer active:scale-[.98]"
          >
            {copiato ? "Copiato ✓" : "Copia email"}
          </button>
        </div>
      )}
    </div>
  );
}
