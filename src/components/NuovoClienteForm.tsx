"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { PersonalizzazioneCliente } from "@/components/PersonalizzazioneCliente";

type Props = {
  consulenti: { consulenteId: string; nome: string }[];
  prodotti: { prodottoId: string; nome: string }[];
};

type Esito = { clienteId: string; accessCode: string; roadmapGenerata: boolean };

export function NuovoClienteForm({ consulenti, prodotti }: Props) {
  const [nome, setNome] = useState("");
  const [adAccountId, setAdAccountId] = useState("");
  const [email, setEmail] = useState("");
  const [consulenteId, setConsulenteId] = useState("");
  const [targetCpa, setTargetCpa] = useState("");
  const [targetCpl, setTargetCpl] = useState("");
  const [prodottoId, setProdottoId] = useState("");
  const [dataInizioProgetto, setDataInizioProgetto] = useState("");
  const [mostraTabExtra, setMostraTabExtra] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [colorePrimario, setColorePrimario] = useState("");
  const [coloreSecondario, setColoreSecondario] = useState("");
  const [fontPersonalizzato, setFontPersonalizzato] = useState("");

  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [esito, setEsito] = useState<Esito | null>(null);
  const [rigenerando, setRigenerando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setCaricamento(true);
    try {
      const res = await fetch("/api/clienti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          adAccountId,
          email,
          consulenteId,
          targetCpa: targetCpa ? Number(targetCpa) : null,
          targetCpl: targetCpl ? Number(targetCpl) : null,
          prodottoId,
          dataInizioProgetto: prodottoId ? dataInizioProgetto : "",
          mostraTabExtra,
          logoUrl,
          colorePrimario,
          coloreSecondario,
          fontPersonalizzato,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Creazione non riuscita");
      setEsito(body as Esito);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setCaricamento(false);
    }
  }

  async function handleRigeneraRoadmap() {
    if (!esito) return;
    setRigenerando(true);
    setErrore(null);
    try {
      const res = await fetch("/api/attivita/genera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId: esito.clienteId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Generazione roadmap non riuscita");
      setEsito({ ...esito, roadmapGenerata: true });
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setRigenerando(false);
    }
  }

  if (esito) {
    const link = `${typeof window !== "undefined" ? window.location.origin : ""}/report/${esito.accessCode}`;
    return (
      <Card padding="lg" className="space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={20} className="text-green-600" />
          <h3 className="font-heading font-bold text-ink-900">Cliente creato</h3>
        </div>

        <div className="space-y-2 text-sm">
          <p className="text-ink-500">
            Link cliente pubblico:{" "}
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(link)}
              className="font-mono text-brand hover:underline break-all text-left"
              title="Copia negli appunti"
            >
              {link}
            </button>
          </p>
        </div>

        {prodottoId && !esito.roadmapGenerata && (
          <div className="rounded-lg bg-yellow-50 border border-yellow-100 text-yellow-800 text-xs p-3 space-y-2">
            <p>La generazione della roadmap non è riuscita. Il cliente esiste comunque, puoi riprovare.</p>
            <button
              type="button"
              onClick={handleRigeneraRoadmap}
              disabled={rigenerando}
              className="rounded-lg bg-yellow-800 hover:bg-yellow-900 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 transition cursor-pointer"
            >
              {rigenerando ? "Riprovo…" : "Riprova generazione roadmap"}
            </button>
          </div>
        )}
        {errore && <p className="text-xs text-red-600">{errore}</p>}

        <div className="flex gap-2 pt-2 border-t border-ink-300/60">
          <a
            href={`/dashboard/cliente/${encodeURIComponent(esito.clienteId)}`}
            className="rounded-xl bg-cta hover:bg-cta-dark text-white text-sm font-semibold px-4 py-2.5 transition active:scale-[.98]"
          >
            Vai alla scheda cliente
          </a>
          <a href="/dashboard" className="rounded-xl border border-ink-300 text-sm font-semibold px-4 py-2.5 text-ink-700 hover:bg-surface transition">
            Torna alla home
          </a>
        </div>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-ink-300 bg-surface-card shadow-sm p-6 space-y-4">
      <Field label="Nome cliente">
        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Es. Mobilieri Bianchi Srl" required />
      </Field>

      <Field label="Ad account Meta (opzionale)" hint="Puoi collegarlo anche in un secondo momento dal tab KPI del cliente.">
        <Input value={adAccountId} onChange={(e) => setAdAccountId(e.target.value)} placeholder="Solo cifre, senza act_" />
      </Field>

      <Field label="Email cliente (opzionale)" hint="Per l'invio automatico del follow-up meeting">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
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
        <Field label="Target CPA (€, opzionale)">
          <Input type="number" step="0.01" value={targetCpa} onChange={(e) => setTargetCpa(e.target.value)} />
        </Field>
        <Field label="Target CPL (€, opzionale)">
          <Input type="number" step="0.01" value={targetCpl} onChange={(e) => setTargetCpl(e.target.value)} />
        </Field>
      </div>

      <div className="pt-2 border-t border-ink-300/60 space-y-4">
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
          <Field label="Data inizio progetto">
            <Input type="date" value={dataInizioProgetto} onChange={(e) => setDataInizioProgetto(e.target.value)} required />
          </Field>
        )}
      </div>

      <label className="flex items-center gap-2 text-xs text-ink-700 cursor-pointer">
        <input type="checkbox" checked={mostraTabExtra} onChange={(e) => setMostraTabExtra(e.target.checked)} className="accent-current text-brand" />
        Il cliente vede anche il tab Meeting (oltre a KPI)
      </label>

      <div className="pt-2 border-t border-ink-300/60 space-y-3">
        <div>
          <p className="text-sm font-semibold text-ink-900">Personalizzazione (opzionale)</p>
          <p className="text-xs text-ink-500 mt-0.5">
            Sostituisce il brand ALC standard su questo cliente (scheda cliente + link pubblico) — lascia vuoto per il brand di default.
          </p>
        </div>
        <PersonalizzazioneCliente
          logoUrl={logoUrl}
          onLogoUrlChange={setLogoUrl}
          colorePrimario={colorePrimario}
          onColorePrimarioChange={setColorePrimario}
          coloreSecondario={coloreSecondario}
          onColoreSecondarioChange={setColoreSecondario}
          fontPersonalizzato={fontPersonalizzato}
          onFontPersonalizzatoChange={setFontPersonalizzato}
        />
      </div>

      {errore && <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-100 text-red-700 text-xs">{errore}</div>}

      <Button type="submit" disabled={caricamento || !nome || !consulenteId} className="w-full">
        {caricamento ? "Creazione…" : "Crea cliente"}
      </Button>
    </form>
  );
}
