"use client";

import { useState } from "react";
import type { Cliente, Consulente } from "@/types/kpi";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Props = {
  cliente: Cliente;
  consulenti: Consulente[];
  onClose: () => void;
  onSalvato: () => void;
};

export function ModificaClienteModal({ cliente, consulenti, onClose, onSalvato }: Props) {
  const [nome, setNome] = useState(cliente.nome);
  const [adAccountId, setAdAccountId] = useState(cliente.adAccountId);
  const [email, setEmail] = useState(cliente.email);
  const [consulenteId, setConsulenteId] = useState(cliente.consulenteId);
  const [targetCpa, setTargetCpa] = useState(cliente.targetCpa !== null ? String(cliente.targetCpa) : "");
  const [targetCpl, setTargetCpl] = useState(cliente.targetCpl !== null ? String(cliente.targetCpl) : "");
  const [tipoConversioneLead, setTipoConversioneLead] = useState(cliente.tipoConversioneLead);
  const [mostraTabExtra, setMostraTabExtra] = useState(cliente.mostraTabExtra);
  const [attivo, setAttivo] = useState(cliente.attivo);

  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setSalvando(true);
    try {
      const res = await fetch("/api/clienti", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId: cliente.clienteId,
          nome,
          adAccountId,
          email,
          consulenteId,
          targetCpa: targetCpa ? Number(targetCpa) : null,
          targetCpl: targetCpl ? Number(targetCpl) : null,
          tipoConversioneLead,
          mostraTabExtra,
          attivo,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Salvataggio non riuscito");
      onSalvato();
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal title="Modifica cliente" subtitle={cliente.clienteId} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nome cliente">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
        </Field>

        <Field label="Ad account Meta">
          <Input value={adAccountId} onChange={(e) => setAdAccountId(e.target.value)} placeholder="Solo cifre, senza act_" required />
        </Field>

        <Field label="Email cliente (opzionale)" hint="Per l'invio automatico del follow-up meeting">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>

        <Field label="Consulente di riferimento">
          <Select value={consulenteId} onChange={(e) => setConsulenteId(e.target.value)} required>
            {consulenti.map((c) => (
              <option key={c.consulenteId} value={c.consulenteId}>
                {c.nome}
                {!c.attivo ? " (disattivato)" : ""}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Target CPA (€, opzionale)">
            <Input type="number" step="0.01" value={targetCpa} onChange={(e) => setTargetCpa(e.target.value)} />
          </Field>
          <Field label="Target CPL (€, opzionale)">
            <Input type="number" step="0.01" value={targetCpl} onChange={(e) => setTargetCpl(e.target.value)} />
          </Field>
        </div>

        <Field
          label="Tipo conversione lead (opzionale)"
          hint="Action type esatto di Meta Insights da contare come lead — solo per clienti con tracciamento non standard (es. iscrizioni a webinar/eventi)."
        >
          <Input
            value={tipoConversioneLead}
            onChange={(e) => setTipoConversioneLead(e.target.value)}
            placeholder="Vuoto = usa la lista di default (Lead Ads classici)"
          />
        </Field>

        <div className="space-y-2 pt-1">
          <label className="flex items-center gap-2 text-xs text-ink-700 cursor-pointer">
            <input type="checkbox" checked={mostraTabExtra} onChange={(e) => setMostraTabExtra(e.target.checked)} className="accent-current text-brand" />
            Il cliente vede anche il tab Meeting (oltre a KPI)
          </label>
          <label className="flex items-center gap-2 text-xs text-ink-700 cursor-pointer">
            <input type="checkbox" checked={attivo} onChange={(e) => setAttivo(e.target.checked)} className="accent-current text-brand" />
            Cliente attivo
          </label>
        </div>

        {errore && <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-100 text-red-700 text-xs">{errore}</div>}

        <div className="flex gap-2 pt-2 border-t border-ink-300/60">
          <Button type="submit" disabled={salvando || !nome || !adAccountId || !consulenteId}>
            {salvando ? "Salvataggio…" : "Salva modifiche"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Annulla
          </Button>
        </div>
      </form>
    </Modal>
  );
}
