"use client";

import { useEffect, useState } from "react";
import { formatDataBreve } from "@/lib/format";
import { buildEmailText } from "@/lib/meetingEmail";
import { MeetingReportView } from "@/components/MeetingReportView";
import type { MeetingCampiPubblici, MeetingClienteRow, MeetingDataLoose } from "@/types/meeting";

type Props = {
  code?: string;
  clienteId?: string;
  clienteNome?: string;
  clienteEmail?: string;
  meetingIdEvidenziato?: string | null;
};

const inputClass =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition";
// Senza "w-full": per gli input dentro una riga flex (testo + assegnatario), dove la larghezza
// deve venire da flex-1/w-32 e non da w-full — le due classi insieme sullo stesso elemento
// vanno in conflitto sulla proprietà width (ordine di generazione Tailwind, non l'ordine nella
// stringa className), causando il campo assegnatario a espandersi su tutta la riga in anteprima.
const inputClassFlex = inputClass.replace("w-full ", "");
const labelClass = "text-xs font-semibold text-gray-700 mb-1 block";

/**
 * Bottoni "Scarica PDF" / "Genera email di follow-up" — porting delle azioni di Fast Report
 * (`handleDownloadPDF`/`EmailTemplate.tsx`), montato sia sull'anteprima pre-salvataggio sia su
 * ogni meeting già salvato nello storico (possibile solo perché qui c'è uno storico persistente,
 * che Fast Report non aveva). Solo contesto team: /api/meeting/pdf richiede sessione.
 *
 * `testoEmailControllato`/`onCambiaTestoEmail` (opzionali): se presenti, il testo dell'email vive
 * nello stato del genitore invece che qui — serve solo all'istanza nell'anteprima, dove il testo
 * (eventualmente corretto a mano) deve essere quello davvero usato dall'invio automatico al
 * salvataggio, non uno rigenerato da zero. Le istanze nello storico restano non controllate,
 * comportamento invariato: lì l'invio automatico non si applica.
 */
