"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { ModelloAttivita } from "@/components/impostazioni/ModelloAttivita";
import { chiama, type ProdottoConModello } from "@/components/impostazioni/tipi";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfermaEliminazioneModal } from "@/components/ui/ConfermaEliminazioneModal";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { CLASSE_TITOLO_SEZIONE } from "@/components/ui/Intestazione";
import { Modal } from "@/components/ui/Modal";
import { DURATA_MASSIMA_SETTIMANE, erroreProdotto } from "@/lib/impostazioni";

type Aperto = { tipo: "nuovo" } | { tipo: "modifica"; prodottoId: string };

/**
 * Sezione "Prodotti e modelli" delle Impostazioni: i prodotti che si possono assegnare a un cliente
 * e, per ognuno, il modello di attività da cui nasce la roadmap dei clienti nuovi.
 */
export function ProdottiImpostazioni({ prodotti, nomiConsulenti }: { prodotti: ProdottoConModello[]; nomiConsulenti: string[] }) {
  const [aperto, setAperto] = useState<Aperto | null>(null);
  const [modelloAperto, setModelloAperto] = useState<string | null>(null);
  const inModifica = aperto?.tipo === "modifica" ? prodotti.find((p) => p.prodottoId === aperto.prodottoId) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-[70ch] text-sm text-ink-500">
          Scegliendo un prodotto per un cliente nuovo, la sua roadmap nasce dalle attività del modello. Cambiare un modello vale per i clienti creati da quel
          momento: le roadmap già avviate restano com&apos;erano.
        </p>
        <Button variant="crea" size="sm" onClick={() => setAperto({ tipo: "nuovo" })}>
          + Nuovo prodotto
        </Button>
      </div>

      {prodotti.length === 0 && (
        <Card>
          <p className="text-sm text-ink-500">Nessun prodotto. Senza prodotti un cliente nuovo nasce senza roadmap.</p>
        </Card>
      )}

      {prodotti.map((p) => {
        const espanso = modelloAperto === p.prodottoId;
        const idModello = `modello-${p.prodottoId}`;
        return (
          <Card key={p.prodottoId} padding="lg" className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <h2 className={CLASSE_TITOLO_SEZIONE}>{p.nome}</h2>
                  <Badge tono={p.attivo ? "successo" : "neutro"}>{p.attivo ? "attivo" : "non attivo"}</Badge>
                </div>
                <p className="text-sm text-ink-500 tabular-nums">
                  {p.durataSettimane === 1 ? "1 settimana" : `${p.durataSettimane} settimane`} · {p.modello.length === 1 ? "1 attività nel modello" : `${p.modello.length} attività nel modello`} ·{" "}
                  {p.clienti === 1 ? "1 cliente" : `${p.clienti} clienti`}
                </p>
                {p.note && <p className="text-sm text-ink-700">{p.note}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setAperto({ tipo: "modifica", prodottoId: p.prodottoId })} aria-label={`Modifica ${p.nome}`}>
                  Modifica
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setModelloAperto(espanso ? null : p.prodottoId)} aria-expanded={espanso} aria-controls={idModello}>
                  {espanso ? "Chiudi il modello" : "Apri il modello"}
                  <ChevronDown size={16} aria-hidden="true" className={`transition-transform ${espanso ? "rotate-180" : ""}`} />
                </Button>
              </div>
            </div>
            {espanso && (
              <div id={idModello} className="border-t border-linea pt-4">
                <ModelloAttivita prodotto={p} nomiConsulenti={nomiConsulenti} />
              </div>
            )}
          </Card>
        );
      })}

      {aperto?.tipo === "nuovo" && <ProdottoModal onClose={() => setAperto(null)} onCreato={(id) => setModelloAperto(id)} />}
      {aperto?.tipo === "modifica" && inModifica && <ProdottoModal key={inModifica.prodottoId} prodotto={inModifica} onClose={() => setAperto(null)} />}
    </div>
  );
}

