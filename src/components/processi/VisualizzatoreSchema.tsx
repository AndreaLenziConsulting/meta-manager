"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Hand, Highlighter, Maximize, Minimize, Scan, ZoomIn, ZoomOut } from "lucide-react";
import { PulsanteIcona } from "@/components/ui/PulsanteIcona";
import { cn } from "@/lib/cn";
import { limitaZoom, percentualeZoom, trattieni, versoSchema, vistaAdattata, zoomAttorno, type Misure, type Punto, type Vista } from "@/lib/schemaVista";

type Strumento = "sposta" | "evidenzia";

/** Un segno dell'evidenziatore, nelle coordinate dello schema: resta attaccato a ciò che indica anche
 * se intanto si ingrandisce. `finito` = il tasto è stato rilasciato e il segno sta sparendo. */
type Tratto = { id: number; punti: Punto[]; finito: boolean };

type Gesto =
  | { tipo: "sposta"; puntatore: number; da: Punto; vista: Vista }
  | { tipo: "evidenzia"; puntatore: number; tratto: number; ultimo: Punto }
  | { tipo: "pizzico"; distanza: number; centro: Punto; vista: Vista };

// Evidenziatore: ambra, il colore di un evidenziatore vero. Il sistema ALC non ha un giallo, e blu,
// verde e rosso nello schema vogliono già dire qualcosa. Il segno si fonde "a moltiplicare", come
// l'inchiostro sulla carta: il testo sotto resta scuro e leggibile.
const COLORE_TRATTO = "#ffb300";
const COLORE_PUNTA = "#c26a00";
const SPESSORE_TRATTO = 18;
// Rilasciato il tasto il segno resta un attimo, poi sfuma.
const ATTESA_SCOMPARSA_MS = 350;
const DURATA_SCOMPARSA_MS = 700;
// Un punto nuovo ogni 2 pixel di movimento, e un tetto: un segno tenuto a lungo non rallenta nulla.
const PASSO_MINIMO = 2;
const PUNTI_MASSIMI = 1500;

const PASSO_PULSANTE = 1.25;
const PASSO_FRECCE = 60;

