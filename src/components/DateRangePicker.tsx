"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Input, Select } from "@/components/ui/Input";
import { formatDataBreve, MESI_BREVI } from "@/lib/format";
import { ultimoGiornoDelMese } from "@/lib/kpi";
import {
  etichettaIntervallo,
  etichettaIntervalloBreve,
  etichettaPreset,
  intervalloPreset,
  isPresetPeriodoId,
  periodoPrecedente,
  PRESET_PERIODO,
  spostaMese,
  type Intervallo,
  type PresetPeriodoId,
} from "@/lib/periodo";
import { oggiIso } from "@/lib/roadmap";

/**
 * Periodo scelto nel selettore: due giorni inclusi + il preset da cui provengono (solo per
 * l'etichetta del bottone: "Ultimi 30 giorni: 27 ago 2026 – 25 set 2026") + l'eventuale periodo di
 * confronto scelto A MANO. `confronto: null` = confronto automatico (stesso numero di giorni subito
 * prima, vedi periodoPrecedente in lib/periodo.ts e KpiSection.tsx).
 */
export type SelezionePeriodo = {
  da: string;
  a: string;
  preset: PresetPeriodoId | "personalizzato";
  confronto: Intervallo | null;
};

type Props = {
  valore: SelezionePeriodo;
  onChange: (v: SelezionePeriodo) => void;
  /**
   * Forma compatta, per la striscia dei filtri che resta in alto mentre si scorre (StrisciaFiltri.tsx):
   * pulsante più basso con le sole date, e pannello che non esce dallo schermo — la striscia è ferma,
   * quindi ciò che sporge sotto non si raggiungerebbe scorrendo la pagina.
   */
  compatto?: boolean;
};

