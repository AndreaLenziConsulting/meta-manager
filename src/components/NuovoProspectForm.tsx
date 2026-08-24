"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

/** Crea un nuovo prospect — form minimo (solo ragione sociale obbligatoria) e naviga subito al suo dettaglio. */
export function NuovoProspectForm() {
  const router = useRouter();
  const [attivo, setAttivo] = useState(false);
  const [ragioneSociale, setRagioneSociale] = useState("");
  const [tipoBusiness, setTipoBusiness] = useState("");
  const [fatturato, setFatturato] = useState("");
  const [sedi, setSedi] = useState("");
  const [email, setEmail] = useState("");
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
        body: JSON.stringify({ ragioneSociale, tipoBusiness, fatturato, sedi, email }),
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Tipo business (opzionale)">
          <Input value={tipoBusiness} onChange={(e) => setTipoBusiness(e.target.value)} placeholder="Es. impiantistica industriale" />
        </Field>
        <Field label="Fatturato (opzionale)">
          <Input value={fatturato} onChange={(e) => setFatturato(e.target.value)} placeholder="Es. ~500k€/anno" />
        </Field>
        <Field label="Sedi (opzionale)">
          <Input value={sedi} onChange={(e) => setSedi(e.target.value)} placeholder="Es. 2 sedi, Milano e Bergamo" />
        </Field>
        <Field label="Email prospect (opzionale)" hint="Per l'invio automatico dei report">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      </div>
      {errore && <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-100 text-red-700 text-xs">{errore}</div>}
      <div className="flex gap-2">
        <Button type="submit" disabled={creando || !ragioneSociale}>
          {creando ? "Creazione…" : "Crea prospect"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setAttivo(false)}>
          Annulla
        </Button>
      </div>
    </form>
  );
}
