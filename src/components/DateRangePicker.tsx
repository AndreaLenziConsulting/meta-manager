"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Input, Select } from "@/components/ui/Input";
import { MESI_BREVI } from "@/lib/format";
import { ultimoGiornoDelMese } from "@/lib/kpi";
import {
  etichettaIntervallo,
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

type Props = { valore: SelezionePeriodo; onChange: (v: SelezionePeriodo) => void };

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
    <div className="min-w-0">
      <p className="text-sm font-semibold text-ink-900 text-center mb-2">
        {MESI_BREVI[m - 1].toLowerCase()} {anno}
      </p>
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {GIORNI_SETTIMANA.map((g) => (
          <span key={g} className="text-[11px] text-ink-500 py-1">
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
              className={`h-8 text-xs tabular-nums transition-colors ${
                futuro
                  ? "text-ink-300 cursor-not-allowed"
                  : estremo
                    ? "bg-brand text-white font-semibold rounded-lg cursor-pointer"
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
export function DateRangePicker({ valore, onChange }: Props) {
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
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
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
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : apri())}
        className="flex items-center gap-2 rounded-xl border border-[var(--glass-border-soft)] bg-surface-card backdrop-blur-lg supports-[backdrop-filter]:bg-[var(--glass-panel)] px-3 py-2 text-sm text-ink-900 shadow-sm hover:border-brand/40 transition cursor-pointer"
      >
        <Calendar size={14} className="text-ink-500" />
        {etichettaBottone}
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-[min(760px,calc(100vw-2rem))] rounded-2xl border border-[var(--glass-border-soft)] bg-surface-card backdrop-blur-lg supports-[backdrop-filter]:bg-[var(--glass-panel-strong)] shadow-lg p-4 flex flex-col sm:flex-row gap-4">
          {/* Preset — stessa colonna di Meta: lista a radio, scorrevole. */}
          <div className="sm:w-44 flex-shrink-0 sm:border-r border-b sm:border-b-0 border-ink-300/60 pb-3 sm:pb-0 sm:pr-3 max-h-72 sm:max-h-[420px] overflow-y-auto space-y-0.5">
            {PRESET_PERIODO.map((p) => {
              const attivo = pendingPreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applicaPreset(p.id)}
                  className={`w-full flex items-center gap-2 text-left text-xs px-2 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    attivo ? "bg-brand-light text-brand font-semibold" : "text-ink-700 hover:bg-surface"
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full border shrink-0 ${attivo ? "border-brand bg-brand" : "border-ink-300"}`} />
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
                className="mt-0.5 w-7 h-7 rounded-md hover:bg-surface text-ink-500 flex items-center justify-center cursor-pointer shrink-0"
                aria-label="Mese precedente"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
                <MeseCalendario mese={spostaMese(meseVisibile, -1)} da={pendingDa} a={pendingA} oggi={oggi} onGiorno={onGiorno} />
                <MeseCalendario mese={meseVisibile} da={pendingDa} a={pendingA} oggi={oggi} onGiorno={onGiorno} />
              </div>
              <button
                type="button"
                onClick={() => setMeseVisibile((m) => spostaMese(m, 1))}
                disabled={meseVisibile >= oggi.slice(0, 7)}
                className="mt-0.5 w-7 h-7 rounded-md hover:bg-surface text-ink-500 flex items-center justify-center cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Mese successivo"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Riga periodo principale: preset + date digitabili, come in Meta. */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-center">
              <Select
                value={pendingPreset}
                onChange={(e) => {
                  const v = e.target.value;
                  if (isPresetPeriodoId(v)) applicaPreset(v);
                  else setPendingPreset("personalizzato");
                }}
                className="text-xs py-2"
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
                value={pendingDa}
                max={oggi}
                onChange={(e) => {
                  setPendingDa(e.target.value);
                  setPendingPreset("personalizzato");
                  setErrore(null);
                }}
                className="w-auto text-xs py-2"
              />
              <Input
                type="date"
                value={pendingA}
                max={oggi}
                onChange={(e) => {
                  setPendingA(e.target.value);
                  setPendingPreset("personalizzato");
                  setErrore(null);
                }}
                className="w-auto text-xs py-2"
              />
            </div>

            {/* Confronto: automatico (stesso numero di giorni subito prima) o scelto a mano. */}
            <label className="flex items-center gap-2 text-xs text-ink-700 cursor-pointer w-fit">
              <input type="checkbox" checked={confrontaAttivo} onChange={(e) => setConfrontaAttivo(e.target.checked)} className="accent-current text-brand" />
              Confronta
            </label>
            {confrontaAttivo && (
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-center">
                <Select value={confrontoModo} onChange={(e) => setConfrontoModo(e.target.value as "automatico" | "personalizzato")} className="text-xs py-2">
                  <option value="automatico">Periodo precedente (automatico)</option>
                  <option value="personalizzato">Personalizzato</option>
                </Select>
                <Input
                  type="date"
                  value={confrontoModo === "automatico" ? confrontoAutomatico.da : confrontoDa}
                  disabled={confrontoModo === "automatico"}
                  max={oggi}
                  onChange={(e) => {
                    setConfrontoDa(e.target.value);
                    setErrore(null);
                  }}
                  className="w-auto text-xs py-2"
                />
                <Input
                  type="date"
                  value={confrontoModo === "automatico" ? confrontoAutomatico.a : confrontoA}
                  disabled={confrontoModo === "automatico"}
                  max={oggi}
                  onChange={(e) => {
                    setConfrontoA(e.target.value);
                    setErrore(null);
                  }}
                  className="w-auto text-xs py-2"
                />
              </div>
            )}

            {errore && <p className="text-xs text-red-600">{errore}</p>}

            <div className="flex justify-end gap-2 pt-2 border-t border-ink-300/60">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs font-medium px-3 py-1.5 rounded-lg text-ink-500 hover:bg-surface transition-colors cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={applica}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-cta hover:bg-cta-dark text-white transition-colors cursor-pointer"
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
