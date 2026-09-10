"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { MeetingReportView } from "@/components/MeetingReportView";
import { MeetingAzioni } from "@/components/MeetingAzioni";
import type { TroncamentoInfo } from "@/lib/estrazione";
import type { MeetingDataLoose } from "@/types/meeting";

const inputClass =
  "w-full rounded-xl border border-ink-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition";
const inputClassFlex = inputClass.replace("w-full ", "");
const labelClass = "text-xs font-semibold text-ink-700 mb-1 block";

type Props = {
  // Assente SOLO nella vista aggregata (MeetingGlobali.tsx): il form mostra prima un select
  // cliente (richiede `clienti`) prima dei campi già usati nel tab per-cliente (MeetingTab.tsx,
  // dove clienteId è già il contesto della pagina e non serve scegliere).
  clienteId?: string;
  clienteNome?: string;
  clienteEmail?: string;
  // Presente SOLO quando clienteId è assente — lista clienti tra cui scegliere, con l'email (serve
  // per il default/etichetta della checkbox invio automatico una volta scelto il cliente).
  clienti?: { clienteId: string; nome: string; email: string }[];
  onCreato: () => void;
};

/**
 * "+ Nuovo meeting" — estrazione da link (Fathom/Circleback/Loom) → anteprima AI → salvataggio,
 * con invio email di follow-up opzionale. Estratta da MeetingTab.tsx (dove viveva non esportata) e
 * generalizzata con un `clienteId` opzionale per riuso anche in MeetingGlobali.tsx (caricamento
 * registrazione anche dal menù generale, 09/09/2026) — lì non c'è un cliente di contesto, va
 * scelto. Stesso pattern di NuovaAttivitaForm.tsx (redesign Attività, Fase 5). A differenza di
 * quella, qui il cliente va scelto PRIMA di poter estrarre: `/api/meeting/estrai` richiede
 * clienteId solo per il controllo di autorizzazione, ma senza saperlo non ha senso nemmeno provare.
 * Dopo la creazione richiama `onCreato` (il chiamante ricarica dati reali).
 */