const GIORNI_SETTIMANA = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Un mese di calendario a giorni, lunedì-prima — la metà di uno dei due riquadri affiancati. */
function MeseCalendario({
  mese,
  da,
  a,
  oggi,
  onGiorno,
}: {
  mese: string; // YYYY-MM
  da: string;
  a: string;
  oggi: string;
  onGiorno: (iso: string) => void;
}) {
  const [anno, m] = mese.split("-").map(Number);
  const giorniNelMese = Number(ultimoGiornoDelMese(mese).slice(8));
  // Colonne lunedì-prima: getUTCDay() dà 0 = domenica, si ruota perché lunedì sia 0.
  const offset = (new Date(`${mese}-01T00:00:00Z`).getUTCDay() + 6) % 7;
  const celle: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: giorniNelMese }, (_, i) => i + 1)];

  return (
    <div className="min-w-0" role="group" aria-label={`${MESI_BREVI[m - 1]} ${anno}`}>
      <p aria-hidden="true" className="text-sm font-bold text-ink-900 text-center mb-2">
        {MESI_BREVI[m - 1].toLowerCase()} {anno}
      </p>
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {GIORNI_SETTIMANA.map((g) => (
          <span key={g} aria-hidden="true" className="text-xs font-medium text-ink-500 py-1">
            {g}
          </span>
        ))}
        {celle.map((giorno, i) => {
          if (giorno === null) return <span key={`v-${i}`} />;
          const iso = `${mese}-${pad(giorno)}`;
          const futuro = iso > oggi;
          const estremo = iso === da || iso === a;
          const dentro = iso > da && iso < a;
          return (
            <button
              key={iso}
              type="button"
              disabled={futuro}
              onClick={() => onGiorno(iso)}
              // Il nome è la data per esteso ("7 ott 2026"), non il solo numero del giorno; lo stato
              // dice se è un estremo del periodo o un giorno compreso.
              aria-label={`${formatDataBreve(iso)}${estremo ? (iso === da && iso === a ? ", giorno scelto" : iso === da ? ", inizio del periodo" : ", fine del periodo") : dentro ? ", nel periodo" : ""}`}
              aria-pressed={estremo || dentro}
              className={`h-8 text-xs tabular-nums transition-colors ${
                futuro
                  ? "text-ink-500 opacity-50 cursor-not-allowed"
                  : estremo
                    ? "bg-brand text-white font-bold rounded-lg cursor-pointer"
                    : dentro
                      ? "bg-brand-light text-ink-900 cursor-pointer"
                      : "text-ink-700 hover:bg-surface rounded-lg cursor-pointer"
              }`}
            >
              {giorno}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Selettore periodo unico in stile Meta Ads Manager (richiesta utente, 26/09/2026 — sostituisce
 * MonthRangePicker/WeekRangePicker e il toggle Mese/Settimana): preset a sinistra, due calendari a
 * GIORNI affiancati a destra (primo clic = inizio, secondo = fine, giorni futuri disabilitati),
 * sotto la riga preset + date digitabili e il checkbox "Confronta" per un secondo periodo scelto a
 * mano. Stesso pattern bottone → pannello con stato "pending" → Annulla/Aggiorna e chiusura al
 * click fuori dei picker che sostituisce. Le date sono sempre giorni `YYYY-MM-DD` (vedi
 * lib/periodo.ts), nessuna aritmetica di calendario propria: aggiungiGiorni/spostaMese/
 * ultimoGiornoDelMese arrivano dalle librerie già in uso.
 */
export function DateRangePicker({ valore, onChange, compatto = false }: Props) {
  const oggi = oggiIso();
  const [open, setOpen] = useState(false);
  const [pendingDa, setPendingDa] = useState(valore.da);
  const [pendingA, setPendingA] = useState(valore.a);
  const [pendingPreset, setPendingPreset] = useState<SelezionePeriodo["preset"]>(valore.preset);
  const [confrontaAttivo, setConfrontaAttivo] = useState(valore.confronto !== null);
  const [confrontoModo, setConfrontoModo] = useState<"automatico" | "personalizzato">(valore.confronto ? "personalizzato" : "automatico");
  const [confrontoDa, setConfrontoDa] = useState(valore.confronto?.da ?? "");
  const [confrontoA, setConfrontoA] = useState(valore.confronto?.a ?? "");
  // Mese mostrato nel calendario di DESTRA (quello di sinistra è il precedente) — parte dal mese di
  // fine periodo, così l'intervallo scelto è quasi sempre già in vista.
  const [meseVisibile, setMeseVisibile] = useState(valore.a.slice(0, 7));
  // true tra il primo clic (inizio) e il secondo (fine) sul calendario.
  const [selezioneInCorso, setSelezioneInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  function apri() {
    setPendingDa(valore.da);
    setPendingA(valore.a);
    setPendingPreset(valore.preset);
    setConfrontaAttivo(valore.confronto !== null);
    setConfrontoModo(valore.confronto ? "personalizzato" : "automatico");
    setConfrontoDa(valore.confronto?.da ?? "");
    setConfrontoA(valore.confronto?.a ?? "");
    setMeseVisibile(valore.a.slice(0, 7));
    setSelezioneInCorso(false);
    setErrore(null);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    // Esc chiude senza applicare, come "Annulla".
    function handleTasto(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleTasto);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleTasto);
    };
  }, [open]);

  function applicaPreset(id: PresetPeriodoId) {
    const { da, a } = intervalloPreset(id, oggi);
    setPendingDa(da);
    setPendingA(a);
    setPendingPreset(id);
    setMeseVisibile(a.slice(0, 7));
    setSelezioneInCorso(false);
    setErrore(null);
  }

  function onGiorno(iso: string) {
    setPendingPreset("personalizzato");
    setErrore(null);
    if (!selezioneInCorso) {
      setPendingDa(iso);
      setPendingA(iso);
      setSelezioneInCorso(true);
      return;
    }
    if (iso < pendingDa) {
      setPendingA(pendingDa);
      setPendingDa(iso);
    } else {
      setPendingA(iso);
    }
    setSelezioneInCorso(false);
  }

  function applica() {
    if (!pendingDa || !pendingA || pendingDa > pendingA) {
      setErrore("La data di inizio deve precedere quella di fine.");
      return;
    }
    if (pendingA > oggi) {
      setErrore("La data di fine non può essere nel futuro.");
      return;
    }
    let confronto: Intervallo | null = null;
    if (confrontaAttivo && confrontoModo === "personalizzato") {
      if (!confrontoDa || !confrontoA || confrontoDa > confrontoA) {
        setErrore("Nel periodo di confronto la data di inizio deve precedere quella di fine.");
        return;
      }
      confronto = { da: confrontoDa, a: confrontoA };
    }
    onChange({ da: pendingDa, a: pendingA, preset: pendingPreset, confronto });
    setOpen(false);
  }

  const confrontoAutomatico = periodoPrecedente(pendingDa || valore.da, pendingA || valore.a);
  const etichettaBottone = `${valore.preset === "personalizzato" ? "" : `${etichettaPreset(valore.preset)}: `}${etichettaIntervallo(valore.da, valore.a)}`;

  return (
    // Compatto: su telefono il pannello si allinea al bordo della striscia (che è `relative`), non a
    // questo pulsante, altrimenti uscirebbe dallo schermo a destra.
    <div className={compatto ? "sm:relative" : "relative"} ref={rootRef}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : apri())}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Periodo: ${etichettaBottone}. Clicca per cambiarlo`}
        className={`flex items-center gap-2 rounded-lg border border-bordo-campo bg-surface-card text-ink-900 hover:border-brand transition cursor-pointer ${
          compatto ? "min-h-8 px-2.5 py-1 text-[13px] leading-[18px]" : "min-h-10 px-3 py-2 text-sm"
        }`}
      >
        <Calendar size={compatto ? 14 : 16} aria-hidden="true" className="text-ink-500" />
        {compatto ? (
          // Su telefono l'anno una volta sola: così nella striscia ci sta accanto un altro filtro.
          <>
            <span className="sm:hidden">{etichettaIntervalloBreve(valore.da, valore.a)}</span>
            <span className="hidden sm:inline">{etichettaIntervallo(valore.da, valore.a)}</span>
          </>
        ) : (
          etichettaBottone
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Scegli il periodo"
          className={`absolute z-20 mt-2 w-[min(780px,calc(100vw-2rem))] rounded-xl border border-linea bg-surface-card shadow-[var(--shadow-alta)] p-4 flex flex-col sm:flex-row gap-4 ${
            compatto ? "left-0 max-h-[calc(100dvh_-_var(--barra-fissa,0px)_-_5rem)] overflow-y-auto" : ""
          }`}
        >
          {/* Preset — stessa colonna di Meta: lista a radio, scorrevole. */}
          <div
            role="radiogroup"
            aria-label="Periodi predefiniti"
            className="sm:w-48 flex-shrink-0 sm:border-r border-b sm:border-b-0 border-linea pb-3 sm:pb-0 sm:pr-3 max-h-72 sm:max-h-[440px] overflow-y-auto"
          >
            {PRESET_PERIODO.map((p) => {
              const attivo = pendingPreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={attivo}
                  onClick={() => applicaPreset(p.id)}
                  className={`w-full min-h-8 flex items-center gap-2.5 text-left text-sm px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                    attivo ? "bg-brand-light text-brand font-bold" : "text-ink-700 hover:bg-surface"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`w-4 h-4 rounded-full border-2 shrink-0 ${attivo ? "border-brand bg-brand shadow-[inset_0_0_0_3px_var(--superficie)]" : "border-bordo-campo"}`}
                  />
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 space-y-3 min-w-0">
            {/* Due calendari affiancati con navigazione condivisa. */}
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => setMeseVisibile((m) => spostaMese(m, -1))}
                className="-mt-1 w-8 h-8 rounded-full hover:bg-surface text-ink-700 flex items-center justify-center cursor-pointer shrink-0"
                aria-label="Mese precedente"
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
                <MeseCalendario mese={spostaMese(meseVisibile, -1)} da={pendingDa} a={pendingA} oggi={oggi} onGiorno={onGiorno} />
                <MeseCalendario mese={meseVisibile} da={pendingDa} a={pendingA} oggi={oggi} onGiorno={onGiorno} />
              </div>
              <button
                type="button"
                onClick={() => setMeseVisibile((m) => spostaMese(m, 1))}
                disabled={meseVisibile >= oggi.slice(0, 7)}
                className="-mt-1 w-8 h-8 rounded-full hover:bg-surface text-ink-700 flex items-center justify-center cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Mese successivo"
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>

            {/* Riga periodo principale: preset + date digitabili, come in Meta. */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-center">
              <Select
                aria-label="Periodo predefinito"
                value={pendingPreset}
                onChange={(e) => {
                  const v = e.target.value;
                  if (isPresetPeriodoId(v)) applicaPreset(v);
                  else setPendingPreset("personalizzato");
                }}
                className="min-h-10 py-2"
              >
                {PRESET_PERIODO.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
                <option value="personalizzato">Personalizzato</option>
              </Select>
              <Input
                type="date"
                aria-label="Data di inizio"
                value={pendingDa}
                max={oggi}
                onChange={(e) => {
                  setPendingDa(e.target.value);
                  setPendingPreset("personalizzato");
                  setErrore(null);
                }}
                className="w-auto min-h-10 py-2"
              />
              <Input
                type="date"
                aria-label="Data di fine"
                value={pendingA}
                max={oggi}
                onChange={(e) => {
                  setPendingA(e.target.value);
                  setPendingPreset("personalizzato");
                  setErrore(null);
                }}
                className="w-auto min-h-10 py-2"
              />
            </div>

            {/* Confronto: automatico (stesso numero di giorni subito prima) o scelto a mano. */}
            <label className="flex min-h-8 items-center gap-2.5 text-sm text-ink-700 cursor-pointer w-fit">
              <input type="checkbox" checked={confrontaAttivo} onChange={(e) => setConfrontaAttivo(e.target.checked)} className="h-[18px] w-[18px] accent-[var(--brand-primary)] cursor-pointer flex-shrink-0" />
              Confronta
            </label>
            {confrontaAttivo && (
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-center">
                <Select aria-label="Periodo di confronto" value={confrontoModo} onChange={(e) => setConfrontoModo(e.target.value as "automatico" | "personalizzato")} className="min-h-10 py-2">
                  <option value="automatico">Periodo precedente (automatico)</option>
                  <option value="personalizzato">Personalizzato</option>
                </Select>
                <Input
                  type="date"
                  aria-label="Inizio del periodo di confronto"
                  value={confrontoModo === "automatico" ? confrontoAutomatico.da : confrontoDa}
                  disabled={confrontoModo === "automatico"}
                  max={oggi}
                  onChange={(e) => {
                    setConfrontoDa(e.target.value);
                    setErrore(null);
                  }}
                  className="w-auto min-h-10 py-2"
                />
                <Input
                  type="date"
                  aria-label="Fine del periodo di confronto"
                  value={confrontoModo === "automatico" ? confrontoAutomatico.a : confrontoA}
                  disabled={confrontoModo === "automatico"}
                  max={oggi}
                  onChange={(e) => {
                    setConfrontoA(e.target.value);
                    setErrore(null);
                  }}
                  className="w-auto min-h-10 py-2"
                />
              </div>
            )}

            {errore && (
              <p role="alert" className="text-xs font-semibold text-critico">
                {errore}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-linea">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="alc-btn alc-btn--neutro alc-btn--piccolo"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={applica}
                className="alc-btn alc-btn--piccolo"
              >
                Aggiorna
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
