"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs } from "@/components/Tabs";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Nota } from "@/components/ui/Nota";
import { PulsanteIcona } from "@/components/ui/PulsanteIcona";
import {
  controllaRigheCommerciali,
  erroreSulPeriodo,
  etichettaPeriodo,
  granularitaDi,
  intervalloDelPeriodo,
  periodiSovrapposti,
  periodoFuturo,
  settimanaACavalloDiDueMesi,
  spostaPeriodo,
  ultimoPeriodoConcluso,
  type Granularita,
} from "@/lib/risultatiManuali";

type RigaSalvata = {
  periodo: string;
  tipoCampagna: string;
  richieste: number;
  appuntamentiFissati: number;
  appuntamentiEffettuati: number;
  vendite: number;
  fatturato: number;
};

const CAMPI = [
  { chiave: "richieste", etichetta: "Richieste", passo: "1" },
  { chiave: "appuntamentiFissati", etichetta: "Appuntamenti fissati", passo: "1" },
  { chiave: "appuntamentiEffettuati", etichetta: "Appuntamenti effettuati", passo: "1" },
  { chiave: "vendite", etichetta: "Vendite", passo: "1" },
  { chiave: "fatturato", etichetta: "Fatturato (€)", passo: "0.01" },
] as const;
type Campo = (typeof CAMPI)[number]["chiave"];
type ValoriRiga = Record<Campo, string>;

const GRANULARITA = [
  { id: "settimana", label: "Settimana" },
  { id: "mese", label: "Mese" },
];

// Le colonne della griglia su schermo largo: il nome del tipo, poi i cinque campi.
const GRIGLIA = "sm:grid-cols-[minmax(7rem,1.3fr)_repeat(5,minmax(0,1fr))]";

const RIGA_VUOTA: ValoriRiga = { richieste: "", appuntamentiFissati: "", appuntamentiEffettuati: "", vendite: "", fatturato: "" };

/**
 * Inserimento dei risultati commerciali di una sede — richieste, appuntamenti, vendite e fatturato
 * per tipo di campagna — un periodo alla volta (una settimana o un mese). Sostituisce la scheda del
 * foglio Google in cui si scrivevano a mano fino al 07/10/2026.
 *
 * Regole (src/lib/risultatiManuali.ts):
 *   - una riga lasciata tutta vuota non viene salvata: quel tipo resta "non compilato", mai uno zero
 *     che nessuno ha dichiarato; in una riga con almeno un valore i campi vuoti valgono zero;
 *   - un mese e le sue settimane non possono essere compilati entrambi (si conterebbero due volte).
 */
