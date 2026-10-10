"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Nota } from "@/components/ui/Nota";
import { PulsanteIcona } from "@/components/ui/PulsanteIcona";
import { etichettaPeriodo, periodoFuturo, spostaPeriodo, ultimoPeriodoConcluso } from "@/lib/risultatiManuali";

type RigaSalvata = { mese: string; venditoreId: string; appuntamentiFissati: number; vendite: number; fatturato: number };

const CAMPI = [
  { chiave: "appuntamentiFissati", etichetta: "Appuntamenti presi", passo: "1" },
  { chiave: "vendite", etichetta: "Vendite", passo: "1" },
  { chiave: "fatturato", etichetta: "Fatturato (€)", passo: "0.01" },
] as const;
type Campo = (typeof CAMPI)[number]["chiave"];
type ValoriRiga = Record<Campo, string>;

const RIGA_VUOTA: ValoriRiga = { appuntamentiFissati: "", vendite: "", fatturato: "" };
const GRIGLIA = "sm:grid-cols-[minmax(8rem,1.4fr)_repeat(3,minmax(0,1fr))]";

/**
 * Inserimento dei risultati mensili dei venditori di una sede — appuntamenti presi, vendite e
 * fatturato — per chi non arriva da GHL. Stesse regole dell'inserimento dei risultati commerciali
 * (RisultatiCommercialiModal.tsx): un mese alla volta; una riga lasciata tutta vuota non viene
 * salvata, quel venditore per quel mese resta "non compilato", mai uno zero che nessuno ha dichiarato.
 *
 * Il salvataggio sostituisce tutte le righe del mese per la sede: quelle dei venditori che qui non
 * si vedono (non più attivi, o passati a GHL) vengono rimandate indietro così come sono, per non
 * cancellarle.
 */
