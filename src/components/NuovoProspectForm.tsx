"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";

/**
 * Crea un nuovo prospect — form ridotto al minimo: solo ragione sociale (serve per identificarlo
 * prima ancora di avere un report) ed email (mai estratta dalla chiamata, quindi l'unica in più
 * che vale la pena chiedere qui). Tipo business/fatturato/sedi NON si chiedono più a questo punto:
 * sono tra i campi che l'estrazione AI popola dal primo report, chiederli anche qui sarebbe lavoro
 * doppio (feedback diretto dell'utente).
 *
 * `commerciali` presente = form usato dall'admin (vedi dashboard/commerciale/page.tsx): un
 * commerciale crea sempre per sé stesso (nessun selettore, assegnazione implicita lato server),
 * l'admin deve scegliere esplicitamente a chi assegnare il prospect — mai un default, un prospect
 * senza commerciale non comparirebbe a nessuno in prospectVisibili.
 */
export function NuovoProspectForm({ commerciali }: { commerciali?: { commercialeId: string; nome: string }[] }) {
  const router = useRouter();
  const [attivo, setAttivo] = useState(false);
  const [ragioneSociale, setRagioneSociale] = useState("");
  const [email, setEmail] = useState("");
  const [commercialeId, setCommercialeId] = useState("");
  const [creando, setCreando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  if (!attivo) {
    return (
      <Button type="button" onClick={() => setAttivo(true)}>
        + Nuovo prospect
      </Button>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setCreando(true);
    try {
      const res = await fetch("/api/prospect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ragioneSociale, email, commercialeId: commerciali ? commercialeId : undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Creazione non riuscita");
      router.push(`/dashboard/commerciale/${encodeURIComponent(body.prospectId)}`);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
      setCreando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-ink-300 bg-surface-card shadow-sm p-5 space-y-3">
      <Field label="Ragione sociale">
        <Input value={ragioneSociale} onChange={(e) => setRagioneSociale(e.target.value)} placeholder="Es. Rossi Impianti Srl" required autoFocus />
      </Field>
      {commerciali && (
        <Field label="Commerciale di riferimento">
          <Select value={commercialeId} onChange={(e) => setCommercialeId(e.target.value)} required>
            <option value="" disabled>
              Seleziona…
            </option>
            {commerciali.map((c) => (
              <option key={c.commercialeId} value={c.commercialeId}>
                {c.nome}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Email prospect (opzionale)" hint="Per l'invio automatico dei report — il resto (tipo business, fatturato, sedi) lo popola l'estrazione dal primo report">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      {errore && <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-100 text-red-700 text-xs">{errore}</div>}
      <div className="flex gap-2">
        <Button type="submit" disabled={creando || !ragioneSociale || (!!commerciali && !commercialeId)}>
          {creando ? "Creazione…" : "Crea prospect"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setAttivo(false)}>
          Annulla
        </Button>
      </div>
    </form>
  );
}