export function RisultatiCommercialiModal({
  clienteId,
  sedeId,
  nomeSede,
  tipiCampagna,
  fonteAutomatica,
  onClose,
  onSalvato,
}: {
  clienteId: string;
  sedeId: string;
  /** Mostrato nel titolo solo se il cliente ha più sedi (altrimenti undefined). */
  nomeSede?: string;
  /** I tipi delle campagne che la scheda sta contando ("" = senza tipo). Mai vuoto. */
  tipiCampagna: string[];
  /** La sede legge vendite e appuntamenti anche da GHL o dal file contatti. */
  fonteAutomatica: boolean;
  onClose: () => void;
  onSalvato: () => void;
}) {
  // Le righe lette dal server e a quale lettura appartengono: dopo un salvataggio `versione` avanza,
  // parte una nuova lettura, e il modulo riparte dai valori salvati solo quando quella è arrivata
  // (fino ad allora resta com'è, con ciò che la persona ha appena scritto).
  const [lettura, setLettura] = useState<{ versione: number; righe: RigaSalvata[] } | null>(null);
  const [erroreLettura, setErroreLettura] = useState<string | null>(null);
  const [versione, setVersione] = useState(0);
  const [periodo, setPeriodo] = useState(() => ultimoPeriodoConcluso("settimana"));
  const [messaggio, setMessaggio] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/risultati-commerciali?clienteId=${encodeURIComponent(clienteId)}&sedeId=${encodeURIComponent(sedeId)}`, { signal: controller.signal })
      .then(async (res) => {
        const corpo = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(corpo.error || "Lettura non riuscita");
        setLettura({ versione, righe: (corpo as { righe: RigaSalvata[] }).righe });
        setErroreLettura(null);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setErroreLettura(err instanceof Error ? err.message : "Lettura non riuscita");
      });
    return () => controller.abort();
  }, [clienteId, sedeId, versione]);

  const salvate = lettura?.righe ?? null;
  const granularita = granularitaDi(periodo);
  const compilati = Array.from(new Set((salvate ?? []).map((r) => r.periodo)));
  const delPeriodo = (salvate ?? []).filter((r) => r.periodo === periodo);
  const sovrapposti = periodiSovrapposti(periodo, compilati);
  // I tipi delle campagne contate, più quelli che in questo periodo hanno già una riga: niente di ciò che è salvato resta nascosto.
  const tipi = Array.from(new Set([...tipiCampagna, ...delPeriodo.map((r) => r.tipoCampagna)]));

  function vaiA(nuovo: string) {
    setPeriodo(nuovo);
    setMessaggio(null);
  }

  return (
    <Modal title="Risultati commerciali" onClose={onClose} maxWidth="max-w-4xl">
      <p className="-mt-2 text-sm text-ink-500">
        {nomeSede ? `Sede ${nomeSede}. ` : ""}Richieste, appuntamenti, vendite e fatturato che non arrivano da soli: si inseriscono qui, un periodo alla volta.
      </p>

      {fonteAutomatica && (
        <Nota tono="accento" etichetta="da sapere" compatta>
          <p>
            Questa sede legge vendite e fatturato (e gli appuntamenti, se i calendari sono collegati) da GHL o dal file contatti: quando quella fonte risponde, le tessere in alto mostrano i suoi
            numeri. Quelli inseriti qui restano nel dettaglio per tipo di campagna.
          </p>
        </Nota>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Tabs etichetta="Durata del periodo" tabs={GRANULARITA} attivo={granularita} onChange={(id) => vaiA(ultimoPeriodoConcluso(id as Granularita))} />
        <div className="flex items-center gap-1">
          <PulsanteIcona etichetta="Periodo precedente" onClick={() => vaiA(spostaPeriodo(periodo, -1))}>
            <ChevronLeft size={20} aria-hidden="true" />
          </PulsanteIcona>
          <p aria-live="polite" className="min-w-44 text-center text-sm font-bold text-ink-900 tabular-nums">
            {etichettaPeriodo(periodo)}
          </p>
          <PulsanteIcona etichetta="Periodo successivo" onClick={() => vaiA(spostaPeriodo(periodo, 1))} disabled={periodoFuturo(spostaPeriodo(periodo, 1))}>
            <ChevronRight size={20} aria-hidden="true" />
          </PulsanteIcona>
        </div>
        {salvate && <Badge tono={delPeriodo.length > 0 ? "successo" : "neutro"}>{delPeriodo.length > 0 ? "compilato" : "non compilato"}</Badge>}
      </div>

      {settimanaACavalloDiDueMesi(periodo) && (
        <p className="text-xs text-ink-500">Questa settimana è a cavallo di due mesi: nella scheda conta solo quando il periodo scelto la contiene tutta, quindi in nessuno dei due mesi presi da soli.</p>
      )}

      {erroreLettura && (
        <Nota tono="critico" etichetta="Risultati non letti" role="alert">
          <p>{erroreLettura}</p>
        </Nota>
      )}
      {!salvate && !erroreLettura && (
        <p role="status" className="text-sm text-ink-500">
          Caricamento…
        </p>
      )}

      {salvate && sovrapposti.length > 0 && delPeriodo.length === 0 ? (
        <Nota tono="attenzione" etichetta="Periodo già coperto">
          <p>{erroreSulPeriodo(periodo, true, compilati)}</p>
        </Nota>
      ) : (
        salvate && (
          <ModuloPeriodo
            // Cambiando periodo, o quando arriva la lettura fatta dopo un salvataggio, il modulo riparte dai valori salvati.
            key={`${periodo}/${lettura?.versione ?? 0}`}
            clienteId={clienteId}
            sedeId={sedeId}
            periodo={periodo}
            tipi={tipi}
            delPeriodo={delPeriodo}
            compilati={compilati}
            onSalvato={(testo) => {
              setMessaggio(testo);
              setVersione((v) => v + 1);
              onSalvato();
            }}
            onClose={onClose}
          />
        )
      )}

      {messaggio && (
        <p role="status" className="text-sm font-semibold text-ok">
          {messaggio}
        </p>
      )}

      {compilati.length > 0 && (
        <div className="space-y-2 border-t border-linea pt-4">
          <p className="text-xs font-bold text-ink-700">Periodi già compilati</p>
          <div className="flex flex-wrap gap-1.5">
            {compilati
              .sort((a, b) => intervalloDelPeriodo(b).da.localeCompare(intervalloDelPeriodo(a).da) || a.length - b.length)
              .slice(0, 16)
              .map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => vaiA(p)}
                  aria-current={p === periodo ? "true" : undefined}
                  className={`min-h-8 cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    p === periodo ? "border-brand bg-brand-light text-accento-testo" : "border-linea bg-surface-card text-ink-700 hover:border-brand hover:text-accento-testo"
                  }`}
                >
                  {etichettaPeriodo(p)}
                </button>
              ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

function valoriIniziali(tipi: string[], delPeriodo: RigaSalvata[]): Record<string, ValoriRiga> {
  const iniziali: Record<string, ValoriRiga> = {};
  for (const tipo of tipi) {
    const salvata = delPeriodo.find((r) => r.tipoCampagna === tipo);
    iniziali[tipo] = salvata
      ? {
          richieste: String(salvata.richieste),
          appuntamentiFissati: String(salvata.appuntamentiFissati),
          appuntamentiEffettuati: String(salvata.appuntamentiEffettuati),
          vendite: String(salvata.vendite),
          fatturato: String(salvata.fatturato),
        }
      : RIGA_VUOTA;
  }
  return iniziali;
}

function ModuloPeriodo({
  clienteId,
  sedeId,
  periodo,
  tipi,
  delPeriodo,
  compilati,
  onSalvato,
  onClose,
}: {
  clienteId: string;
  sedeId: string;
  periodo: string;
  tipi: string[];
  delPeriodo: RigaSalvata[];
  compilati: string[];
  onSalvato: (messaggio: string) => void;
  onClose: () => void;
}) {
  const [valori, setValori] = useState(() => valoriIniziali(tipi, delPeriodo));
  const [salvando, setSalvando] = useState<"salva" | "svuota" | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  // Svuotare cancella ciò che qualcuno ha inserito: il pulsante chiede conferma con un secondo clic.
  const [confermaSvuota, setConfermaSvuota] = useState(false);

  // Con un solo tipo, ed è quello "senza tipo", la riga vale per tutte le campagne della sede.
  const nomeTipo = (tipo: string) => tipo || (tipi.length === 1 ? "Tutte le campagne" : "Non classificata");

  function imposta(tipo: string, campo: Campo, valore: string) {
    setValori((prima) => ({ ...prima, [tipo]: { ...prima[tipo], [campo]: valore } }));
    setErrore(null);
  }

  async function invia(righe: unknown[], azione: "salva" | "svuota") {
    setSalvando(azione);
    setErrore(null);
    try {
      const res = await fetch("/api/risultati-commerciali", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, sedeId, periodo, righe }),
      });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo.error || "Salvataggio non riuscito");
      onSalvato(azione === "svuota" ? `${etichettaPeriodo(periodo)}: risultati tolti, il periodo è di nuovo non compilato.` : `${etichettaPeriodo(periodo)}: risultati salvati.`);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSalvando(null);
      setConfermaSvuota(false);
    }
  }

  function salva(e: FormEvent) {
    e.preventDefault();
    const righe = tipi
      .filter((tipo) => CAMPI.some((c) => valori[tipo][c.chiave].trim() !== ""))
      .map((tipo) => ({ tipoCampagna: tipo, ...Object.fromEntries(CAMPI.map((c) => [c.chiave, valori[tipo][c.chiave].trim() === "" ? 0 : Number(valori[tipo][c.chiave])])) }));
    if (righe.length === 0) {
      setErrore(delPeriodo.length > 0 ? 'Tutte le righe sono vuote. Per togliere i risultati di questo periodo usa "Svuota questo periodo".' : "Inserisci almeno un valore.");
      return;
    }
    const controllo = controllaRigheCommerciali(righe);
    const problema = controllo.ok ? erroreSulPeriodo(periodo, true, compilati) : controllo.errore;
    if (problema) {
      setErrore(problema);
      return;
    }
    void invia(righe, "salva");
  }

  return (
    <form onSubmit={salva} noValidate className="space-y-3">
      {/* Una riga per tipo di campagna. Su schermo largo è una griglia a colonne con i nomi in testa; su
          telefono ogni tipo diventa un riquadro e i cinque campi vanno a capo a due a due, ognuno col
          suo nome sopra (prima era una tabella da scorrere di lato, con tre campi fuori vista). */}
      <div className="overflow-hidden rounded-lg border border-linea">
        <div aria-hidden="true" className={`hidden bg-surface px-3 py-2 text-xs font-bold text-ink-700 sm:grid ${GRIGLIA} sm:gap-x-2`}>
          <span>Tipo di campagna</span>
          {CAMPI.map((c) => (
            <span key={c.chiave}>{c.etichetta}</span>
          ))}
        </div>
        <div className="divide-y divide-linea sm:border-t sm:border-linea">
          {tipi.map((tipo) => (
            <div key={tipo} role="group" aria-label={nomeTipo(tipo)} className={`grid grid-cols-2 gap-2 p-3 sm:items-center ${GRIGLIA}`}>
              <p className="col-span-2 text-sm font-semibold text-ink-900 sm:col-span-1">{nomeTipo(tipo)}</p>
              {CAMPI.map((c) => (
                <label key={c.chiave} className={`flex min-w-0 flex-col justify-end ${c.chiave === "fatturato" ? "col-span-2 sm:col-span-1" : ""}`}>
                  <span className="mb-1 block text-xs font-semibold text-ink-700 sm:sr-only">{c.etichetta}</span>
                  <Input
                    type="number"
                    min={0}
                    step={c.passo}
                    inputMode={c.passo === "1" ? "numeric" : "decimal"}
                    value={valori[tipo][c.chiave]}
                    onChange={(e) => imposta(tipo, c.chiave, e.target.value)}
                    aria-label={`${c.etichetta}, ${nomeTipo(tipo)}`}
                    className="tabular-nums"
                  />
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-ink-500">
        Una riga lasciata tutta vuota non viene salvata: resta non compilata. In una riga con almeno un valore, i campi vuoti valgono zero.
      </p>

      {errore && (
        <p role="alert" className="text-sm font-semibold text-critico">
          {errore}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-linea pt-4">
        <Button type="submit" disabled={salvando !== null}>
          {salvando === "salva" ? "Salvataggio…" : "Salva risultati"}
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={salvando !== null}>
          Chiudi
        </Button>
        {delPeriodo.length > 0 && (
          <Button
            variant="danger"
            onClick={() => (confermaSvuota ? void invia([], "svuota") : setConfermaSvuota(true))}
            onBlur={() => setConfermaSvuota(false)}
            disabled={salvando !== null}
            className="ml-auto"
          >
            {salvando === "svuota" ? "Salvataggio…" : confermaSvuota ? "Conferma: togli i risultati" : "Svuota questo periodo"}
          </Button>
        )}
      </div>
    </form>
  );
}