export function RisultatiVenditoriModal({
  clienteId,
  sedeId,
  venditoriAMano,
  nomiDaGhl,
  onClose,
  onSalvato,
}: {
  clienteId: string;
  sedeId: string;
  /** I venditori attivi i cui numeri non arrivano da GHL: le righe del modulo. Mai vuoto. */
  venditoriAMano: { venditoreId: string; nome: string }[];
  /** I venditori che arrivano da GHL: solo per dire che qui non compaiono. */
  nomiDaGhl: string[];
  onClose: () => void;
  onSalvato: () => void;
}) {
  // Stesso meccanismo di RisultatiCommercialiModal: il modulo riparte dai valori salvati quando arriva
  // la lettura fatta dopo un salvataggio, non prima.
  const [lettura, setLettura] = useState<{ versione: number; righe: RigaSalvata[] } | null>(null);
  const [erroreLettura, setErroreLettura] = useState<string | null>(null);
  const [versione, setVersione] = useState(0);
  const [mese, setMese] = useState(() => ultimoPeriodoConcluso("mese"));
  const [messaggio, setMessaggio] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/risultati-venditori?clienteId=${encodeURIComponent(clienteId)}&sedeId=${encodeURIComponent(sedeId)}`, { signal: controller.signal })
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

  const idAMano = new Set(venditoriAMano.map((v) => v.venditoreId));
  const delMese = (lettura?.righe ?? []).filter((r) => r.mese === mese);
  const delMeseAMano = delMese.filter((r) => idAMano.has(r.venditoreId));
  const mesiCompilati = Array.from(new Set((lettura?.righe ?? []).filter((r) => idAMano.has(r.venditoreId)).map((r) => r.mese))).sort((x, y) => y.localeCompare(x));

  function vaiA(nuovo: string) {
    setMese(nuovo);
    setMessaggio(null);
  }

  return (
    <Modal title="Risultati dei venditori" onClose={onClose} maxWidth="max-w-3xl">
      <p className="-mt-2 text-sm text-ink-500">Appuntamenti presi, vendite e fatturato di ogni venditore, un mese alla volta.</p>

      {nomiDaGhl.length > 0 && (
        <Nota tono="accento" etichetta="da sapere" compatta>
          <p>
            {nomiDaGhl.join(", ")}: {nomiDaGhl.length === 1 ? "i suoi numeri arrivano" : "i loro numeri arrivano"} da GHL, qui non c&apos;è nulla da inserire.
          </p>
        </Nota>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <PulsanteIcona etichetta="Mese precedente" onClick={() => vaiA(spostaPeriodo(mese, -1))}>
            <ChevronLeft size={20} aria-hidden="true" />
          </PulsanteIcona>
          <p aria-live="polite" className="min-w-36 text-center text-sm font-bold text-ink-900">
            {etichettaPeriodo(mese)}
          </p>
          <PulsanteIcona etichetta="Mese successivo" onClick={() => vaiA(spostaPeriodo(mese, 1))} disabled={periodoFuturo(spostaPeriodo(mese, 1))}>
            <ChevronRight size={20} aria-hidden="true" />
          </PulsanteIcona>
        </div>
        {lettura && <Badge tono={delMeseAMano.length > 0 ? "successo" : "neutro"}>{delMeseAMano.length > 0 ? "compilato" : "non compilato"}</Badge>}
      </div>

      {erroreLettura && (
        <Nota tono="critico" etichetta="Risultati non letti" role="alert">
          <p>{erroreLettura}</p>
        </Nota>
      )}
      {!lettura && !erroreLettura && (
        <p role="status" className="text-sm text-ink-500">
          Caricamento…
        </p>
      )}

      {lettura && (
        <ModuloMese
          key={`${mese}/${lettura.versione}`}
          clienteId={clienteId}
          sedeId={sedeId}
          mese={mese}
          venditori={venditoriAMano}
          delMese={delMese}
          onSalvato={(testo) => {
            setMessaggio(testo);
            setVersione((v) => v + 1);
            onSalvato();
          }}
          onClose={onClose}
        />
      )}

      {messaggio && (
        <p role="status" className="text-sm font-semibold text-ok">
          {messaggio}
        </p>
      )}

      {mesiCompilati.length > 0 && (
        <div className="space-y-2 border-t border-linea pt-4">
          <p className="text-xs font-bold text-ink-700">Mesi già compilati</p>
          <div className="flex flex-wrap gap-1.5">
            {mesiCompilati.slice(0, 16).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => vaiA(m)}
                aria-current={m === mese ? "true" : undefined}
                className={`min-h-8 cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  m === mese ? "border-brand bg-brand-light text-accento-testo" : "border-linea bg-surface-card text-ink-700 hover:border-brand hover:text-accento-testo"
                }`}
              >
                {etichettaPeriodo(m)}
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

function ModuloMese({
  clienteId,
  sedeId,
  mese,
  venditori,
  delMese,
  onSalvato,
  onClose,
}: {
  clienteId: string;
  sedeId: string;
  mese: string;
  venditori: { venditoreId: string; nome: string }[];
  /** Tutte le righe salvate per questo mese, anche di venditori che il modulo non mostra. */
  delMese: RigaSalvata[];
  onSalvato: (messaggio: string) => void;
  onClose: () => void;
}) {
  const [valori, setValori] = useState<Record<string, ValoriRiga>>(() =>
    Object.fromEntries(
      venditori.map((v) => {
        const salvata = delMese.find((r) => r.venditoreId === v.venditoreId);
        return [v.venditoreId, salvata ? { appuntamentiFissati: String(salvata.appuntamentiFissati), vendite: String(salvata.vendite), fatturato: String(salvata.fatturato) } : RIGA_VUOTA];
      })
    )
  );
  const [salvando, setSalvando] = useState<"salva" | "svuota" | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [confermaSvuota, setConfermaSvuota] = useState(false);

  const idDelModulo = new Set(venditori.map((v) => v.venditoreId));
  // Le righe di chi qui non si vede tornano indietro così come sono: il salvataggio sostituisce tutto il mese.
  const daConservare = delMese.filter((r) => !idDelModulo.has(r.venditoreId)).map(({ venditoreId, appuntamentiFissati, vendite, fatturato }) => ({ venditoreId, appuntamentiFissati, vendite, fatturato }));
  const haRigheSalvate = delMese.some((r) => idDelModulo.has(r.venditoreId));

  async function invia(righe: unknown[], azione: "salva" | "svuota") {
    setSalvando(azione);
    setErrore(null);
    try {
      const res = await fetch("/api/risultati-venditori", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, sedeId, mese, righe: [...righe, ...daConservare] }),
      });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo.error || "Salvataggio non riuscito");
      onSalvato(azione === "svuota" ? `${etichettaPeriodo(mese)}: risultati tolti, il mese è di nuovo non compilato.` : `${etichettaPeriodo(mese)}: risultati salvati.`);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSalvando(null);
      setConfermaSvuota(false);
    }
  }

  function salva(e: FormEvent) {
    e.preventDefault();
    const numeri = venditori
      .filter((v) => CAMPI.some((c) => valori[v.venditoreId][c.chiave].trim() !== ""))
      .map((v) => ({ venditoreId: v.venditoreId, nome: v.nome, ...Object.fromEntries(CAMPI.map((c) => [c.chiave, valori[v.venditoreId][c.chiave].trim() === "" ? 0 : Number(valori[v.venditoreId][c.chiave])])) }) as { venditoreId: string; nome: string } & Record<Campo, number>);
    if (numeri.length === 0) {
      setErrore(haRigheSalvate ? 'Tutte le righe sono vuote. Per togliere i risultati di questo mese usa "Svuota questo mese".' : "Inserisci almeno un valore.");
      return;
    }
    for (const r of numeri) {
      if (![r.appuntamentiFissati, r.vendite].every((n) => Number.isInteger(n) && n >= 0)) {
        setErrore(`${r.nome}: appuntamenti e vendite devono essere numeri interi, da zero in su.`);
        return;
      }
      if (!Number.isFinite(r.fatturato) || r.fatturato < 0) {
        setErrore(`${r.nome}: il fatturato deve essere un importo da zero in su.`);
        return;
      }
    }
    void invia(
      numeri.map(({ venditoreId, appuntamentiFissati, vendite, fatturato }) => ({ venditoreId, appuntamentiFissati, vendite, fatturato })),
      "salva"
    );
  }

  return (
    <form onSubmit={salva} onChange={() => setErrore(null)} noValidate className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-linea">
        <div aria-hidden="true" className={`hidden bg-surface px-3 py-2 text-xs font-bold text-ink-700 sm:grid ${GRIGLIA} sm:gap-x-2`}>
          <span>Venditore</span>
          {CAMPI.map((c) => (
            <span key={c.chiave}>{c.etichetta}</span>
          ))}
        </div>
        <div className="divide-y divide-linea sm:border-t sm:border-linea">
          {venditori.map((v) => (
            <div key={v.venditoreId} role="group" aria-label={v.nome} className={`grid grid-cols-2 gap-2 p-3 sm:items-center ${GRIGLIA}`}>
              <p className="col-span-2 text-sm font-semibold text-ink-900 sm:col-span-1">{v.nome}</p>
              {CAMPI.map((c) => (
                <label key={c.chiave} className={`flex min-w-0 flex-col justify-end ${c.chiave === "fatturato" ? "col-span-2 sm:col-span-1" : ""}`}>
                  <span className="mb-1 block text-xs font-semibold text-ink-700 sm:sr-only">{c.etichetta}</span>
                  <Input
                    type="number"
                    min={0}
                    step={c.passo}
                    inputMode={c.passo === "1" ? "numeric" : "decimal"}
                    value={valori[v.venditoreId][c.chiave]}
                    onChange={(e) => setValori((prima) => ({ ...prima, [v.venditoreId]: { ...prima[v.venditoreId], [c.chiave]: e.target.value } }))}
                    aria-label={`${c.etichetta}, ${v.nome}`}
                    className="tabular-nums"
                  />
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-ink-500">Una riga lasciata tutta vuota non viene salvata: resta non compilata. In una riga con almeno un valore, i campi vuoti valgono zero.</p>

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
        {haRigheSalvate && (
          <Button
            variant="danger"
            onClick={() => (confermaSvuota ? void invia([], "svuota") : setConfermaSvuota(true))}
            onBlur={() => setConfermaSvuota(false)}
            disabled={salvando !== null}
            className="ml-auto"
          >
            {salvando === "svuota" ? "Salvataggio…" : confermaSvuota ? "Conferma: togli i risultati" : "Svuota questo mese"}
          </Button>
        )}
      </div>
    </form>
  );
}
