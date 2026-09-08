"use client";

import { useEffect, useState } from "react";
import { Frown, HelpCircle, Meh, Smile, type LucideIcon } from "lucide-react";
import { formatDataBreve } from "@/lib/format";
import { classificaSentiment, type StatoSentiment } from "@/lib/sentimentCliente";
import { STILE_LIVELLO } from "@/lib/statusStyles";
import { MeetingReportView } from "@/components/MeetingReportView";
import { Tabs } from "@/components/Tabs";
import type { MeetingClienteRow } from "@/types/meeting";

// Sentinella per "nessun filtro" — stesso schema di AttivitaGlobali.tsx: nessun clienteId reale
// comincia per "__".
const CLIENTE_TUTTI = "__tutti__";

type ClienteRef = { clienteId: string; nome: string };
type Risposta = { clienti: ClienteRef[]; meeting: MeetingClienteRow[] };

const ICONA_SENTIMENT: Record<StatoSentiment, LucideIcon> = { positivo: Smile, neutro: Meh, negativo: Frown, sconosciuto: HelpCircle };
const ETICHETTA_SENTIMENT: Record<StatoSentiment, string> = {
  positivo: "Positivo",
  neutro: "Neutro",
  negativo: "Negativo",
  sconosciuto: "Non specificato",
};
// Stessa mappatura tono di AndamentoSentiment.tsx (positivo/successo, negativo/critico,
// neutro+sconosciuto entrambi "neutro" — nessun segnale d'allarme in nessuno dei due casi).
const TONO_SENTIMENT: Record<StatoSentiment, keyof typeof STILE_LIVELLO> = {
  positivo: "successo",
  neutro: "neutro",
  negativo: "critico",
  sconosciuto: "neutro",
};

function BadgeSentiment({ sentiment }: { sentiment: string }) {
  const stato = classificaSentiment(sentiment);
  const Icona = ICONA_SENTIMENT[stato];
  const stile = STILE_LIVELLO[TONO_SENTIMENT[stato]];
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${stile.classe}`}
    >
      <Icona size={13} className="flex-shrink-0" />
      {ETICHETTA_SENTIMENT[stato]}
    </span>
  );
}

/**
 * Vista aggregata "Meeting" — tutti gli appuntamenti di tutti i clienti visibili alla sessione
 * (tutti per l'admin, solo i propri per il consulente), mirror di AttivitaGlobali.tsx: stesso
 * fetch-una-volta, stesso filtro per cliente con Tabs, stesso badge nome-cliente per riga (qui
 * risolto localmente perché non c'è una lista condivisa come AttivitaLista da riusare). Sola
 * lettura — a differenza di AttivitaGlobali non ci sono mutazioni da fare da qui: aprire/modificare
 * un meeting resta nel tab Meeting del singolo cliente (MeetingTab.tsx), raggiungibile dal badge
 * cliente su ogni riga.
 *
 * Priorità esplicita della richiesta utente: "si deve capire subito il sentiment se è positivo o
 * negativo" — per questo ogni riga mostra un badge colorato+icona+etichetta SEMPRE visibile (mai
 * dietro un clic), non la piccola scritta grigia usata nello storico per-cliente di MeetingTab.
 */
export function MeetingGlobali() {
  const [dati, setDati] = useState<Risposta | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [clienteFiltro, setClienteFiltro] = useState(CLIENTE_TUTTI);
  const [espanso, setEspanso] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve()
      .then(() => {
        setCaricamento(true);
        setErrore(null);
        return fetch("/api/meeting/tutti", { signal: controller.signal });
      })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Errore nel caricamento dei meeting");
        }
        return res.json();
      })
      .then((data: Risposta) => setDati(data))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setErrore(err.message);
      })
      .finally(() => setCaricamento(false));

    return () => controller.abort();
  }, []);

  if (caricamento && !dati) return <p className="text-sm text-ink-500">Caricamento…</p>;
  if (errore && !dati) return <p className="text-sm text-red-600">{errore}</p>;
  if (!dati) return null;

  if (dati.clienti.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-ink-300 bg-surface-card p-8 text-center">
        <p className="text-sm text-ink-500">Nessun cliente assegnato.</p>
      </div>
    );
  }

  if (dati.meeting.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-ink-300 bg-surface-card p-8 text-center">
        <p className="text-sm text-ink-500">Nessun meeting registrato. Apri la scheda di un cliente per registrarne uno.</p>
      </div>
    );
  }

  const nomeClientePer = new Map(dati.clienti.map((c) => [c.clienteId, c.nome]));

  // Come in AttivitaGlobali.tsx: calcolato sul set NON filtrato, così il filtro non fa sparire le
  // proprie stesse opzioni.
  const clientiDisponibili = Array.from(new Set(dati.meeting.map((m) => m.clienteId)))
    .map((clienteId) => ({ clienteId, nome: nomeClientePer.get(clienteId) ?? clienteId }))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const meetingFiltrati = dati.meeting.filter((m) => clienteFiltro === CLIENTE_TUTTI || m.clienteId === clienteFiltro);

  return (
    <div className="space-y-3">
      {errore && <p className="text-sm text-red-600">{errore}</p>}

      {clientiDisponibili.length > 1 && (
        <Tabs
          tabs={[{ id: CLIENTE_TUTTI, label: "Tutti i clienti" }, ...clientiDisponibili.map((c) => ({ id: c.clienteId, label: c.nome }))]}
          attivo={clienteFiltro}
          onChange={setClienteFiltro}
        />
      )}

      <div className="space-y-2">
        {meetingFiltrati.map((m) => {
          const aperto = espanso === m.meetingId;
          const nomeCliente = nomeClientePer.get(m.clienteId) ?? m.clienteId;
          return (
            <div key={m.meetingId} className="rounded-2xl border border-ink-300 bg-surface-card shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setEspanso(aperto ? null : m.meetingId)}
                className="w-full text-left px-5 py-3.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <a
                      href={`/dashboard/cliente/${encodeURIComponent(m.clienteId)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title={`Vai alla scheda di ${nomeCliente}`}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-ink-900 text-white hover:bg-ink-700 cursor-pointer transition-colors truncate max-w-[200px]"
                    >
                      {nomeCliente}
                    </a>
                  </div>
                  <p className="font-semibold text-ink-900 truncate">{m.titolo || "(senza titolo)"}</p>
                  <p className="text-xs text-ink-500">
                    {formatDataBreve(m.data)}
                    {m.dati.referente ? ` · ${m.dati.referente}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <BadgeSentiment sentiment={m.sentiment} />
                  <span className="text-ink-300 text-xs">{aperto ? "▲" : "▼"}</span>
                </div>
              </button>
              {aperto && (
                <div className="px-5 pb-4 border-t border-ink-300/40 pt-3">
                  <MeetingReportView meeting={m.dati} clienteNome={nomeCliente} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