function ProdottoModal({ prodotto, onClose, onCreato }: { prodotto?: ProdottoConModello; onClose: () => void; onCreato?: (prodottoId: string) => void }) {
  const router = useRouter();
  const [nome, setNome] = useState(prodotto?.nome ?? "");
  const [durata, setDurata] = useState(prodotto ? String(prodotto.durataSettimane) : "");
  const [note, setNote] = useState(prodotto?.note ?? "");
  const [attivo, setAttivo] = useState(prodotto?.attivo ?? true);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [confermaEliminazione, setConfermaEliminazione] = useState(false);

  async function salva(e: FormEvent) {
    e.preventDefault();
    const durataSettimane = durata.trim() === "" ? Number.NaN : Number(durata);
    const problema = erroreProdotto({ nome, durataSettimane });
    if (problema) {
      setErrore(problema);
      return;
    }
    setSalvando(true);
    setErrore(null);
    try {
      if (prodotto) {
        await chiama("/api/impostazioni/prodotti", "PATCH", { prodottoId: prodotto.prodottoId, nome, durataSettimane, note, attivo });
      } else {
        const { prodottoId } = await chiama<{ prodottoId: string }>("/api/impostazioni/prodotti", "POST", { nome, durataSettimane, note });
        onCreato?.(prodottoId);
      }
      router.refresh();
      onClose();
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
      setSalvando(false);
    }
  }

  async function elimina() {
    if (!prodotto) return;
    await chiama(`/api/impostazioni/prodotti?prodottoId=${encodeURIComponent(prodotto.prodottoId)}`, "DELETE");
    router.refresh();
    onClose();
  }

  if (prodotto && confermaEliminazione) {
    return (
      <ConfermaEliminazioneModal
        titolo={`Eliminare ${prodotto.nome}?`}
        messaggio={
          <p>
            Il prodotto viene eliminato insieme al suo modello ({prodotto.modello.length === 1 ? "1 attività" : `${prodotto.modello.length} attività`}). Si può eliminare solo un prodotto che nessun
            cliente usa: altrimenti disattivalo.
          </p>
        }
        labelConferma="Elimina prodotto"
        onConferma={elimina}
        onClose={() => setConfermaEliminazione(false)}
      />
    );
  }

  return (
    <Modal title={prodotto ? prodotto.nome : "Nuovo prodotto"} onClose={onClose}>
      <form onSubmit={salva} onChange={() => setErrore(null)} noValidate className="space-y-4">
        <Field label="Nome">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus={!prodotto} autoComplete="off" />
        </Field>
        <Field label="Durata in settimane" hint="Quanto dura il progetto di un cliente con questo prodotto.">
          <Input type="number" min={1} max={DURATA_MASSIMA_SETTIMANE} step={1} value={durata} onChange={(e) => setDurata(e.target.value)} className="w-32" />
        </Field>
        <Field label="Note" hint="Facoltative, le vede solo l'amministratore.">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {prodotto && (
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-ink-700">
            <input type="checkbox" checked={attivo} onChange={(e) => setAttivo(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 cursor-pointer accent-[var(--brand-primary)]" />
            <span>
              <span className="font-semibold text-ink-900">Attivo</span>
              <span className="block text-xs text-ink-500">Un prodotto non attivo resta ai clienti che ce l&apos;hanno, ma non si può scegliere per i nuovi.</span>
            </span>
          </label>
        )}
        {errore && (
          <p role="alert" className="text-sm font-semibold text-critico">
            {errore}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 border-t border-linea pt-4">
          <Button type="submit" variant={prodotto ? "primary" : "crea"} disabled={salvando}>
            {salvando ? "Salvataggio…" : prodotto ? "Salva" : "Crea prodotto"}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={salvando}>
            Annulla
          </Button>
          {prodotto && (
            <Button variant="danger" onClick={() => setConfermaEliminazione(true)} disabled={salvando} className="ml-auto">
              Elimina
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
