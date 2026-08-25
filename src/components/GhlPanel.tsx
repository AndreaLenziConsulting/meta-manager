"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { formatEuro, formatNumero } from "@/lib/format";
import type { GhlRiepilogoResponse } from "@/types/ghl";

/**
 * Pannello di sola lettura "Vendite e appuntamenti (GHL)" — Fase 1 dell'integrazione Go High
 * Level/Squadd. Dato deliberatamente separato dal Funnel/KPI esistente (vedi src/lib/kpi.ts, mai
 * toccato da questa feature): un tipo di risposta a parte (GhlRiepilogoResponse), niente scrittura
 * automatica, solo lettura diretta dall'account GHL del cliente al momento della richiesta.
 *
 * Nessun selettore di periodo qui in Fase 1 (mese corrente, stesso default del backend) — tenere
 * lo scope stretto finché il dato non è stato validato su più clienti reali.
 */
export function GhlPanel({ clienteId, sedeId }: { clienteId: string; sedeId?: string }) {
  const [stato, setStato] = useState<"caricamento" | "ok" | "errore">("caricamento");
  const [dati, setDati] = useState<GhlRiepilogoResponse | null>(null);
  const [erroreMsg, setErroreMsg] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve()
      .then(() => {
        setStato("caricamento");
        const params = new URLSearchParams({ clienteId });
        if (sedeId) params.set("sedeId", sedeId);
        return fetch(`/api/ghl?${params.toString()}`, { signal: controller.signal });
      })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Errore nel caricamento");
        setDati(body as GhlRiepilogoResponse);
        setStato("ok");
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setErroreMsg(err.message);
        setStato("errore");
      });
    return () => controller.abort();
  }, [clienteId, sedeId]);

  if (stato === "caricamento") {
    return <p className="text-sm text-ink-500">Caricamento dati GHL…</p>;
  }

  if (stato === "errore") {
    return (
      <Card>
        <p className="text-sm text-red-600">{erroreMsg}</p>
      </Card>
    );
  }

  if (dati && !dati.connesso) {
    return (
      <Card padding="lg" className="border-dashed text-center">
        <p className="text-sm font-semibold text-ink-900">Nessuna connessione GHL per questa sede</p>
        <p className="text-xs text-ink-500 mt-1">
          Collegala dalla scheda cliente nella Dashboard Amministratore (sezione Sedi) con un Private Integration
          Token generato dal proprio account GHL/Squadd.
        </p>
      </Card>
    );
  }

  if (!dati || !dati.connesso) return null;

  const { appuntamenti, opportunita, calendariConfigurati } = dati;
  const tessere = [
    { label: "Appuntamenti totali", value: formatNumero(appuntamenti.totali) },
    { label: "Confermati", value: formatNumero(appuntamenti.confermati) },
    { label: "Annullati", value: formatNumero(appuntamenti.annullati) },
    { label: "Vendite (opportunità vinte)", value: formatNumero(opportunita.vendite) },
    { label: "Fatturato", value: formatEuro(opportunita.fatturato) },
  ];

  return (
    <Card padding="lg">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-heading font-bold text-ink-900">Vendite e appuntamenti (GHL)</h3>
          <p className="text-xs text-ink-500 mt-0.5">
            Mese corrente, letto in diretta dal suo account GHL/Squadd — non ancora collegato al Funnel.
          </p>
        </div>
      </div>
      {!calendariConfigurati && (
        <p className="text-xs bg-yellow-50 border border-yellow-100 text-yellow-800 rounded-lg px-3 py-2.5 mb-4">
          Nessun calendario selezionato per questa connessione — gli appuntamenti restano a zero finché non scegli
          quali calendari includere (Dashboard Amministratore → modifica cliente → sezione Sedi).
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-5">
        {tessere.map((t) => (
          <div key={t.label}>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{t.label}</p>
            <p className="font-heading font-bold text-xl text-ink-900 mt-1 tabular-nums">{t.value}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-ink-500 mt-4 pt-3 border-t border-ink-300/60">
        Confermati e Annullati riflettono lo stato registrato su GHL, non equivalgono a Effettuato del Funnel: GHL
        non registra sempre se il cliente si è presentato davvero.
      </p>
    </Card>
  );
}
