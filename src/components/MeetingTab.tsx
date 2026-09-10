"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { formatDataBreve } from "@/lib/format";
import { andamentoSentiment } from "@/lib/sentimentCliente";
import { MeetingReportView } from "@/components/MeetingReportView";
import { MeetingAzioni } from "@/components/MeetingAzioni";
import { NuovoMeetingForm } from "@/components/NuovoMeetingForm";
import { AndamentoSentiment } from "@/components/AndamentoSentiment";
import { UndoToast } from "@/components/ui/UndoToast";
import type { MeetingCampiPubblici, MeetingClienteRow, MeetingDataLoose } from "@/types/meeting";

type Props = {
  code?: string;
  clienteId?: string;
  clienteNome?: string;
  clienteEmail?: string;
  meetingIdEvidenziato?: string | null;
  // Mostra il bottone "Elimina" per ogni meeting — SOLO admin, mai il consulente (che può comunque
  // vedere/creare/modificare meeting per i propri clienti). Assente (quindi falsy) sul link
  // pubblico cliente (report/[code]/page.tsx non passa mai questa prop).
  ruoloAdmin?: boolean;
};

export function MeetingTab({ code, clienteId, clienteNome, clienteEmail, meetingIdEvidenziato, ruoloAdmin }: Props) {
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [meetingTeam, setMeetingTeam] = useState<MeetingClienteRow[] | null>(null);
  const [meetingPubblico, setMeetingPubblico] = useState<MeetingCampiPubblici[] | null>(null);
  // Andamento sentiment nel tempo (Fase 1 roadmap) — solo dai dati già in memoria (meetingTeam),
  // nessun fetch in più. Stesso filtro "solo sentiment davvero compilato" già in uso nella Dashboard
  // Amministratore (dashboard/page.tsx): un meeting non ancora revisionato non deve interrompere la
  // serie. Mai calcolato su meetingPubblico: quella vista non ha comunque mai il campo sentiment
  // (MeetingCampiPubblici, whitelist positiva) e il componente sotto è gated su clienteId.
  const andamento = useMemo(
    () => andamentoSentiment((meetingTeam ?? []).filter((m) => m.sentiment.trim() !== "")),
    [meetingTeam]
  );
  const [espanso, setEspanso] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  // Tiene traccia dell'ultimo meetingIdEvidenziato "consumato", per aprire quel meeting solo
  // quando la prop CAMBIA (non ad ogni render) — pattern React consigliato per "adeguare lo stato
  // quando cambia una prop": aggiornamento diretto durante il render, non dentro un useEffect
  // (evita il warning react-hooks/set-state-in-effect sul setState sincrono in un effetto).
  const [ultimoEvidenziato, setUltimoEvidenziato] = useState<string | null | undefined>(undefined);
  if (meetingIdEvidenziato && meetingIdEvidenziato !== ultimoEvidenziato) {
    setUltimoEvidenziato(meetingIdEvidenziato);
    setEspanso(meetingIdEvidenziato);
  }

  // Modifica di un meeting già salvato nello storico: bozza separata da m.dati finché non si
  // conferma, stesso endpoint POST /api/meeting di handleSalva (upsert per meetingId = hash di
  // clienteId+rawUrl, invariato qui, quindi è un vero aggiornamento in-place e non una nuova riga).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bozza, setBozza] = useState<MeetingDataLoose | null>(null);
  const [salvandoEdit, setSalvandoEdit] = useState(false);
  const [erroreEdit, setErroreEdit] = useState<string | null>(null);

  // Eliminazione (solo admin, vedi prop ruoloAdmin) — stesso schema "nascondi subito, DELETE reale
  // solo se il toast scade senza Annulla" già in uso per le attività (AttivitaLista.tsx): un Set
  // (non una singola stringa) perché più eliminazioni possono restare in sospeso insieme.
  const [inSospesoPerEliminazione, setInSospesoPerEliminazione] = useState<Set<string>>(new Set());

  function handleEliminaMeeting(meetingId: string) {
    setInSospesoPerEliminazione((prev) => new Set(prev).add(meetingId));
  }

  function annullaEliminazione(meetingId: string) {
    setInSospesoPerEliminazione((prev) => {
      const next = new Set(prev);
      next.delete(meetingId);
      return next;
    });
  }

  async function scadenzaEliminazione(meetingId: string) {
    annullaEliminazione(meetingId); // smonta il toast
    if (!clienteId) return; // guardia: l'azione è admin-gated e visibile solo nel ramo team (clienteId)
    setMeetingTeam((prev) => prev?.filter((m) => m.meetingId !== meetingId) ?? prev);
    try {
      const res = await fetch("/api/meeting/elimina", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, meetingId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Eliminazione non riuscita");
      }
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
      setRefreshTick((t) => t + 1); // ripristina la riga leggendo di nuovo dal server
    }
  }

  useEffect(() => {
    if (!code && !clienteId) return;
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (code) params.set("code", code);
    if (clienteId) params.set("clienteId", clienteId);

    Promise.resolve()
      .then(() => {
        setCaricamento(true);
        setErrore(null);
        return fetch(`/api/meeting?${params.toString()}`, { signal: controller.signal });
      })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Errore nel caricamento dei meeting");
        }
        return res.json();
      })
      .then((data: { meeting: (MeetingClienteRow | MeetingCampiPubblici)[] }) => {
        if (clienteId) setMeetingTeam(data.meeting as MeetingClienteRow[]);
        else setMeetingPubblico(data.meeting as MeetingCampiPubblici[]);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setErrore(err.message);
      })
      .finally(() => setCaricamento(false));

    return () => controller.abort();
  }, [code, clienteId, refreshTick]);

  // Arrivo da "vai al meeting" nel tab Attività: scrolla al meeting giusto (l'apertura è gestita
  // sopra, durante il render). Riprova ad ogni cambio di meetingTeam (non solo quando cambia la
  // prop) — se lo storico non è ancora stato caricato la prima volta, getElementById non trova
  // nulla; quando il fetch completa e la riga entra nel DOM, questo effetto rifira.
  useEffect(() => {
    if (!meetingIdEvidenziato) return;
    const raf = requestAnimationFrame(() => {
      document.getElementById(`meeting-${meetingIdEvidenziato}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(raf);
  }, [meetingIdEvidenziato, meetingTeam]);

  function iniziaModifica(m: MeetingClienteRow) {
    setEditingId(m.meetingId);
    setBozza({ ...m.dati });
    setErroreEdit(null);
  }

  function annullaModifica() {
    setEditingId(null);
    setBozza(null);
    setErroreEdit(null);
  }

  async function salvaModifica() {
    if (!clienteId || !bozza) return;
    setSalvandoEdit(true);
    setErroreEdit(null);
    try {
      const res = await fetch("/api/meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, meeting: bozza }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Salvataggio non riuscito");
      setEditingId(null);
      setBozza(null);
      setRefreshTick((t) => t + 1);
    } catch (err) {
      setErroreEdit(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSalvandoEdit(false);
    }
  }

  if (caricamento && !meetingTeam && !meetingPubblico) return <p className="text-sm text-ink-500">Caricamento…</p>;
  if (errore && !meetingTeam && !meetingPubblico) return <p className="text-sm text-red-600">{errore}</p>;

  const listaVuota = (meetingTeam?.length ?? meetingPubblico?.length ?? 0) === 0;

  return (
    <div className="space-y-3">
      {errore && <p className="text-sm text-red-600">{errore}</p>}

      {clienteId && (
        <NuovoMeetingForm
          clienteId={clienteId}
          clienteNome={clienteNome}
          clienteEmail={clienteEmail}
          onCreato={() => setRefreshTick((t) => t + 1)}
        />
      )}

      {/* Team-only per costruzione: clienteId è l'unico ramo che passa mai una lista non vuota qui,
          il ramo `code` (link pubblico) non arriva mai ad avere sentiment nei dati che riceve. */}
      {clienteId && <AndamentoSentiment andamento={andamento} />}

      {listaVuota && (
        <div className="rounded-2xl border-2 border-dashed border-ink-300 bg-surface-card p-8 text-center">
          <p className="text-sm text-ink-500">Nessun meeting registrato.</p>
        </div>
      )}

      {meetingTeam?.filter((m) => !inSospesoPerEliminazione.has(m.meetingId)).map((m) => {
        const aperto = espanso === m.meetingId;
        const inModifica = editingId === m.meetingId && bozza;
        return (
          <div key={m.meetingId} id={`meeting-${m.meetingId}`} className="space-y-2">
            <button
              type="button"
              onClick={() => setEspanso(aperto ? null : m.meetingId)}
              className={`w-full text-left px-5 py-3.5 flex items-center justify-between gap-3 rounded-2xl border bg-surface-card shadow-sm transition-colors ${
                m.meetingId === meetingIdEvidenziato ? "border-brand ring-2 ring-brand/20" : "border-ink-300"
              }`}
            >
              <div className="min-w-0">
                <p className="font-semibold text-ink-900 truncate">{m.titolo || "(senza titolo)"}</p>
                <p className="text-xs text-ink-500">
                  {formatDataBreve(m.data)}
                  {m.dati.referente ? ` · ${m.dati.referente}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {m.sentiment && <span className="text-[11px] text-ink-500 max-w-[160px] truncate hidden sm:inline">{m.sentiment}</span>}
                <span className="text-ink-300 text-xs">{aperto ? "▲" : "▼"}</span>
              </div>
            </button>

            {aperto && inModifica && bozza && (
              <div className="space-y-3">
                <MeetingReportView meeting={bozza} clienteNome={clienteNome} onChange={(u) => setBozza({ ...bozza, ...u })} />
                {erroreEdit && <p className="text-xs text-red-600">{erroreEdit}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={salvaModifica}
                    disabled={salvandoEdit}
                    className="rounded-xl bg-cta hover:bg-cta-dark disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2.5 transition active:scale-[.98]"
                  >
                    {salvandoEdit ? "Salvataggio…" : "Salva modifiche"}
                  </button>
                  <button
                    type="button"
                    onClick={annullaModifica}
                    className="rounded-xl border border-ink-300 text-sm font-semibold px-4 py-2.5 text-ink-700 hover:bg-surface transition"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            )}

            {aperto && !inModifica && (
              <div className="space-y-3">
                <MeetingReportView meeting={m.dati} clienteNome={clienteNome} />
                <div className="flex justify-end gap-4">
                  <button
                    type="button"
                    onClick={() => iniziaModifica(m)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                  >
                    <Pencil size={12} className="flex-shrink-0" />
                    Modifica report
                  </button>
                  {ruoloAdmin && (
                    <button
                      type="button"
                      onClick={() => handleEliminaMeeting(m.meetingId)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"
                    >
                      <Trash2 size={12} className="flex-shrink-0" />
                      Elimina
                    </button>
                  )}
                </div>
                {clienteId && <MeetingAzioni clienteId={clienteId} meeting={m.dati} clienteNome={clienteNome} />}
              </div>
            )}
          </div>
        );
      })}

      {meetingPubblico?.map((m) => {
        const aperto = espanso === m.meetingId;
        return (
          <div key={m.meetingId} className="rounded-2xl border border-ink-300 bg-surface-card shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setEspanso(aperto ? null : m.meetingId)}
              className="w-full text-left px-5 py-3.5 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="font-semibold text-ink-900 truncate">{m.titolo || "(senza titolo)"}</p>
                <p className="text-xs text-ink-500">
                  {formatDataBreve(m.data)}
                  {m.durata ? ` · ${m.durata}` : ""}
                </p>
              </div>
            </button>
            {aperto && (
              <div className="px-5 pb-4 space-y-2 border-t border-ink-300/40 pt-3 text-sm">
                {m.riassunto && <p className="text-ink-700">{m.riassunto}</p>}
                {m.partecipanti.length > 0 && <p className="text-xs text-ink-500">Partecipanti: {m.partecipanti.join(", ")}</p>}
                {m.azioni.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-ink-700 mt-2">Azioni ({m.azioni.length})</p>
                    <ul className="text-xs text-ink-500 list-disc list-inside space-y-0.5 mt-1">
                      {m.azioni.map((a, i) => (
                        <li key={i}>
                          {a.assegnatario ? `${a.assegnatario}: ` : ""}
                          {a.testo}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Stack di toast "eliminato — Annulla", uno per eliminazione in sospeso — vedi il commento
          su inSospesoPerEliminazione sopra. Fixed in basso, stesso pattern di AttivitaLista.tsx. */}
      {inSospesoPerEliminazione.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 space-y-2">
          {Array.from(inSospesoPerEliminazione).map((meetingId) => (
            <UndoToast
              key={meetingId}
              messaggio="Meeting eliminato."
              onAnnulla={() => annullaEliminazione(meetingId)}
              onScadenza={() => scadenzaEliminazione(meetingId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
