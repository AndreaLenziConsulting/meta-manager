"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { chiama, type ProdottoConModello } from "@/components/impostazioni/tipi";
import { Button } from "@/components/ui/Button";
import { ConfermaEliminazioneModal } from "@/components/ui/ConfermaEliminazioneModal";
import { Field } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PulsanteIcona } from "@/components/ui/PulsanteIcona";
import { ETICHETTA_CLIENTE, RUOLI_INTERNI, SENTINELLA_NON_ASSEGNATO } from "@/lib/assegnatari";
import { BLOCCHI_MODELLO, controllaTaskModello, DURATA_MASSIMA_SETTIMANE, TIPI_ATTIVITA_MODELLO } from "@/lib/impostazioni";
import type { TemplateTask } from "@/types/kpi";

type InModifica = { tipo: "nuova"; partenza: Partial<TemplateTask>; dopoTaskId?: string } | { tipo: "esistente"; task: TemplateTask };

// La sigla che nella roadmap segna un traguardo invece di un lavoro (vedi RoadmapGantt.tsx).
const TIPO_TAPPA = "MIL";

function settimane(t: TemplateTask): string {
  return t.settimanaInizio === t.settimanaFine ? `sett. ${t.settimanaInizio}` : `sett. ${t.settimanaInizio}–${t.settimanaFine}`;
}

/** Le attività per fase, nell'ordine del modello: la stessa regola con cui la roadmap di un cliente le mostra (raggruppaPerFase). */
function perFase(modello: TemplateTask[]): { fase: string; attivita: TemplateTask[] }[] {
  const mappa = new Map<string, TemplateTask[]>();
  for (const t of modello) mappa.set(t.fase, [...(mappa.get(t.fase) ?? []), t]);
  return Array.from(mappa, ([fase, attivita]) => ({ fase, attivita }));
}

/**
 * Il modello di attività di un prodotto, modificabile: ogni attività si può cambiare, spostare
 * dentro la sua fase, eliminare; se ne possono aggiungere in fondo a una fase o in una fase nuova.
 * Ogni modifica si salva subito.
 */