function MeetingAzioni({
  clienteId,
  meeting,
  clienteNome,
  testoEmailControllato,
  onCambiaTestoEmail,
}: {
  clienteId: string;
  meeting: MeetingDataLoose;
  clienteNome?: string;
  testoEmailControllato?: string | null;
  onCambiaTestoEmail?: (v: string | null) => void;
}) {
  const [scaricando, setScaricando] = useState(false);
  const [errorePdf, setErrorePdf] = useState<string | null>(null);
  const [mostraEmail, setMostraEmail] = useState(false);
  const [testoEmailInterno, setTestoEmailInterno] = useState<string | null>(null);
  const testoEmail = onCambiaTestoEmail ? (testoEmailControllato ?? null) : testoEmailInterno;
  const setTestoEmail = onCambiaTestoEmail ?? setTestoEmailInterno;
  const [copiato, setCopiato] = useState(false);

  async function handleScaricaPdf() {
    setScaricando(true);
    setErrorePdf(null);
    try {
      const res = await fetch("/api/meeting/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, meeting }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Errore generazione PDF");
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      const clienteSlug = (clienteNome || meeting.title || "meeting")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 40);
      const dataSlug = (meeting.dataConsulenza || meeting.date || "").replace(/\//g, "-");
      a.download = `report-${clienteSlug}${dataSlug ? `-${dataSlug}` : ""}.pdf`;
      a.click();
      URL.revokeObjectURL(objUrl);
    } catch (err) {
      setErrorePdf(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setScaricando(false);
    }
  }

  function handleGeneraEmail() {
    if (!mostraEmail) setTestoEmail(buildEmailText(meeting, clienteNome ?? ""));
    setMostraEmail((v) => !v);
  }

  async function handleCopiaEmail() {
    if (!testoEmail) return;
    await navigator.clipboard.writeText(testoEmail);
    setCopiato(true);
    setTimeout(() => setCopiato(false), 2500);
  }

  return (
    <div className="pt-3 mt-3 border-t border-gray-100 space-y-2.5">
      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={handleScaricaPdf}
          disabled={scaricando}
          className="rounded-xl border-2 border-brand text-sm font-semibold px-4 py-2 text-brand hover:bg-brand-light disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer active:scale-[.98]"
        >
          {scaricando ? "Generazione PDF…" : "📄 Scarica PDF"}
        </button>
        <button
          type="button"
          onClick={handleGeneraEmail}
          className="rounded-xl border-2 border-brand text-sm font-semibold px-4 py-2 text-brand hover:bg-brand-light transition cursor-pointer active:scale-[.98]"
        >
          {mostraEmail ? "✉️ Nascondi email" : "✉️ Genera email di follow-up"}
        </button>
      </div>
      {errorePdf && <p className="text-xs text-red-600">{errorePdf}</p>}
      {mostraEmail && testoEmail !== null && (
        <div className="space-y-1.5">
          <textarea
            className={`${inputClass} resize-none text-xs leading-relaxed`}
            rows={8}
            value={testoEmail}
            onChange={(e) => setTestoEmail(e.target.value)}
          />
          <button
            type="button"
            onClick={handleCopiaEmail}
            className="rounded-xl bg-cta hover:bg-cta-dark text-white text-sm font-semibold px-4 py-2 transition cursor-pointer active:scale-[.98]"
          >
            {copiato ? "Copiato ✓" : "Copia email"}
          </button>
        </div>
      )}
    </div>
  );
}

export function MeetingTab({ code, clienteId, clienteNome, clienteEmail, meetingIdEvidenziato }: Props) {
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [meetingTeam, setMeetingTeam] = useState<MeetingClienteRow[] | null>(null);
  const [meetingPubblico, setMeetingPubblico] = useState<MeetingCampiPubblici[] | null>(null);
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

  const [mostraForm, setMostraForm] = useState(false);
  const [url, setUrl] = useState("");
  const [estraendo, setEstraendo] = useState(false);
  const [anteprima, setAnteprima] = useState<MeetingDataLoose | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroreForm, setErroreForm] = useState<string | null>(null);

  // Invio automatico dell'email di follow-up al primo salvataggio — checkbox selezionata di
  // default solo se il cliente ha un'email impostata (altrimenti non c'è nulla da inviare).
  // `emailBozza` è il testo dell'email "lifted" da MeetingAzioni: se l'utente lo apre e lo
  // corregge a mano prima di salvare, è quella versione a dover essere davvero inviata, non una
  // rigenerata da zero al momento del salvataggio.
  const [inviaAutomatica, setInviaAutomatica] = useState(!!clienteEmail);
  const [emailBozza, setEmailBozza] = useState<string | null>(null);
  const [esitoInvio, setEsitoInvio] = useState<{ inviata: boolean; errore: string | null } | null>(null);

  // Modifica di un meeting già salvato nello storico: bozza separata da m.dati finché non si
  // conferma, stesso endpoint POST /api/meeting di handleSalva (upsert per meetingId = hash di
  // clienteId+rawUrl, invariato qui, quindi è un vero aggiornamento in-place e non una nuova riga).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bozza, setBozza] = useState<MeetingDataLoose | null>(null);
  const [salvandoEdit, setSalvandoEdit] = useState(false);
  const [erroreEdit, setErroreEdit] = useState<string | null>(null);

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

  async function handleEstrai(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId) return;
    setEstraendo(true);
    setErroreForm(null);
    setEsitoInvio(null);
    try {
      const res = await fetch("/api/meeting/estrai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, url }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Estrazione non riuscita");
      setAnteprima(body as MeetingDataLoose);
      setInviaAutomatica(!!clienteEmail);
      setEmailBozza(null);
    } catch (err) {
      setErroreForm(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setEstraendo(false);
    }
  }

  async function handleSalva() {
    if (!clienteId || !anteprima) return;
    setSalvando(true);
    setErroreForm(null);
    try {
      const res = await fetch("/api/meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId,
          meeting: anteprima,
          inviaEmailAutomatica: inviaAutomatica,
          testoEmailBozza: emailBozza ?? undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Salvataggio non riuscito");
      // Il server tenta l'invio SOLO al primo salvataggio (mai su un upsert di un meeting già
      // esistente, es. stesso link incollato di nuovo per errore in "+ Nuovo meeting" invece che
      // "✎ Modifica report"): se `aggiornato` è true, il server non ha nemmeno provato, quindi
      // qui non c'è nessun esito da mostrare — mostrarlo comunque avrebbe stampato un fuorviante
      // "non riuscito: null" (emailInviata/erroreEmail restano ai valori di default, mai popolati).
      if (inviaAutomatica && !body.aggiornato) {
        setEsitoInvio({
          inviata: !!body.emailInviata,
          errore: body.erroreEmail ?? (body.emailInviata ? null : "errore sconosciuto"),
        });
      }
      setAnteprima(null);
      setUrl("");
      setMostraForm(false);
      setRefreshTick((t) => t + 1);
    } catch (err) {
      setErroreForm(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSalvando(false);
    }
  }

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

  if (caricamento && !meetingTeam && !meetingPubblico) return <p className="text-sm text-gray-500">Caricamento…</p>;
  if (errore && !meetingTeam && !meetingPubblico) return <p className="text-sm text-red-600">{errore}</p>;

  const listaVuota = (meetingTeam?.length ?? meetingPubblico?.length ?? 0) === 0;

  return (
    <div className="space-y-3">
      {errore && <p className="text-sm text-red-600">{errore}</p>}

      {esitoInvio && (
        <div
          className={`rounded-xl border p-3 flex items-start justify-between gap-3 text-xs ${
            esitoInvio.inviata ? "bg-green-50 border-green-100 text-green-700" : "bg-yellow-50 border-yellow-100 text-yellow-800"
          }`}
        >
          <p>
            {esitoInvio.inviata
              ? `✅ Meeting salvato ed email inviata a ${clienteEmail}.`
              : `⚠️ Meeting salvato, ma l'invio email non è riuscito: ${esitoInvio.errore}. Usa "Genera email di follow-up" sul meeting salvato per copiarla a mano.`}
          </p>
          <button type="button" onClick={() => setEsitoInvio(null)} className="text-current opacity-60 hover:opacity-100 flex-shrink-0" aria-label="Chiudi">
            ×
          </button>
        </div>
      )}

      {clienteId && !anteprima && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
          {!mostraForm ? (
            <button
              type="button"
              onClick={() => setMostraForm(true)}
              className="rounded-xl bg-cta hover:bg-cta-dark text-white text-sm font-semibold px-4 py-2.5 transition active:scale-[.98]"
            >
              + Nuovo meeting
            </button>
          ) : (
            <form onSubmit={handleEstrai} className="space-y-2">
              <label className={labelClass}>Link del meeting (Fathom, Circleback o Loom)</label>
              <div className="flex flex-wrap gap-2">
                <input
                  className={`${inputClassFlex} flex-1 min-w-[220px]`}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://…"
                  required
                />
                <button
                  type="submit"
                  disabled={estraendo || !url}
                  className="rounded-xl bg-cta hover:bg-cta-dark disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2.5 transition whitespace-nowrap"
                >
                  {estraendo ? "Estrazione…" : "Estrai"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMostraForm(false);
                    setUrl("");
                    setErroreForm(null);
                  }}
                  className="rounded-xl border border-gray-200 text-sm font-semibold px-3 py-2.5 text-gray-500 hover:bg-gray-50 transition"
                >
                  Annulla
                </button>
              </div>
              {estraendo && (
                <p className="text-xs text-gray-500">
                  Estrazione in corso — scraping della pagina più lettura del modello, con eventuale nuovo
                  tentativo automatico in caso di errore transitorio: può richiedere fino a due minuti e
                  mezzo…
                </p>
              )}
              {erroreForm && <p className="text-xs text-red-600">{erroreForm}</p>}
            </form>
          )}
        </div>
      )}

      {anteprima && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-900">Anteprima — verifica e modifica prima di salvare</h4>

          <MeetingReportView meeting={anteprima} clienteNome={clienteNome} onChange={(u) => setAnteprima({ ...anteprima, ...u })} />

          {clienteId && (
            <MeetingAzioni
              clienteId={clienteId}
              meeting={anteprima}
              clienteNome={clienteNome}
              testoEmailControllato={emailBozza}
              onCambiaTestoEmail={setEmailBozza}
            />
          )}

          <label
            className={`flex items-center gap-2 text-xs pt-1 ${clienteEmail ? "text-gray-600 cursor-pointer" : "text-gray-400"}`}
          >
            <input
              type="checkbox"
              checked={inviaAutomatica}
              disabled={!clienteEmail}
              onChange={(e) => setInviaAutomatica(e.target.checked)}
              className="accent-current text-brand"
            />
            {clienteEmail
              ? `Invia email al cliente in automatico (a ${clienteEmail}, con PDF allegato)`
              : "Invia email al cliente in automatico — aggiungi l'email del cliente nella scheda cliente per abilitarlo"}
          </label>

          {erroreForm && <p className="text-xs text-red-600">{erroreForm}</p>}

          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={handleSalva}
              disabled={salvando}
              className="rounded-xl bg-cta hover:bg-cta-dark disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2.5 transition active:scale-[.98]"
            >
              {salvando ? (inviaAutomatica ? "Salvataggio e invio…" : "Salvataggio…") : "Salva"}
            </button>
            <button
              type="button"
              onClick={() => setAnteprima(null)}
              className="rounded-xl border border-gray-200 text-sm font-semibold px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {listaVuota && !anteprima && (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-500">Nessun meeting registrato.</p>
        </div>
      )}

      {meetingTeam?.map((m) => {
        const aperto = espanso === m.meetingId;
        const inModifica = editingId === m.meetingId && bozza;
        return (
          <div key={m.meetingId} id={`meeting-${m.meetingId}`} className="space-y-2">
            <button
              type="button"
              onClick={() => setEspanso(aperto ? null : m.meetingId)}
              className={`w-full text-left px-5 py-3.5 flex items-center justify-between gap-3 rounded-2xl border bg-white shadow-sm transition-colors ${
                m.meetingId === meetingIdEvidenziato ? "border-brand ring-2 ring-brand/20" : "border-gray-200"
              }`}
            >
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">{m.titolo || "(senza titolo)"}</p>
                <p className="text-xs text-gray-400">
                  {formatDataBreve(m.data)}
                  {m.dati.referente ? ` · ${m.dati.referente}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {m.sentiment && <span className="text-[11px] text-gray-500 max-w-[160px] truncate hidden sm:inline">{m.sentiment}</span>}
                <span className="text-gray-300 text-xs">{aperto ? "▲" : "▼"}</span>
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
                    className="rounded-xl border border-gray-200 text-sm font-semibold px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            )}

            {aperto && !inModifica && (
              <div className="space-y-3">
                <MeetingReportView meeting={m.dati} clienteNome={clienteNome} />
                <div className="flex justify-end">
                  <button type="button" onClick={() => iniziaModifica(m)} className="text-xs font-semibold text-brand hover:underline">
                    ✎ Modifica report
                  </button>
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
          <div key={m.meetingId} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setEspanso(aperto ? null : m.meetingId)}
              className="w-full text-left px-5 py-3.5 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">{m.titolo || "(senza titolo)"}</p>
                <p className="text-xs text-gray-400">
                  {formatDataBreve(m.data)}
                  {m.durata ? ` · ${m.durata}` : ""}
                </p>
              </div>
            </button>
            {aperto && (
              <div className="px-5 pb-4 space-y-2 border-t border-gray-100 pt-3 text-sm">
                {m.riassunto && <p className="text-gray-700">{m.riassunto}</p>}
                {m.partecipanti.length > 0 && <p className="text-xs text-gray-500">Partecipanti: {m.partecipanti.join(", ")}</p>}
                {m.azioni.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mt-2">Azioni ({m.azioni.length})</p>
                    <ul className="text-xs text-gray-600 list-disc list-inside space-y-0.5 mt-1">
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
    </div>
  );
}
