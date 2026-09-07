"use client";

import { useState } from "react";
import type { Prospect } from "@/types/prospect";
import { formatEuro } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

/**
 * Hand-off commerciale→consulente: crea il Cliente reale a partire da questo prospect (vedi POST
 * /api/prospect/converti). Nome/email/cartella Drive sono precompilati dal prospect (il nome resta
 * editabile: la ragione sociale non è sempre il nome commerciale giusto per la scheda cliente);
 * consulente/prodotto/ad account/target ads non hanno un corrispettivo sul prospect e vanno scelti
 * qui da zero — il riepilogo dei dati commerciali del prospect sotto serve da riferimento per
 * questa scelta, non viene passato automaticamente.
 */
export function ConvertiProspectModal({
  prospect,
  consulenti,
  prodotti,
  onClose,
}: {
  prospect: Prospect;
  consulenti: { consulenteId: string; nome: string }[];
  prodotti: { prodottoId: string; nome: string }[];
  onClose: () => void;
}) {
  const [nome, setNome] = useState(prospect.ragioneSociale);
  const [email, setEmail] = useState(prospect.email);
  const [consulenteId, setConsulenteId] = useState("");
  const [prodottoId, setProdottoId] = useState("");
  const [dataInizioProgetto, setDataInizioProgetto] = useState("");
  const [adAccountId, setAdAccountId] = useState("");
  const [targetCpa, setTargetCpa] = useState("");
  const [targetCpl, setTargetCpl] = useState("");

  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const haDatiCommercialiProspect =
    prospect.mediaBudgetMensile !== null ||
    prospect.targetCpl !== null ||
    prospect.targetCpaAppuntamento !== null ||
    prospect.targetFatturatoMensile !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setSalvando(true);
    try {
      const res = await fetch("/api/prospect/converti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospectId: prospect.prospectId,
          nome,
          email,
          consulenteId,
          prodottoId,
          dataInizioProgetto: prodottoId ? dataInizioProgetto : "",
          adAccountId,
          targetCpa: targetCpa ? Number(targetCpa) : null,
          targetCpl: targetCpl ? Number(targetCpl) : null,
          driveFolderUrl: prospect.driveFolderUrl,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Conversione non riuscita");
      // Navigazione "piena" (non router.push): stesso motivo di "Vai alla scheda cliente" in
      // NuovoClienteForm.tsx — lascia la pagina prospect per una del tutto nuova appena scritta,
      // niente da guadagnare da una transizione client-side qui.
      window.location.href = `/dashboard/cliente/${encodeURIComponent(body.clienteId)}`;
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
      setSalvando(false);
    }
  }

  return (
    <Modal title="Converti in cliente" subtitle={prospect.ragioneSociale} onClose={onClose} maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nome cliente">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
        </Field>

        <Field label="Email cliente (opzionale)" hint="Per l'invio automatico del follow-up meeting — più indirizzi separati da virgola">
          <Input type="email" multiple value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>

        <Field label="Consulente di riferimento">
          <Select value={consulenteId} onChange={(e) => setConsulenteId(e.target.value)} required>
            <option value="" disabled>
              Seleziona…
            </option>
            {consulenti.map((c) => (
              <option key={c.consulenteId} value={c.consulenteId}>
                {c.nome}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Ad account Meta (opzionale)">
            <Input value={adAccountId} onChange={(e) => setAdAccountId(e.target.value)} placeholder="Solo cifre, senza act_" />
          </Field>
          <div />
          <Field label="Target CPA (€, opzionale)" hint="Costo per vendita — sulla Sede, non lo stesso del target commerciale sotto">
            <Input type="number" step="0.01" value={targetCpa} onChange={(e) => setTargetCpa(e.target.value)} />
          </Field>
          <Field label="Target CPL (€, opzionale)">
            <Input type="number" step="0.01" value={targetCpl} onChange={(e) => setTargetCpl(e.target.value)} />
          </Field>
        </div>

        <div>
          <Field label="Prodotto (opzionale)" hint="Se scegli un prodotto, la roadmap di attività viene generata subito.">
            <Select value={prodottoId} onChange={(e) => setProdottoId(e.target.value)}>
              <option value="">Nessuno</option>
              {prodotti.map((p) => (
                <option key={p.prodottoId} value={p.prodottoId}>
                  {p.nome}
                </option>
              ))}
            </Select>
          </Field>
          {prodottoId && (
            <div className="mt-3">
              <Field label="Data inizio progetto">
                <Input type="date" value={dataInizioProgetto} onChange={(e) => setDataInizioProgetto(e.target.value)} required />
              </Field>
            </div>
          )}
        </div>

        {haDatiCommercialiProspect && (
          <div className="rounded-xl border border-ink-300 bg-surface p-3 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">
              Dati commerciali del prospect — solo di riferimento, non copiati sopra
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-ink-700">
              <span>Budget/mese: <b>{formatEuro(prospect.mediaBudgetMensile)}</b></span>
              <span>Target CPL: <b>{formatEuro(prospect.targetCpl)}</b></span>
              <span>Target CPA appunt.: <b>{formatEuro(prospect.targetCpaAppuntamento)}</b></span>
              <span>Fatturato/mese atteso: <b>{formatEuro(prospect.targetFatturatoMensile)}</b></span>
            </div>
          </div>
        )}

        {prospect.driveFolderUrl && (
          <p className="text-xs text-ink-500">La cartella Drive del prospect verrà collegata anche al nuovo cliente.</p>
        )}

        {errore && <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-100 text-red-700 text-xs">{errore}</div>}

        <div className="flex gap-2 pt-2 border-t border-ink-300/60">
          <Button type="submit" disabled={salvando || !nome || !consulenteId}>
            {salvando ? "Conversione…" : "Crea cliente"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Annulla
          </Button>
        </div>
      </form>
    </Modal>
  );
}