export function ModelloAttivita({ prodotto, nomiConsulenti }: { prodotto: ProdottoConModello; nomiConsulenti: string[] }) {
  const router = useRouter();
  const [inModifica, setInModifica] = useState<InModifica | null>(null);
  const [daEliminare, setDaEliminare] = useState<TemplateTask | null>(null);
  const [inSalvataggio, setInSalvataggio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  // Dopo ogni modifica l'elenco si rilegge dal server. Finché non è arrivato, i pulsanti restano
  // fermi: spostare o aggiungere partendo dall'elenco di prima manderebbe un ordine superato.
  const [inRilettura, avviaRilettura] = useTransition();
  const occupato = inSalvataggio || inRilettura;
  const rileggi = () => avviaRilettura(() => router.refresh());

  const gruppi = perFase(prodotto.modello);
  const fasi = gruppi.map((g) => g.fase).filter(Boolean);
  const ultima = prodotto.modello[prodotto.modello.length - 1];

  async function sposta(gruppo: TemplateTask[], indice: number, passo: -1 | 1) {
    const [questa, altra] = [gruppo[indice], gruppo[indice + passo]];
    if (!questa || !altra) return;
    const ordine = prodotto.modello.map((t) => t.taskId);
    const [i, j] = [ordine.indexOf(questa.taskId), ordine.indexOf(altra.taskId)];
    [ordine[i], ordine[j]] = [ordine[j], ordine[i]];
    setInSalvataggio(true);
    setErrore(null);
    try {
      await chiama("/api/impostazioni/modello", "PUT", { prodottoId: prodotto.prodottoId, ordine });
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setInSalvataggio(false);
      // Anche dopo un errore: se il modello è cambiato altrove, l'elenco giusto è quello del server.
      rileggi();
    }
  }

  async function elimina(task: TemplateTask) {
    await chiama(`/api/impostazioni/modello?prodottoId=${encodeURIComponent(prodotto.prodottoId)}&taskId=${encodeURIComponent(task.taskId)}`, "DELETE");
    rileggi();
    setDaEliminare(null);
  }

  return (
    <div className="space-y-5">
      {errore && (
        <p role="alert" className="text-sm font-semibold text-critico">
          {errore}
        </p>
      )}

      {gruppi.length === 0 && <p className="text-sm text-ink-500">Il modello è vuoto: un cliente nuovo con questo prodotto nascerebbe senza attività.</p>}

      {gruppi.map((g) => {
        const ultimaDelGruppo = g.attivita[g.attivita.length - 1];
        return (
          <section key={g.fase} className="space-y-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 className="text-sm font-bold text-ink-900">{g.fase || "Senza fase"}</h3>
              <span className="text-xs text-ink-500 tabular-nums">{g.attivita.length === 1 ? "1 attività" : `${g.attivita.length} attività`}</span>
            </div>
            <ul className="divide-y divide-linea border-y border-linea">
              {g.attivita.map((t, indice) => (
                <li key={t.taskId} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2.5">
                  <div className="min-w-0 flex-1 basis-64 space-y-0.5">
                    <p className="text-sm text-ink-900">{t.descrizione}</p>
                    <p className="text-xs text-ink-500">
                      {t.assegnatari.join(", ")} · {settimane(t)}
                      {t.giorniTesto && ` · ${t.giorniTesto}`}
                      {t.tipo === TIPO_TAPPA && " · tappa"}
                    </p>
                    {t.nota && <p className="text-xs italic text-ink-500">{t.nota}</p>}
                  </div>
                  <div className="flex shrink-0 items-center">
                    <PulsanteIcona etichetta={`Sposta su: ${t.descrizione}`} dimensione="sm" disabled={occupato || indice === 0} onClick={() => sposta(g.attivita, indice, -1)}>
                      <ArrowUp size={16} aria-hidden="true" />
                    </PulsanteIcona>
                    <PulsanteIcona
                      etichetta={`Sposta giù: ${t.descrizione}`}
                      dimensione="sm"
                      disabled={occupato || indice === g.attivita.length - 1}
                      onClick={() => sposta(g.attivita, indice, 1)}
                    >
                      <ArrowDown size={16} aria-hidden="true" />
                    </PulsanteIcona>
                    <PulsanteIcona etichetta={`Modifica: ${t.descrizione}`} dimensione="sm" disabled={occupato} onClick={() => setInModifica({ tipo: "esistente", task: t })}>
                      <Pencil size={16} aria-hidden="true" />
                    </PulsanteIcona>
                    <PulsanteIcona etichetta={`Elimina: ${t.descrizione}`} dimensione="sm" disabled={occupato} onClick={() => setDaEliminare(t)} className="hover:text-critico">
                      <Trash2 size={16} aria-hidden="true" />
                    </PulsanteIcona>
                  </div>
                </li>
              ))}
            </ul>
            <Button
              variant="ghost"
              size="sm"
              disabled={occupato}
              onClick={() =>
                setInModifica({
                  tipo: "nuova",
                  dopoTaskId: ultimaDelGruppo.taskId,
                  partenza: { fase: g.fase, blocco: ultimaDelGruppo.blocco, settimanaInizio: ultimaDelGruppo.settimanaFine, settimanaFine: ultimaDelGruppo.settimanaFine },
                })
              }
            >
              + Aggiungi attività{g.fase ? ` in "${g.fase}"` : ""}
            </Button>
          </section>
        );
      })}

      <div className="border-t border-linea pt-4">
        <Button
          variant="crea"
          size="sm"
          disabled={occupato}
          onClick={() =>
            setInModifica({
              tipo: "nuova",
              partenza: { fase: "", blocco: ultima?.blocco ?? BLOCCHI_MODELLO[0].id, settimanaInizio: ultima?.settimanaFine ?? 1, settimanaFine: ultima?.settimanaFine ?? 1 },
            })
          }
        >
          + Aggiungi attività in una nuova fase
        </Button>
      </div>

      {inModifica && (
        <TaskModelloModal
          key={inModifica.tipo === "esistente" ? inModifica.task.taskId : `nuova-${inModifica.dopoTaskId ?? ""}`}
          prodotto={prodotto}
          inModifica={inModifica}
          fasi={fasi}
          nomiConsulenti={nomiConsulenti}
          onSalvata={rileggi}
          onClose={() => setInModifica(null)}
        />
      )}
      {daEliminare && (
        <ConfermaEliminazioneModal
          titolo="Eliminare questa attività dal modello?"
          messaggio={
            <p>
              <strong className="font-bold text-ink-900">{daEliminare.descrizione}</strong> non comparirà più nella roadmap dei clienti nuovi. Quelle dei clienti già avviati non cambiano.
            </p>
          }
          onConferma={() => elimina(daEliminare)}
          onClose={() => setDaEliminare(null)}
        />
      )}
    </div>
  );
}

function TaskModelloModal({
  prodotto,
  inModifica,
  fasi,
  nomiConsulenti,
  onSalvata,
  onClose,
}: {
  prodotto: ProdottoConModello;
  inModifica: InModifica;
  fasi: string[];
  nomiConsulenti: string[];
  onSalvata: () => void;
  onClose: () => void;
}) {
  const partenza: Partial<TemplateTask> = inModifica.tipo === "esistente" ? inModifica.task : inModifica.partenza;
  const [descrizione, setDescrizione] = useState(partenza.descrizione ?? "");
  const [fase, setFase] = useState(partenza.fase ?? "");
  const [blocco, setBlocco] = useState(partenza.blocco ?? "");
  const [tipo, setTipo] = useState(partenza.tipo ?? "");
  const [assegnatari, setAssegnatari] = useState<string[]>((partenza.assegnatari ?? []).filter((a) => a !== SENTINELLA_NON_ASSEGNATO));
  const [nuovoNome, setNuovoNome] = useState("");
  const [settimanaInizio, setSettimanaInizio] = useState(String(partenza.settimanaInizio ?? 1));
  const [settimanaFine, setSettimanaFine] = useState(String(partenza.settimanaFine ?? 1));
  const [giorniTesto, setGiorniTesto] = useState(partenza.giorniTesto ?? "");
  const [nota, setNota] = useState(partenza.nota ?? "");
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const idFasi = `fasi-${prodotto.prodottoId}`;
  // Chi può fare un'attività del modello: i due ruoli interni e il cliente (ciò che i modelli usano),
  // i consulenti per nome, più chi è già scritto su questa attività.
  const sceltePossibili = Array.from(new Set([...RUOLI_INTERNI, ETICHETTA_CLIENTE, ...nomiConsulenti, ...assegnatari]));
  const blocchi = BLOCCHI_MODELLO.some((b) => b.id === blocco) || !blocco ? BLOCCHI_MODELLO : [...BLOCCHI_MODELLO, { id: blocco, etichetta: blocco }];
  const tipi = TIPI_ATTIVITA_MODELLO.some((t) => t.id === tipo) || !tipo ? TIPI_ATTIVITA_MODELLO : [...TIPI_ATTIVITA_MODELLO, { id: tipo, etichetta: tipo }];

  function alterna(nome: string) {
    setAssegnatari((prima) => (prima.includes(nome) ? prima.filter((a) => a !== nome) : [...prima, nome]));
  }

  function aggiungiNome() {
    const nome = nuovoNome.trim();
    if (!nome) return;
    setAssegnatari((prima) => (prima.includes(nome) ? prima : [...prima, nome]));
    setNuovoNome("");
  }

  async function salva(e: FormEvent) {
    e.preventDefault();
    const numero = (v: string) => (v.trim() === "" ? Number.NaN : Number(v));
    const controllo = controllaTaskModello({ descrizione, fase, blocco, tipo, assegnatari, settimanaInizio: numero(settimanaInizio), settimanaFine: numero(settimanaFine), giorniTesto, nota });
    if (!controllo.ok) {
      setErrore(controllo.errore);
      return;
    }
    setSalvando(true);
    setErrore(null);
    try {
      if (inModifica.tipo === "esistente") {
        await chiama("/api/impostazioni/modello", "PATCH", { ...controllo.dati, prodottoId: prodotto.prodottoId, taskId: inModifica.task.taskId });
      } else {
        await chiama("/api/impostazioni/modello", "POST", { ...controllo.dati, prodottoId: prodotto.prodottoId, dopoTaskId: inModifica.dopoTaskId });
      }
      onSalvata();
      onClose();
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
      setSalvando(false);
    }
  }

  return (
    <Modal title={inModifica.tipo === "esistente" ? "Modifica attività" : "Nuova attività"} onClose={onClose} maxWidth="max-w-2xl">
      <p className="-mt-2 text-sm text-ink-500">Modello di {prodotto.nome}</p>
      <form onSubmit={salva} onChange={() => setErrore(null)} noValidate className="space-y-4">
        <Field label="Cosa va fatto">
          <Textarea rows={2} value={descrizione} onChange={(e) => setDescrizione(e.target.value)} autoFocus={inModifica.tipo === "nuova"} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fase" hint="Le attività con la stessa fase stanno insieme nella roadmap.">
            <Input value={fase} onChange={(e) => setFase(e.target.value)} list={idFasi} placeholder="es. Sett. 1 - Strategia & analisi" autoComplete="off" />
          </Field>
          <datalist id={idFasi}>
            {fasi.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          <Field label="Momento del progetto">
            <Select value={blocco} onChange={(e) => setBlocco(e.target.value)}>
              <option value="">Non indicato</option>
              {blocchi.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.etichetta}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Chi la fa" hint={`Nessuna scelta = "${SENTINELLA_NON_ASSEGNATO}".`}>
          <div className="space-y-2 rounded-lg border border-bordo-campo p-3">
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {sceltePossibili.map((nome) => (
                <label key={nome} className="flex min-h-8 cursor-pointer items-center gap-2 text-sm text-ink-700">
                  <input type="checkbox" checked={assegnatari.includes(nome)} onChange={() => alterna(nome)} className="h-[18px] w-[18px] flex-shrink-0 cursor-pointer accent-[var(--brand-primary)]" />
                  {nome}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={nuovoNome}
                onChange={(e) => setNuovoNome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    aggiungiNome();
                  }
                }}
                aria-label="Aggiungi un altro nome"
                placeholder="Aggiungi un altro nome…"
                className="min-h-9 w-auto flex-1 py-1.5"
              />
              <Button variant="ghost" size="sm" onClick={aggiungiNome}>
                Aggiungi
              </Button>
            </div>
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Dalla settimana">
            <Input type="number" min={1} max={DURATA_MASSIMA_SETTIMANE} step={1} value={settimanaInizio} onChange={(e) => setSettimanaInizio(e.target.value)} />
          </Field>
          <Field label="Alla settimana">
            <Input type="number" min={1} max={DURATA_MASSIMA_SETTIMANE} step={1} value={settimanaFine} onChange={(e) => setSettimanaFine(e.target.value)} />
          </Field>
          <Field label="Giorni" hint="Solo indicativo.">
            <Input value={giorniTesto} onChange={(e) => setGiorniTesto(e.target.value)} placeholder="es. gg 1-3" autoComplete="off" />
          </Field>
        </div>
        <p className="-mt-2 text-xs text-ink-500">
          Le date di un cliente si calcolano dalle settimane, a partire dall&apos;inizio del suo progetto. {prodotto.nome} dura{" "}
          {prodotto.durataSettimane === 1 ? "1 settimana" : `${prodotto.durataSettimane} settimane`}.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo" hint="Decide il colore dell'attività nella roadmap; una tappa è un traguardo, non un lavoro.">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Non indicato</option>
              {tipi.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.etichetta}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nota" hint="Facoltativa.">
            <Input value={nota} onChange={(e) => setNota(e.target.value)} autoComplete="off" />
          </Field>
        </div>

        {errore && (
          <p role="alert" className="text-sm font-semibold text-critico">
            {errore}
          </p>
        )}
        <div className="flex flex-wrap gap-2 border-t border-linea pt-4">
          <Button type="submit" variant={inModifica.tipo === "esistente" ? "primary" : "crea"} disabled={salvando}>
            {salvando ? "Salvataggio…" : inModifica.tipo === "esistente" ? "Salva" : "Aggiungi attività"}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={salvando}>
            Annulla
          </Button>
        </div>
      </form>
    </Modal>
  );
}