function puntoNelRiquadro(e: { clientX: number; clientY: number }, el: Element): Punto {
  const r = el.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function distanza(a: Punto, b: Punto): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function centroFra(a: Punto, b: Punto): Punto {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

const senzaIscrizione = () => () => {};

/**
 * Riquadro in cui uno schema si guarda come una mappa: si trascina, si ingrandisce con la rotella (o
 * con due dita), si riporta intero con "Adatta" e si apre a schermo intero. Pensato per le call: il
 * consulente condivide lo schermo e accompagna il cliente dentro lo schema.
 *
 * Evidenziatore (richiesta dell'utente, 10/10/2026): tenendo premuto si lascia un segno che sparisce
 * da solo quando si rilascia, per indicare un punto mentre si parla. Col tasto destro funziona
 * sempre; col sinistro quando è scelto lo strumento "Evidenzia" (serve a chi non ha un tasto destro:
 * tavoletta, schermo a tocco).
 *
 * Lo schema è un disegno vettoriale (`children`, elementi SVG nelle coordinate `larghezza` x
 * `altezza`): ingrandito resta nitido. `children` non cambia mentre ci si muove, quindi React non
 * ridisegna lo schema a ogni movimento del mouse: cambia solo la trasformazione del gruppo.
 */
export function VisualizzatoreSchema({
  titolo,
  descrizione,
  larghezza,
  altezza,
  children,
}: {
  titolo: string;
  descrizione?: string;
  larghezza: number;
  altezza: number;
  children: ReactNode;
}) {
  const radice = useRef<HTMLDivElement>(null);
  const riquadro = useRef<HTMLDivElement>(null);
  const gesto = useRef<Gesto | null>(null);
  const puntatori = useRef(new Map<number, Punto>());
  const prossimoTratto = useRef(1);
  const attese = useRef(new Set<number>());
  const idAiuto = useId();

  const [area, setArea] = useState<Misure | null>(null);
  // `null` = "adattata": lo schema intero, che segue il riquadro quando cambia misura (finestra
  // ridimensionata, schermo intero). Diventa una vista propria al primo spostamento o ingrandimento.
  const [vistaLibera, setVistaLibera] = useState<Vista | null>(null);
  const [strumento, setStrumento] = useState<Strumento>("sposta");
  const [tratti, setTratti] = useState<Tratto[]>([]);
  const [schermoIntero, setSchermoIntero] = useState(false);
  // Sul server non si sa: il pulsante compare dopo, solo dove il browser lo permette (non su iPhone).
  const schermoInteroPossibile = useSyncExternalStore(
    senzaIscrizione,
    () => document.fullscreenEnabled,
    () => false
  );

  const adattata = area ? vistaAdattata(area, { larghezza, altezza }) : null;
  const vista = vistaLibera ?? adattata;

  useEffect(() => {
    const el = riquadro.current;
    if (!el) return;
    const osservatore = new ResizeObserver(([voce]) => {
      const { width, height } = voce.contentRect;
      setArea((prec) => (prec && prec.larghezza === width && prec.altezza === height ? prec : { larghezza: width, altezza: height }));
    });
    osservatore.observe(el);
    return () => osservatore.disconnect();
  }, []);

  // La rotella ingrandisce verso il punto sotto il mouse. Ascoltatore "non passivo" messo a mano:
  // quello di React non può fermare lo scorrimento della pagina, che partirebbe insieme allo zoom.
  // Il gesto delle due dita sul touchpad arriva qui come rotella con Ctrl premuto, a passi più piccoli.
  useEffect(() => {
    const el = riquadro.current;
    if (!el || !area) return;
    const schema = { larghezza, altezza };
    const base = vistaAdattata(area, schema);
    const suRotella = (e: WheelEvent) => {
      e.preventDefault();
      const perno = puntoNelRiquadro(e, el);
      const passo = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const fattore = Math.exp(-passo * (e.ctrlKey ? 0.01 : 0.0015));
      setVistaLibera((prec) => {
        const v = prec ?? base;
        return trattieni(zoomAttorno(v, perno, limitaZoom(v.k * fattore, base.k)), area, schema);
      });
    };
    el.addEventListener("wheel", suRotella, { passive: false });
    return () => el.removeEventListener("wheel", suRotella);
  }, [area, larghezza, altezza]);

  useEffect(() => {
    const aggiorna = () => setSchermoIntero(document.fullscreenElement !== null && document.fullscreenElement === radice.current);
    document.addEventListener("fullscreenchange", aggiorna);
    return () => document.removeEventListener("fullscreenchange", aggiorna);
  }, []);

  useEffect(() => {
    const inAttesa = attese.current;
    return () => inAttesa.forEach((t) => window.clearTimeout(t));
  }, []);

  function muovi(cambia: (v: Vista) => Vista) {
    if (!area || !adattata) return;
    setVistaLibera((prec) => trattieni(cambia(prec ?? adattata), area, { larghezza, altezza }));
  }

  /** Ingrandisce o rimpicciolisce attorno al centro del riquadro (pulsanti e tastiera). */
  function ingrandisci(fattore: number) {
    if (!area || !adattata) return;
    const centro = { x: area.larghezza / 2, y: area.altezza / 2 };
    muovi((v) => zoomAttorno(v, centro, limitaZoom(v.k * fattore, adattata.k)));
  }

  function alternaSchermoIntero() {
    // Cambiando misura si riparte dallo schema intero: la posizione di prima non avrebbe più senso.
    setVistaLibera(null);
    if (document.fullscreenElement) void document.exitFullscreen();
    else void radice.current?.requestFullscreen();
  }

  function chiudiTratto(id: number) {
    setTratti((ts) => ts.map((t) => (t.id === id ? { ...t, finito: true } : t)));
    const attesa = window.setTimeout(() => {
      attese.current.delete(attesa);
      setTratti((ts) => ts.filter((t) => t.id !== id));
    }, ATTESA_SCOMPARSA_MS + DURATA_SCOMPARSA_MS);
    attese.current.add(attesa);
  }

  function suPuntatoreGiu(e: PointerEvent<HTMLDivElement>) {
    if (!vista) return;
    // Mouse: sinistro, centrale o destro. Gli altri tasti (avanti, indietro) non fanno nulla.
    if (e.pointerType === "mouse" && e.button > 2) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const punto = puntoNelRiquadro(e, el);
    puntatori.current.set(e.pointerId, punto);

    if (puntatori.current.size === 2) {
      // Secondo dito: si ingrandisce. Ciò che il primo stava facendo finisce qui.
      const inCorso = gesto.current;
      if (inCorso?.tipo === "evidenzia") chiudiTratto(inCorso.tratto);
      const [a, b] = [...puntatori.current.values()];
      gesto.current = { tipo: "pizzico", distanza: distanza(a, b) || 1, centro: centroFra(a, b), vista };
      return;
    }
    if (puntatori.current.size > 2 || gesto.current) return;

    const evidenzia = e.button === 2 || (e.button === 0 && strumento === "evidenzia");
    if (evidenzia) {
      const id = prossimoTratto.current++;
      setTratti((ts) => [...ts, { id, punti: [versoSchema(vista, punto)], finito: false }]);
      gesto.current = { tipo: "evidenzia", puntatore: e.pointerId, tratto: id, ultimo: punto };
    } else {
      gesto.current = { tipo: "sposta", puntatore: e.pointerId, da: punto, vista };
    }
  }

  function suPuntatoreMosso(e: PointerEvent<HTMLDivElement>) {
    if (!puntatori.current.has(e.pointerId) || !vista || !area || !adattata) return;
    const punto = puntoNelRiquadro(e, e.currentTarget);
    puntatori.current.set(e.pointerId, punto);
    const inCorso = gesto.current;
    if (!inCorso) return;
    const schema = { larghezza, altezza };

    if (inCorso.tipo === "pizzico") {
      if (puntatori.current.size < 2) return;
      const [a, b] = [...puntatori.current.values()];
      const centro = centroFra(a, b);
      const k = limitaZoom(inCorso.vista.k * ((distanza(a, b) || 1) / inCorso.distanza), adattata.k);
      const ingrandita = zoomAttorno(inCorso.vista, inCorso.centro, k);
      // Le due dita possono anche spostarsi insieme: lo schema le segue.
      setVistaLibera(trattieni({ k, x: ingrandita.x + centro.x - inCorso.centro.x, y: ingrandita.y + centro.y - inCorso.centro.y }, area, schema));
      return;
    }
    if (inCorso.puntatore !== e.pointerId) return;

    if (inCorso.tipo === "sposta") {
      setVistaLibera(trattieni({ k: inCorso.vista.k, x: inCorso.vista.x + punto.x - inCorso.da.x, y: inCorso.vista.y + punto.y - inCorso.da.y }, area, schema));
      return;
    }

    if (distanza(punto, inCorso.ultimo) < PASSO_MINIMO) return;
    inCorso.ultimo = punto;
    const nelloSchema = versoSchema(vista, punto);
    const id = inCorso.tratto;
    setTratti((ts) => ts.map((t) => (t.id === id && t.punti.length < PUNTI_MASSIMI ? { ...t, punti: [...t.punti, nelloSchema] } : t)));
  }

  function suPuntatoreSu(e: PointerEvent<HTMLDivElement>) {
    if (!puntatori.current.delete(e.pointerId)) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    const inCorso = gesto.current;
    if (!inCorso) return;
    if (inCorso.tipo !== "pizzico") {
      if (inCorso.puntatore !== e.pointerId) return;
      if (inCorso.tipo === "evidenzia") chiudiTratto(inCorso.tratto);
    }
    gesto.current = null;
  }

  function suTasto(e: KeyboardEvent<HTMLDivElement>) {
    switch (e.key) {
      case "+":
      case "=":
        ingrandisci(PASSO_PULSANTE);
        break;
      case "-":
        ingrandisci(1 / PASSO_PULSANTE);
        break;
      case "0":
        setVistaLibera(null);
        break;
      case "ArrowLeft":
        muovi((v) => ({ ...v, x: v.x + PASSO_FRECCE }));
        break;
      case "ArrowRight":
        muovi((v) => ({ ...v, x: v.x - PASSO_FRECCE }));
        break;
      case "ArrowUp":
        muovi((v) => ({ ...v, y: v.y + PASSO_FRECCE }));
        break;
      case "ArrowDown":
        muovi((v) => ({ ...v, y: v.y - PASSO_FRECCE }));
        break;
      default:
        return;
    }
    e.preventDefault();
  }

  const percentuale = vista && adattata ? percentualeZoom(vista.k, adattata.k) : 100;
  const alMinimo = !vista || !adattata || vista.k <= limitaZoom(0, adattata.k);
  const alMassimo = !vista || !adattata || vista.k >= limitaZoom(Infinity, adattata.k);

  return (
    <div
      ref={radice}
      className={cn("flex flex-col overflow-hidden bg-surface-card", schermoIntero ? "h-full w-full" : "rounded-xl border border-linea shadow-[var(--shadow-card)]")}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-linea px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-sm leading-5 font-bold text-ink-900">{titolo}</p>
          {descrizione && <p className="text-xs leading-4 text-ink-500">{descrizione}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div role="group" aria-label="Cosa fa il mouse" className="flex gap-1 rounded-[20px] border border-linea bg-surface p-1">
            <PulsanteStrumento attivo={strumento === "sposta"} onClick={() => setStrumento("sposta")}>
              <Hand size={15} aria-hidden="true" />
              Sposta
            </PulsanteStrumento>
            <PulsanteStrumento attivo={strumento === "evidenzia"} onClick={() => setStrumento("evidenzia")}>
              <Highlighter size={15} aria-hidden="true" />
              Evidenzia
            </PulsanteStrumento>
          </div>

          <div className="flex items-center">
            <PulsanteIcona etichetta="Rimpicciolisci" dimensione="sm" disabled={alMinimo} onClick={() => ingrandisci(1 / PASSO_PULSANTE)}>
              <ZoomOut size={17} aria-hidden="true" />
            </PulsanteIcona>
            <span className="w-12 text-center text-xs font-semibold tabular-nums text-ink-700" aria-live="polite" aria-label={`Ingrandimento ${percentuale}%`}>
              {percentuale}%
            </span>
            <PulsanteIcona etichetta="Ingrandisci" dimensione="sm" disabled={alMassimo} onClick={() => ingrandisci(PASSO_PULSANTE)}>
              <ZoomIn size={17} aria-hidden="true" />
            </PulsanteIcona>
          </div>

          <div className="flex items-center gap-1">
            <PulsanteIcona etichetta="Adatta: mostra lo schema intero" dimensione="sm" disabled={vistaLibera === null} onClick={() => setVistaLibera(null)}>
              <Scan size={17} aria-hidden="true" />
            </PulsanteIcona>
            {schermoInteroPossibile && (
              <PulsanteIcona etichetta={schermoIntero ? "Esci dallo schermo intero" : "Schermo intero"} dimensione="sm" onClick={alternaSchermoIntero}>
                {schermoIntero ? <Minimize size={17} aria-hidden="true" /> : <Maximize size={17} aria-hidden="true" />}
              </PulsanteIcona>
            )}
          </div>
        </div>
      </div>

      <div
        ref={riquadro}
        tabIndex={0}
        role="group"
        aria-label={`Schema: ${titolo}`}
        aria-describedby={idAiuto}
        onPointerDown={suPuntatoreGiu}
        onPointerMove={suPuntatoreMosso}
        onPointerUp={suPuntatoreSu}
        onPointerCancel={suPuntatoreSu}
        onLostPointerCapture={suPuntatoreSu}
        // Il tasto destro qui evidenzia: il menù del browser coprirebbe proprio il punto indicato.
        onContextMenu={(e) => e.preventDefault()}
        // Il tasto centrale sposta: senza questo il browser farebbe partire il suo scorrimento automatico.
        onMouseDown={(e) => {
          if (e.button === 1) e.preventDefault();
        }}
        onKeyDown={suTasto}
        className={cn(
          "relative touch-none select-none overflow-hidden bg-surface focus-visible:[outline-offset:-2px]",
          // Altezza: quel che resta dello schermo sotto barra, schede del cliente, riga degli schemi e
          // barra del visualizzatore, così l'aiuto in fondo si vede senza scorrere la pagina.
          schermoIntero ? "min-h-0 flex-1" : "h-[max(26rem,calc(100dvh-22.5rem))]",
          strumento === "sposta" ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair"
        )}
      >
        {vista && (
          <svg width="100%" height="100%" className="block" xmlns="http://www.w3.org/2000/svg">
            {/* `--font-alc`: gli schemi sono di ALC e restano in Montserrat anche sulla scheda di un
                cliente che ha il suo font (vedi globals.css). */}
            <g transform={`translate(${vista.x} ${vista.y}) scale(${vista.k})`} style={{ fontFamily: 'var(--font-alc), "Helvetica Neue", Arial, sans-serif' }}>
              {/* Il foglio su cui sta lo schema. */}
              <rect x={0} y={0} width={larghezza} height={altezza} fill="var(--superficie)" stroke="var(--linea)" strokeWidth={1 / vista.k} />
              {children}
              <g pointerEvents="none" aria-hidden="true">
                {tratti.map((t) => (
                  <SegnoEvidenziatore key={t.id} tratto={t} k={vista.k} />
                ))}
              </g>
            </g>
          </svg>
        )}
      </div>

      <p id={idAiuto} className="border-t border-linea px-4 py-2 text-xs leading-4 text-ink-500">
        {strumento === "sposta"
          ? "Trascina per spostarti, usa la rotella per ingrandire. Per indicare un punto tieni premuto il tasto destro: il segno sparisce quando rilasci."
          : "Tieni premuto e muovi il mouse per evidenziare: il segno sparisce quando rilasci. La rotella ingrandisce."}
      </p>
    </div>
  );
}

function PulsanteStrumento({ attivo, onClick, children }: { attivo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={attivo}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] leading-[18px] font-semibold transition-colors",
        attivo ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-900"
      )}
    >
      {children}
    </button>
  );
}

