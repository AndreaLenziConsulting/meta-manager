"use client";

import { useEffect, useState } from "react";
import type { Cliente, Consulente, Sede } from "@/types/kpi";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

/** Come torna GET /api/ghl-connessioni — mai il token vero, solo una versione mascherata. */
type GhlConnessioneVista = { connessioneId: string; locationId: string; attivo: boolean; tokenMascherato: string };

type Props = {
  cliente: Cliente;
  sedi: Sede[];
  consulenti: Consulente[];
  onClose: () => void;
  onSalvato: () => void;
};

export function ModificaClienteModal({ cliente, sedi, consulenti, onClose, onSalvato }: Props) {
  const [nome, setNome] = useState(cliente.nome);
  const [email, setEmail] = useState(cliente.email);
  const [consulenteId, setConsulenteId] = useState(cliente.consulenteId);
  const [mostraTabExtra, setMostraTabExtra] = useState(cliente.mostraTabExtra);
  const [attivo, setAttivo] = useState(cliente.attivo);

  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  // Fase 1 integrazione GHL/Squadd: connessioni indicizzate per sedeId, caricate a parte (Sede
  // non le porta con sé — vedi src/types/ghl.ts) e ricaricate dopo ogni creazione/modifica.
  const [ghlPerSede, setGhlPerSede] = useState<Record<string, GhlConnessioneVista>>({});
  const [ghlTick, setGhlTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/ghl-connessioni?clienteId=${encodeURIComponent(cliente.clienteId)}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((body: { connessioni?: (GhlConnessioneVista & { sedeId: string })[] }) => {
        const mappa: Record<string, GhlConnessioneVista> = {};
        for (const c of body.connessioni ?? []) mappa[c.sedeId] = c;
        setGhlPerSede(mappa);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [cliente.clienteId, ghlTick]);

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
          email,
          consulenteId,
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
    <Modal title="Modifica cliente" subtitle={cliente.clienteId} onClose={onClose} maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nome cliente">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
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
          <Button type="submit" disabled={salvando || !nome || !consulenteId}>
            {salvando ? "Salvataggio…" : "Salva modifiche"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Annulla
          </Button>
        </div>
      </form>

      <div className="pt-4 mt-4 border-t border-ink-300/60 space-y-3">
        <div>
          <p className="text-sm font-semibold text-ink-900">Sedi</p>
          <p className="text-xs text-ink-500 mt-0.5">
            Ogni sede ha il proprio account pubblicitario e il proprio target — ads e funnel restano separati tra sedi diverse.
          </p>
        </div>
        <div className="space-y-3">
          {sedi.map((sede) => (
            <SedeRow
              key={sede.sedeId}
              sede={sede}
              onSalvato={onSalvato}
              ghlConnessione={ghlPerSede[sede.sedeId]}
              onGhlSalvato={() => setGhlTick((t) => t + 1)}
            />
          ))}
        </div>
        <NuovaSedeForm clienteId={cliente.clienteId} onCreata={onSalvato} />
      </div>
    </Modal>
  );
}

function SedeRow({
  sede,
  onSalvato,
  ghlConnessione,
  onGhlSalvato,
}: {
  sede: Sede;
  onSalvato: () => void;
  ghlConnessione?: GhlConnessioneVista;
  onGhlSalvato: () => void;
}) {
  const [nome, setNome] = useState(sede.nome);
  const [adAccountId, setAdAccountId] = useState(sede.adAccountId);
  const [targetCpa, setTargetCpa] = useState(sede.targetCpa !== null ? String(sede.targetCpa) : "");
  const [targetCpl, setTargetCpl] = useState(sede.targetCpl !== null ? String(sede.targetCpl) : "");
  const [tipoConversioneLead, setTipoConversioneLead] = useState(sede.tipoConversioneLead);
  const [attivo, setAttivo] = useState(sede.attivo);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function salva() {
    setErrore(null);
    setSalvando(true);
    try {
      const res = await fetch("/api/sedi", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sedeId: sede.sedeId,
          nome,
          adAccountId,
          targetCpa: targetCpa ? Number(targetCpa) : null,
          targetCpl: targetCpl ? Number(targetCpl) : null,
          tipoConversioneLead,
          attivo,
        }),
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
    <div className="rounded-xl border border-ink-300 p-3 space-y-2.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Field label="Nome sede">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
        </Field>
        <Field label="Ad account Meta">
          <Input value={adAccountId} onChange={(e) => setAdAccountId(e.target.value)} placeholder="Solo cifre, senza act_" />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Field label="Target CPA (€, opzionale)">
          <Input type="number" step="0.01" value={targetCpa} onChange={(e) => setTargetCpa(e.target.value)} />
        </Field>
        <Field label="Target CPL (€, opzionale)">
          <Input type="number" step="0.01" value={targetCpl} onChange={(e) => setTargetCpl(e.target.value)} />
        </Field>
      </div>
      <Field
        label="Tipo conversione lead (opzionale)"
        hint="Action type esatto di Meta Insights da contare come lead — solo per sedi con tracciamento non standard."
      >
        <Input
          value={tipoConversioneLead}
          onChange={(e) => setTipoConversioneLead(e.target.value)}
          placeholder="Vuoto = usa la lista di default (Lead Ads classici)"
        />
      </Field>
      <div className="flex items-center justify-between gap-2 pt-1">
        <label className="flex items-center gap-2 text-xs text-ink-700 cursor-pointer">
          <input type="checkbox" checked={attivo} onChange={(e) => setAttivo(e.target.checked)} className="accent-current text-brand" />
          Sede attiva
        </label>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={salva}
          disabled={salvando || !nome || !/^\d+$/.test(adAccountId)}
        >
          {salvando ? "Salvataggio…" : "Salva sede"}
        </Button>
      </div>
      {errore && <p className="text-xs text-red-600">{errore}</p>}

      <div className="pt-2 mt-1 border-t border-ink-300/60">
        <GhlConnessioneBlock sedeId={sede.sedeId} connessione={ghlConnessione} onSalvato={onGhlSalvato} />
      </div>
    </div>
  );
}

/**
 * Collegamento GHL/Squadd di una sede (Fase 1, sola lettura — vedi GhlPanel.tsx). Il token non
 * viene mai ri-mostrato per intero dopo la creazione, solo mascherato ("••••3f9a"): il campo di
 * modifica parte vuoto e sovrascrive solo se l'admin ci digita davvero un nuovo valore.
 */
function GhlConnessioneBlock({
  sedeId,
  connessione,
  onSalvato,
}: {
  sedeId: string;
  connessione?: GhlConnessioneVista;
  onSalvato: () => void;
}) {
  const [attiva, setAttiva] = useState(false);
  const [locationId, setLocationId] = useState(connessione?.locationId ?? "");
  const [privateToken, setPrivateToken] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  if (!connessione && !attiva) {
    return (
      <Button type="button" size="sm" variant="ghost" onClick={() => setAttiva(true)}>
        + Collega GHL
      </Button>
    );
  }

  async function salva() {
    setErrore(null);
    setSalvando(true);
    try {
      const res = await fetch("/api/ghl-connessioni", {
        method: connessione ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          connessione
            ? { connessioneId: connessione.connessioneId, locationId, privateToken: privateToken || undefined }
            : { sedeId, locationId, privateToken }
        ),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Salvataggio non riuscito");
      setPrivateToken("");
      onSalvato();
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSalvando(false);
    }
  }

  const locationIdValido = locationId.trim().length > 0;
  const puoSalvare = connessione ? locationIdValido : locationIdValido && privateToken.trim().length > 0;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Connessione GHL/Squadd</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Field label="Location ID">
          <Input value={locationId} onChange={(e) => setLocationId(e.target.value)} placeholder="Location ID GHL" />
        </Field>
        <Field
          label="Private Integration Token"
          hint={connessione ? `Attuale: ${connessione.tokenMascherato} — lascia vuoto per non cambiarlo` : undefined}
        >
          <Input
            type="password"
            value={privateToken}
            onChange={(e) => setPrivateToken(e.target.value)}
            placeholder={connessione ? "Lascia vuoto per non cambiarlo" : "Incolla il token"}
          />
        </Field>
      </div>
      {errore && <p className="text-xs text-red-600">{errore}</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={salva} disabled={salvando || !puoSalvare}>
          {salvando ? "Salvataggio…" : connessione ? "Aggiorna connessione" : "Collega"}
        </Button>
        {!connessione && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setAttiva(false)}>
            Annulla
          </Button>
        )}
      </div>
    </div>
  );
}

function NuovaSedeForm({ clienteId, onCreata }: { clienteId: string; onCreata: () => void }) {
  const [attiva, setAttiva] = useState(false);
  const [nome, setNome] = useState("");
  const [adAccountId, setAdAccountId] = useState("");
  const [targetCpa, setTargetCpa] = useState("");
  const [targetCpl, setTargetCpl] = useState("");
  const [creando, setCreando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  if (!attiva) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setAttiva(true)}>
        + Aggiungi sede
      </Button>
    );
  }

  async function crea() {
    setErrore(null);
    setCreando(true);
    try {
      const res = await fetch("/api/sedi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId,
          nome,
          adAccountId,
          targetCpa: targetCpa ? Number(targetCpa) : null,
          targetCpl: targetCpl ? Number(targetCpl) : null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Creazione non riuscita");
      onCreata();
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
      setCreando(false);
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-ink-300 p-3 space-y-2.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Field label="Nome sede">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Es. Milano" autoFocus />
        </Field>
        <Field label="Ad account Meta">
          <Input value={adAccountId} onChange={(e) => setAdAccountId(e.target.value)} placeholder="Solo cifre, senza act_" />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Field label="Target CPA (€, opzionale)">
          <Input type="number" step="0.01" value={targetCpa} onChange={(e) => setTargetCpa(e.target.value)} />
        </Field>
        <Field label="Target CPL (€, opzionale)">
          <Input type="number" step="0.01" value={targetCpl} onChange={(e) => setTargetCpl(e.target.value)} />
        </Field>
      </div>
      {errore && <p className="text-xs text-red-600">{errore}</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={crea} disabled={creando || !nome || !/^\d+$/.test(adAccountId)}>
          {creando ? "Creazione…" : "Crea sede"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setAttiva(false)}>
          Annulla
        </Button>
      </div>
    </div>
  );
}
