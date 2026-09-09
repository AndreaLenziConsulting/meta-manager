"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, CheckCircle2, Send, Trash2 } from "lucide-react";
import type { Prospect } from "@/types/prospect";
import { formatEuro, formatNumero } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ConfermaEliminazioneModal } from "@/components/ui/ConfermaEliminazioneModal";
import { ConvertiProspectModal } from "@/components/ConvertiProspectModal";

function haDatiCommerciali(p: Prospect): boolean {
  return (
    !!p.driveFolderUrl ||
    p.mediaBudgetMensile !== null ||
    p.targetCpl !== null ||
    p.targetCpaAppuntamento !== null ||
    p.targetLeadSettimana !== null ||
    p.targetAppuntamentiSettimana !== null ||
    p.targetFatturatoMensile !== null ||
    p.targetMargineVenditaPct !== null
  );
}

/** Come tassoAppuntamento/tassoChiusura di ScenarioRoi — 0-100, non una frazione: mai
 * formatPercentuale (si aspetta 0-1, moltiplicherebbe per 100 una seconda volta). */
function formatPct(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

/**
 * Pannello "Dati commerciali" del prospect — i parametri/target impostabili già in questa fase
 * (link cartella Drive, budget media, target CPL/CPA appuntamento/lead-settimana/appuntamenti-
 * settimana/fatturato mensile, margine medio per vendita — vedi types/prospect.ts), sempre
 * compilati a mano qui, stesso spirito di ScenarioRoi in SimulatoreRoi.tsx ma persistenti sul
 * Prospect invece che scenario per scenario e ricorrenti a ogni report. Non ancora consumati da
 * nessun indicatore/calcolo (vedi commento sul tipo Prospect) — per ora solo storage + editing.
 */
export function ProspectDatiCommerciali({
  prospect,
  ruoloAdmin,
  ruoloCommerciale,
  consulenti,
  prodotti,
}: {
  prospect: Prospect;
  // Hand-off commerciale→consulente in due passi: il commerciale propone (sceglie un consulente da
  // suggerire), solo l'admin esegue davvero la conversione (vedi POST /api/prospect/converti, stesso
  // gate di POST /api/clienti). `consulenti` assente = niente da mostrare a nessuno dei due ruoli;
  // `prodotti` serve solo alla conversione vera, quindi solo all'admin.
  ruoloAdmin?: boolean;
  ruoloCommerciale?: boolean;
  consulenti?: { consulenteId: string; nome: string }[];
  prodotti?: { prodottoId: string; nome: string }[];
}) {
  const router = useRouter();
  const [modificaAperta, setModificaAperta] = useState(false);
  const [conversioneAperta, setConversioneAperta] = useState(false);
  const [propostaAperta, setPropostaAperta] = useState(false);
  const [confermaEliminaAperta, setConfermaEliminaAperta] = useState(false);
  const convertito = Boolean(prospect.clienteId);
  const proposto = !convertito && Boolean(prospect.consulenteSuggeritoId);
  const nomeConsulenteSuggerito = consulenti?.find((c) => c.consulenteId === prospect.consulenteSuggeritoId)?.nome;

  return (
    <div className="rounded-2xl border border-ink-300 bg-surface-card shadow-sm p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-semibold text-ink-900">Dati commerciali</p>
        <div className="flex items-center gap-3">
          {convertito ? (
            <Link
              href={`/dashboard/cliente/${encodeURIComponent(prospect.clienteId)}`}
              className="flex items-center gap-1.5 text-xs font-semibold text-green-700 hover:underline"
            >
              <CheckCircle2 size={14} /> Convertito in cliente
            </Link>
          ) : (
            <>
              {proposto && (
                <span className="text-xs font-semibold text-brand flex items-center gap-1.5">
                  <Send size={13} />
                  {ruoloAdmin
                    ? `Proposto${nomeConsulenteSuggerito ? ` — consulente suggerito: ${nomeConsulenteSuggerito}` : ""}`
                    : "In attesa di conversione da parte dell'admin"}
                </span>
              )}
              {ruoloAdmin && consulenti && prodotti && (
                <Button type="button" size="sm" variant="ghost" onClick={() => setConversioneAperta(true)}>
                  Converti in cliente
                </Button>
              )}
              {ruoloCommerciale && consulenti && (
                <Button type="button" size="sm" variant="ghost" onClick={() => setPropostaAperta(true)}>
                  {proposto ? "Modifica proposta" : "Segnala come vinto"}
                </Button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => setModificaAperta(true)}
            className="text-ink-500 hover:text-brand transition cursor-pointer"
            aria-label="Modifica dati commerciali"
          >
            <Pencil size={14} />
          </button>
          {ruoloAdmin && !convertito && (
            <button
              type="button"
              onClick={() => setConfermaEliminaAperta(true)}
              className="text-ink-500 hover:text-red-600 transition cursor-pointer"
              aria-label="Elimina prospect"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {haDatiCommerciali(prospect) ? (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
          <Dato label="Media budget/mese" value={formatEuro(prospect.mediaBudgetMensile)} />
          <Dato label="Target CPL" value={formatEuro(prospect.targetCpl)} />
          <Dato label="Target CPA appuntamento" value={formatEuro(prospect.targetCpaAppuntamento)} />
          <Dato label="Target fatturato/mese" value={formatEuro(prospect.targetFatturatoMensile)} />
          <Dato label="Target lead/sett." value={formatNumero(prospect.targetLeadSettimana)} />
          <Dato label="Target appuntamenti/sett." value={formatNumero(prospect.targetAppuntamentiSettimana)} />
          <Dato label="Margine medio su vendita" value={formatPct(prospect.targetMargineVenditaPct)} />
          {prospect.driveFolderUrl && (
            <div className="col-span-2 sm:col-span-4">
              <p className="text-[10px] uppercase tracking-wide text-ink-500">Cartella Drive</p>
              <a
                href={prospect.driveFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-brand hover:underline break-all"
              >
                {prospect.driveFolderUrl}
              </a>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-ink-500 mt-2">Nessun dato commerciale impostato ancora.</p>
      )}

      {modificaAperta && (
        <ModificaDatiCommercialiModal
          prospect={prospect}
          onClose={() => setModificaAperta(false)}
          onSalvato={() => {
            setModificaAperta(false);
            router.refresh();
          }}
        />
      )}

      {conversioneAperta && consulenti && prodotti && (
        <ConvertiProspectModal
          prospect={prospect}
          consulenti={consulenti}
          prodotti={prodotti}
          onClose={() => setConversioneAperta(false)}
        />
      )}

      {propostaAperta && consulenti && (
        <ProponiConversioneModal
          prospect={prospect}
          consulenti={consulenti}
          onClose={() => setPropostaAperta(false)}
          onSalvato={() => {
            setPropostaAperta(false);
            router.refresh();
          }}
        />
      )}

      {confermaEliminaAperta && (
        <ConfermaEliminazioneModal
          titolo="Eliminare questo prospect?"
          messaggio="Elimina anche tutti i suoi report commerciali. Azione irreversibile."
          onClose={() => setConfermaEliminaAperta(false)}
          onConferma={async () => {
            const res = await fetch("/api/prospect/elimina", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prospectId: prospect.prospectId }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || "Eliminazione non riuscita");
            router.push("/dashboard/commerciale");
          }}
        />
      )}
    </div>
  );
}

/**
 * Il commerciale segna un prospect come vinto e suggerisce (facoltativo) un consulente — solo un
 * PATCH /api/prospect su un campo in più (stesso endpoint già usato per i dati commerciali sopra),
 * non crea nulla: la conversione vera resta all'admin (ConvertiProspectModal sopra).
 */
function ProponiConversioneModal({
  prospect,
  consulenti,
  onClose,
  onSalvato,
}: {
  prospect: Prospect;
  consulenti: { consulenteId: string; nome: string }[];
  onClose: () => void;
  onSalvato: () => void;
}) {
  const [consulenteSuggeritoId, setConsulenteSuggeritoId] = useState(prospect.consulenteSuggeritoId);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const giaProposto = Boolean(prospect.consulenteSuggeritoId);

  async function salva(nuovoValore: string) {
    setErrore(null);
    setSalvando(true);
    try {
      const res = await fetch("/api/prospect", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId: prospect.prospectId, consulenteSuggeritoId: nuovoValore }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Salvataggio non riuscito");
      onSalvato();
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
      setSalvando(false);
    }
  }

  return (
    <Modal title="Segnala come vinto" subtitle={prospect.ragioneSociale} onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-4">
        <p className="text-xs text-ink-500">
          Segnala all&apos;amministratore che questo prospect è pronto per diventare cliente. Il consulente è solo un
          suggerimento — la scelta finale resta all&apos;admin in fase di conversione.
        </p>
        <Field label="Consulente suggerito (opzionale)">
          <Select value={consulenteSuggeritoId} onChange={(e) => setConsulenteSuggeritoId(e.target.value)}>
            <option value="">Nessuno in particolare</option>
            {consulenti.map((c) => (
              <option key={c.consulenteId} value={c.consulenteId}>
                {c.nome}
              </option>
            ))}
          </Select>
        </Field>

        {errore && <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-100 text-red-700 text-xs">{errore}</div>}

        <div className="flex gap-2 pt-2 border-t border-ink-300/60">
          <Button type="button" disabled={salvando} onClick={() => salva(consulenteSuggeritoId)}>
            {salvando ? "Salvataggio…" : "Segnala all'admin"}
          </Button>
          {giaProposto && (
            <Button type="button" variant="ghost" disabled={salvando} onClick={() => salva("")}>
              Ritira proposta
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={onClose}>
            Annulla
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-ink-500">{label}</p>
      <p className="text-sm font-semibold text-ink-900 tabular-nums">{value}</p>
    </div>
  );
}

function ModificaDatiCommercialiModal({
  prospect,
  onClose,
  onSalvato,
}: {
  prospect: Prospect;
  onClose: () => void;
  onSalvato: () => void;
}) {
  const [driveFolderUrl, setDriveFolderUrl] = useState(prospect.driveFolderUrl);
  const [mediaBudgetMensile, setMediaBudgetMensile] = useState(
    prospect.mediaBudgetMensile !== null ? String(prospect.mediaBudgetMensile) : ""
  );
  const [targetCpl, setTargetCpl] = useState(prospect.targetCpl !== null ? String(prospect.targetCpl) : "");
  const [targetCpaAppuntamento, setTargetCpaAppuntamento] = useState(
    prospect.targetCpaAppuntamento !== null ? String(prospect.targetCpaAppuntamento) : ""
  );
  const [targetLeadSettimana, setTargetLeadSettimana] = useState(
    prospect.targetLeadSettimana !== null ? String(prospect.targetLeadSettimana) : ""
  );
  const [targetAppuntamentiSettimana, setTargetAppuntamentiSettimana] = useState(
    prospect.targetAppuntamentiSettimana !== null ? String(prospect.targetAppuntamentiSettimana) : ""
  );
  const [targetFatturatoMensile, setTargetFatturatoMensile] = useState(
    prospect.targetFatturatoMensile !== null ? String(prospect.targetFatturatoMensile) : ""
  );
  const [targetMargineVenditaPct, setTargetMargineVenditaPct] = useState(
    prospect.targetMargineVenditaPct !== null ? String(prospect.targetMargineVenditaPct) : ""
  );

  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setSalvando(true);
    try {
      const res = await fetch("/api/prospect", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospectId: prospect.prospectId,
          driveFolderUrl,
          mediaBudgetMensile: numOrNull(mediaBudgetMensile),
          targetCpl: numOrNull(targetCpl),
          targetCpaAppuntamento: numOrNull(targetCpaAppuntamento),
          targetLeadSettimana: numOrNull(targetLeadSettimana),
          targetAppuntamentiSettimana: numOrNull(targetAppuntamentiSettimana),
          targetFatturatoMensile: numOrNull(targetFatturatoMensile),
          targetMargineVenditaPct: numOrNull(targetMargineVenditaPct),
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
    <Modal title="Modifica dati commerciali" subtitle={prospect.ragioneSociale} onClose={onClose} maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Cartella Drive (link, opzionale)"
          hint="Per ora va incollato a mano — in futuro verrà creata in automatico alla creazione del prospect"
        >
          <Input type="url" value={driveFolderUrl} onChange={(e) => setDriveFolderUrl(e.target.value)} placeholder="https://drive.google.com/…" />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Media budget mensile (€)">
            <Input type="number" step="0.01" value={mediaBudgetMensile} onChange={(e) => setMediaBudgetMensile(e.target.value)} />
          </Field>
          <Field label="Target fatturato mensile (€)">
            <Input type="number" step="0.01" value={targetFatturatoMensile} onChange={(e) => setTargetFatturatoMensile(e.target.value)} />
          </Field>
          <Field label="Target CPL (€)">
            <Input type="number" step="0.01" value={targetCpl} onChange={(e) => setTargetCpl(e.target.value)} />
          </Field>
          <Field label="Target CPA appuntamento (€)" hint="Costo per appuntamento fissato, non per vendita">
            <Input type="number" step="0.01" value={targetCpaAppuntamento} onChange={(e) => setTargetCpaAppuntamento(e.target.value)} />
          </Field>
          <Field label="Target lead a settimana">
            <Input type="number" step="1" min="0" value={targetLeadSettimana} onChange={(e) => setTargetLeadSettimana(e.target.value)} />
          </Field>
          <Field label="Target appuntamenti a settimana">
            <Input
              type="number"
              step="1"
              min="0"
              value={targetAppuntamentiSettimana}
              onChange={(e) => setTargetAppuntamentiSettimana(e.target.value)}
            />
          </Field>
          <Field label="Utile medio per vendita (% sul fatturato)" className="sm:col-span-2">
            <Input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={targetMargineVenditaPct}
              onChange={(e) => setTargetMargineVenditaPct(e.target.value)}
            />
          </Field>
        </div>

        {errore && <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-100 text-red-700 text-xs">{errore}</div>}

        <div className="flex gap-2 pt-2 border-t border-ink-300/60">
          <Button type="submit" disabled={salvando}>
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