/** Il segno lasciato tenendo premuto: una passata di evidenziatore, con la punta dove sta il mouse.
 * Lo spessore è diviso per l'ingrandimento: sullo schermo resta uguale a qualunque zoom. */
function SegnoEvidenziatore({ tratto, k }: { tratto: Tratto; k: number }) {
  const ultimo = tratto.punti[tratto.punti.length - 1];
  return (
    <g style={{ opacity: tratto.finito ? 0 : 1, transition: `opacity ${DURATA_SCOMPARSA_MS}ms ease-out ${ATTESA_SCOMPARSA_MS}ms` }}>
      <g style={{ mixBlendMode: "multiply" }}>
        {tratto.punti.length === 1 ? (
          // Premuto senza muoversi: un alone attorno al punto.
          <circle cx={ultimo.x} cy={ultimo.y} r={SPESSORE_TRATTO / k} fill={COLORE_TRATTO} fillOpacity={0.6} />
        ) : (
          <polyline
            points={tratto.punti.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
            fill="none"
            stroke={COLORE_TRATTO}
            strokeOpacity={0.6}
            strokeWidth={SPESSORE_TRATTO / k}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </g>
      <circle cx={ultimo.x} cy={ultimo.y} r={5 / k} fill={COLORE_PUNTA} stroke="#ffffff" strokeWidth={2 / k} />
    </g>
  );
}