export function NuovoMeetingForm({ clienteId: clienteIdFisso, clienteNome: clienteNomeFisso, clienteEmail: clienteEmailFisso, clienti = [], onCreato }: Props) {
  const [mostraForm, setMostraForm] = useState(false);
  const [clienteIdScelto, setClienteIdScelto] = useState("");
  const [url, setUrl] = useState("");
  const [estraendo, setEstraendo] = useState(false);
  const [anteprima, setAnteprima] = useState<MeetingDataLoose | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroreForm, setErroreForm] = useState<string | null>(null);
  // Segnale momentaneo (non salvato) di quanto testo scrapato non è stato passato al modello
  // perché oltre il limite caratteri/token del piano Groq — vedi estrazione.ts. Solo per chi sta
  // creando il report in quel momento, non un campo del dato persistito.
  const [troncamento, setTroncamento] = useState<TroncamentoInfo | null>(null);
  const [inviaAutomatica, setInviaAutomatica] = useState(!!clienteEmailFisso);
  const [emailBozza, setEmailBozza] = useState<string | null>(null);
  const [esitoInvio, setEsitoInvio] = useState<{ inviata: boolean; errore: string | null } | null>(null);

  const clienteId = clienteIdFisso ?? clienteIdScelto;
  const clienteScelto = clienti.find((c) => c.clienteId === clienteIdScelto);
  const clienteNome = clienteNomeFisso ?? clienteScelto?.nome;
  const clienteEmail = clienteEmailFisso ?? clienteScelto?.email;

  function chiudiEResetta() {
    setMostraForm(false);
    setClienteIdScelto("");
    setUrl("");
    setAnteprima(null);
    setTroncamento(null);
    setErroreForm(null);
  }

  async function handleEstrai(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId) return;
    setEstraendo(true);
    setErroreForm(null);
    setEsitoInvio(null);
    setTroncamento(null);
    try {
      const res = await fetch("/api/meeting/estrai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, url }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Estrazione non riuscita");
      const { dati, troncamento: info } = body as { dati: MeetingDataLoose; troncamento: TroncamentoInfo | null };
      setAnteprima(dati);
      setTroncamento(info);
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
      // esistente): se `aggiornato` è true, il server non ha nemmeno provato, quindi qui non c'è
      // nessun esito da mostrare — mostrarlo comunque avrebbe stampato un fuorviante "non riuscito:
      // null" (emailInviata/erroreEmail restano ai valori di default, mai popolati).
      if (inviaAutomatica && !body.aggiornato) {
        setEsitoInvio({
          inviata: !!body.emailInviata,
          errore: body.erroreEmail ?? (body.emailInviata ? null : "errore sconosciuto"),
        });
      }
      setAnteprima(null);
      setTroncamento(null);
      setUrl("");
      setClienteIdScelto("");
      setMostraForm(false);
      onCreato();
    } catch (err) {
      setErroreForm(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSalvando(false);
    }
  }

  if (!mostraForm) {
    return (
      <button
        type="button"
        onClick={() => setMostraForm(true)}
        className="rounded-xl bg-cta hover:bg-cta-dark text-white text-sm font-semibold px-4 py-2.5 transition active:scale-[.98]"
      >
        + Nuovo meeting
      </button>
    );
  }

  return (
    <div className="space-y-3">
      {esitoInvio && (
        <div
          className={`rounded-xl border p-3 flex items-start justify-between gap-3 text-xs ${
            esitoInvio.inviata ? "bg-green-50 border-green-100 text-green-700" : "bg-yellow-50 border-yellow-100 text-yellow-800"
          }`}
        >
          <p className="flex items-start gap-1.5">
            {esitoInvio.inviata ? (
              <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            )}
            <span>
              {esitoInvio.inviata
                ? `Meeting salvato ed email inviata a ${clienteEmail}.`
                : `Meeting salvato, ma l'invio email non è riuscito: ${esitoInvio.errore}. Usa "Genera email di follow-up" sul meeting salvato per copiarla a mano.`}
            </span>
          </p>
          <button type="button" onClick={() => setEsitoInvio(null)} className="text-current opacity-60 hover:opacity-100 flex-shrink-0" aria-label="Chiudi">
            ×
          </button>
        </div>
      )}

      {!anteprima && (
        <div className="rounded-2xl border border-ink-300 bg-surface-card shadow-sm p-4">
          <form onSubmit={handleEstrai} className="space-y-2">
            {!clienteIdFisso && (
              <div>
                <label className={labelClass}>Cliente</label>
                <select
                  className={inputClass}
                  value={clienteIdScelto}
                  onChange={(e) => setClienteIdScelto(e.target.value)}
                  autoFocus
                >
                  <option value="">Scegli un cliente…</option>
                  {clienti
                    .slice()
                    .sort((a, b) => a.nome.localeCompare(b.nome))
                    .map((c) => (
                      <option key={c.clienteId} value={c.clienteId}>
                        {c.nome}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <label className={labelClass}>Link del meeting (Fathom, Circleback o Loom)</label>
            <div className="flex flex-wrap gap-2">
              <input
                className={`${inputClassFlex} flex-1 min-w-[220px]`}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                disabled={!clienteId}
                required
              />
              <button
                type="submit"
                disabled={estraendo || !url || !clienteId}
                className="rounded-xl bg-cta hover:bg-cta-dark disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2.5 transition whitespace-nowrap"
              >
                {estraendo ? "Estrazione…" : "Estrai"}
              </button>
              <button
                type="button"
                onClick={chiudiEResetta}
                className="rounded-xl border border-ink-300 text-sm font-semibold px-3 py-2.5 text-ink-500 hover:bg-surface transition"
              >
                Annulla
              </button>
            </div>
            {!clienteIdFisso && !clienteId && (
              <p className="text-xs text-ink-500">Scegli prima un cliente per poter estrarre il meeting.</p>
            )}
            {estraendo && (
              <p className="text-xs text-ink-500">
                Estrazione in corso — scraping della pagina più lettura del modello, con eventuale nuovo
                tentativo automatico in caso di errore transitorio: può richiedere fino a due minuti e
                mezzo…
              </p>
            )}
            {erroreForm && <p className="text-xs text-red-600">{erroreForm}</p>}
          </form>
        </div>
      )}

      {anteprima && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-ink-900">Anteprima — verifica e modifica prima di salvare</h4>

          {troncamento && (
            <p className="text-xs bg-yellow-50 border border-yellow-100 text-yellow-800 rounded-lg px-3 py-2.5">
              La chiamata era più lunga di quanto il modello riesca ad analizzare in un colpo solo: elaborati{" "}
              {troncamento.caratteriElaborati.toLocaleString("it-IT")} di{" "}
              {troncamento.caratteriTotali.toLocaleString("it-IT")} caratteri (
              {Math.round((troncamento.caratteriElaborati / troncamento.caratteriTotali) * 100)}%). Le parti finali
              della chiamata potrebbero non essere riflesse nel report — controlla con attenzione prima di salvare.
            </p>
          )}

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
            className={`flex items-center gap-2 text-xs pt-1 ${clienteEmail ? "text-ink-500 cursor-pointer" : "text-ink-500"}`}
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

          <div className="flex gap-2 pt-2 border-t border-ink-300/40">
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
              onClick={() => {
                setAnteprima(null);
                setTroncamento(null);
              }}
              className="rounded-xl border border-ink-300 text-sm font-semibold px-4 py-2.5 text-ink-700 hover:bg-surface transition"
            >
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
