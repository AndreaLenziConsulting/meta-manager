"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Filter } from "lucide-react";
import { Tabs } from "@/components/Tabs";
import { Nota } from "@/components/ui/Nota";
import { formatEuro, formatEuroIntero, formatNumero, formatPercentuale } from "@/lib/format";
import type { AndamentoVenditori as Andamento, MisuraVenditori, RigaVenditore } from "@/lib/andamentoVenditori";

const HEIGHT = 170;
const HEIGHT_ETICHETTE = 26;
const PAD_TOP = 14;
const PAD_LEFT = 56;
const PAD_RIGHT = 16;
const MAX_ETICHETTE = 9;
// I colori dei grafici sono otto (globals.css, --series-1…8), assegnati ai venditori nell'ordine in
// cui sono configurati e mai riciclati: dal nono in poi un venditore sta solo nella tabella.
const MAX_SERIE = 8;

const MISURE: { id: MisuraVenditori; label: string; nomeAsse: string }[] = [
  { id: "appuntamenti", label: "Appuntamenti presi", nomeAsse: "appuntamenti presi" },
  { id: "vendite", label: "Vendite", nomeAsse: "vendite" },
  { id: "fatturato", label: "Fatturato", nomeAsse: "fatturato" },
];

const TESTO_STATO: Record<Exclude<RigaVenditore["disponibilita"], "ok">, string> = {
  caricamento: "Lettura in corso…",
  "non-disponibile": "Non disponibile: GHL non ha risposto",
  "non-compilato": "Non compilato: nessun risultato inserito per i mesi interi di questo periodo",
};

function useLarghezzaContenitore(fallback: number): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [larghezza, setLarghezza] = useState(fallback);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setLarghezza(Math.round(el.getBoundingClientRect().width) || fallback);
  }, [fallback]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setLarghezza(Math.round(w));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, larghezza];
}

const colore = (indice: number) => `var(--series-${indice + 1})`;

function formatMisura(misura: MisuraVenditori, valore: number | null): string {
  if (valore === null) return "—";
  if (misura !== "fatturato") return formatNumero(valore);
  // Uno zero di fatturato è "€0", non "€0,00": i centesimi di niente sono solo rumore accanto a "€10.494".
  return valore === 0 ? "€0" : formatEuro(valore);
}

/**
 * "Andamento venditori": per il periodo scelto in alto, i totali di ogni venditore e come sono
 * andati nel tempo — una linea per venditore, una misura alla volta (appuntamenti presi, vendite o
 * fatturato). Tutta la logica su da dove arrivano i numeri sta in src/lib/andamentoVenditori.ts;
 * qui c'è solo il disegno.
 *
 * Un asse solo: le tre misure hanno scale diverse, quindi si guardano una per volta invece di
 * sovrapporle su due assi. Dove un dato manca la linea si interrompe: non scende a zero.
 *
 * Col filtro campagne (08/10/2026) il riquadro dice sempre quali contatti sta contando: in cima
 * quando i numeri da GHL sono solo quelli delle campagne scelte (o quando il filtro non si è potuto
 * applicare), accanto a ogni nome, e nelle note in fondo.
 */
export function AndamentoVenditori({ andamento }: { andamento: Andamento }) {
  const [misura, setMisura] = useState<MisuraVenditori>("appuntamenti");
  const [wrapRef, WIDTH] = useLarghezzaContenitore(720);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { righe, punti, grana, statoGrafico, perimetroGhl, manualiNonDivisi, inAggiornamento } = andamento;
  const serie = andamento.nelGrafico.slice(0, MAX_SERIE).map((id, i) => ({ id, nome: righe.find((r) => r.venditoreId === id)?.nome ?? id, colore: colore(i) }));
  const coloreDi = new Map(serie.map((s) => [s.id, s.colore]));
  const nomiFuori = [...andamento.fuoriDalGrafico, ...andamento.nelGrafico.slice(MAX_SERIE)].map((id) => righe.find((r) => r.venditoreId === id)?.nome ?? id);
  const unita = grana === "settimana" ? "settimana" : "mese";
  const misuraAttiva = MISURE.find((m) => m.id === misura) ?? MISURE[0];

  const valore = (indice: number, venditoreId: string): number | null => punti[indice]?.valori[venditoreId]?.[misura] ?? null;
  const tuttiIValori = punti.flatMap((_, i) => serie.map((s) => valore(i, s.id))).filter((v): v is number => v !== null);
  const haDati = tuttiIValori.length > 0;

  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const xFor = (i: number) => PAD_LEFT + (punti.length === 1 ? plotW / 2 : (i / (punti.length - 1)) * plotW);
  const massimo = Math.max(1, ...tuttiIValori) * 1.15;
  const yFor = (v: number) => HEIGHT - (v / massimo) * HEIGHT;
  // Set: con valori piccoli due tacche possono arrotondare allo stesso numero (vedi CostoPerRisultatoChart.tsx).
  const tacche = Array.from(new Set([0, 0.5, 1].map((f) => Math.round(massimo * f))));
  const passoEtichette = Math.max(1, Math.ceil(punti.length / MAX_ETICHETTE));

  // Una linea per tratto continuo: dove manca un dato il tratto finisce e ne comincia un altro.
  function percorso(venditoreId: string): string {
    let d = "";
    let aperto = false;
    punti.forEach((_, i) => {
      const v = valore(i, venditoreId);
      if (v === null) {
        aperto = false;
        return;
      }
      d += `${aperto ? "L" : "M"}${xFor(i)},${yFor(v)}`;
      aperto = true;
    });
    return d;
  }

  function suMovimento(e: React.MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const indice = punti.length === 1 ? 0 : Math.round(((e.clientX - rect.left) / rect.width) * (punti.length - 1));
    setHoverIndex(Math.min(punti.length - 1, Math.max(0, indice)));
  }

  function suTasto(e: React.KeyboardEvent<SVGRectElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setHoverIndex((i) => Math.min(punti.length - 1, Math.max(0, (i ?? 0) + (e.key === "ArrowRight" ? 1 : -1))));
  }

  const attivo = hoverIndex !== null ? punti[hoverIndex] : null;

  return (
    // La larghezza si misura qui, sul contenitore che c'è sempre: il grafico compare solo quando ha dati.
    <div className="space-y-5" ref={wrapRef}>
      {perimetroGhl === "campagne-scelte" && (
        <p className="flex items-start gap-2 text-sm text-ink-700">
          <Filter size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-500" />
          <span>
            <strong className="font-semibold text-ink-900">Solo le campagne scelte in alto.</strong> Contano gli appuntamenti e le vendite dei contatti arrivati da quelle campagne.
          </span>
        </p>
      )}
      {perimetroGhl === "non-distinguibili" && (
        <Nota compatta etichetta="Filtro campagne non applicato qui">
          Su GHL nessun contatto di questa sede risulta arrivato da una campagna: i venditori contano tutti i loro appuntamenti e tutte le loro vendite, anche se in alto è scelto un filtro.
        </Nota>
      )}

      {/* Cambiate le campagne, i numeri di prima restano attenuati finché arrivano i nuovi: come il resto del tab KPI. */}
      <div className="space-y-5" aria-busy={inAggiornamento} style={{ opacity: inAggiornamento ? 0.6 : 1, transition: "opacity 150ms" }}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <caption className="sr-only">Totali di ogni venditore nel periodo scelto</caption>
          <thead>
            <tr className="border-b border-linea text-left text-xs font-bold text-ink-700">
              <th scope="col" className="py-2 pr-3">
                Venditore
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                Appuntamenti presi
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                Effettuati
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                Vendite
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                Chiusura
              </th>
              <th scope="col" className="py-2 pl-3 text-right">
                Fatturato
              </th>
            </tr>
          </thead>
          <tbody>
            {righe.map((r) => (
              <tr key={r.venditoreId} className="border-b border-linea last:border-b-0">
                <th scope="row" className="py-2.5 pr-3 text-left font-normal">
                  <span className="flex items-center gap-2">
                    {/* Il colore accompagna il nome: è lo stesso della sua linea nel grafico. */}
                    {coloreDi.has(r.venditoreId) && <span aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: coloreDi.get(r.venditoreId) }} />}
                    <span className="font-semibold text-ink-900">{r.nome}</span>
                  </span>
                  <span className="block text-xs text-ink-500">
                    {r.fonte === "ghl"
                      ? `da GHL${perimetroGhl === "campagne-scelte" ? " · solo campagne scelte" : ""}`
                      : `inserito a mano, per mese${manualiNonDivisi ? " · non diviso per campagna" : ""}`}
                  </span>
                </th>
                {r.disponibilita === "ok" ? (
                  <>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-900">{formatMisura("appuntamenti", r.appuntamentiFissati)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-900">{formatMisura("appuntamenti", r.appuntamentiEffettuati)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-900">{formatMisura("vendite", r.vendite)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-900">{r.chiusura === null ? "—" : formatPercentuale(r.chiusura)}</td>
                    <td className="py-2.5 pl-3 text-right tabular-nums font-semibold text-ink-900">{formatMisura("fatturato", r.fatturato)}</td>
                  </>
                ) : (
                  <td colSpan={5} className="py-2.5 pl-3 text-right text-ink-500">
                    {TESTO_STATO[r.disponibilita]}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Tabs etichetta="Cosa mostra il grafico" tabs={MISURE.map((m) => ({ id: m.id, label: m.label }))} attivo={misura} onChange={(id) => setMisura(id as MisuraVenditori)} />
          {serie.length > 0 && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
              {serie.map((s) => (
                <li key={s.id} className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="inline-block h-0.5 w-3 rounded" style={{ background: s.colore }} />
                  {s.nome}
                </li>
              ))}
            </ul>
          )}
        </div>

        {statoGrafico === "caricamento" ? (
          <p role="status" className="text-sm text-ink-500">
            Lettura da GHL in corso…
          </p>
        ) : statoGrafico === "non-disponibile" ? (
          <p className="text-sm text-ink-500">GHL non ha risposto: l&apos;andamento non si può disegnare. Ricarica la pagina.</p>
        ) : punti.length === 0 ? (
          <p className="text-sm text-ink-500">
            Nel periodo scelto non c&apos;è nessun mese intero: i risultati inseriti a mano sono mensili. Scegli un periodo che ne contenga almeno uno, per esempio &quot;Mese scorso&quot;.
          </p>
        ) : !haDati ? (
          <p className="text-sm text-ink-500">
            {misura === "appuntamenti" && grana === "settimana"
              ? "Per questa sede non ci sono calendari GHL collegati: gli appuntamenti non si possono contare."
              : "Nessun risultato inserito per i mesi di questo periodo."}
          </p>
        ) : (
          <div className="relative">
            <svg
              viewBox={`0 0 ${WIDTH} ${PAD_TOP + HEIGHT + HEIGHT_ETICHETTE}`}
              className="h-auto w-full"
              role="img"
              aria-label={`Andamento dei venditori per ${unita}: ${misuraAttiva.nomeAsse}. I numeri sono nella tabella "Numeri del grafico" qui sotto.`}
            >
              <g transform={`translate(0, ${PAD_TOP})`}>
                {tacche.map((t) => (
                  <g key={t}>
                    <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={yFor(t)} y2={yFor(t)} stroke="var(--gridline)" strokeWidth={1} />
                    <text x={PAD_LEFT - 8} y={yFor(t) + 3} textAnchor="end" fontSize={12} fill="var(--text-muted)">
                      {misura === "fatturato" ? formatEuroIntero(t) : formatNumero(t)}
                    </text>
                  </g>
                ))}

                {serie.map((s) => (
                  <path key={s.id} d={percorso(s.id)} fill="none" stroke={s.colore} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                ))}
                {serie.map((s) =>
                  punti.map((p, i) => {
                    const v = valore(i, s.id);
                    return v === null ? null : <circle key={`${s.id}-${p.chiave}`} cx={xFor(i)} cy={yFor(v)} r={hoverIndex === i ? 4.5 : 3} fill={s.colore} stroke="var(--surface-1)" strokeWidth={1.5} />;
                  })
                )}

                {hoverIndex !== null && <line x1={xFor(hoverIndex)} x2={xFor(hoverIndex)} y1={0} y2={HEIGHT} stroke="var(--baseline)" strokeWidth={1} />}

                {punti.map((p, i) =>
                  i % passoEtichette === 0 ? (
                    <text key={p.chiave} x={xFor(i)} y={HEIGHT + 18} textAnchor="middle" fontSize={12} fill="var(--text-muted)">
                      {p.etichetta}
                    </text>
                  ) : null
                )}

                <rect
                  x={PAD_LEFT - 8}
                  y={0}
                  width={plotW + 16}
                  height={HEIGHT}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`Scorri ${unita === "settimana" ? "le settimane" : "i mesi"} con le frecce`}
                  onMouseMove={suMovimento}
                  onMouseLeave={() => setHoverIndex(null)}
                  onFocus={() => setHoverIndex((i) => i ?? 0)}
                  onBlur={() => setHoverIndex(null)}
                  onKeyDown={suTasto}
                />
              </g>
            </svg>

            {attivo && hoverIndex !== null && (
              <div
                className="pointer-events-none absolute top-2 z-10 rounded-lg border border-ink-300 bg-surface-card px-3 py-2 text-xs shadow-sm"
                // Vicino ai bordi il riquadro resta dentro il grafico invece di uscirne.
                style={{ left: `${Math.min(85, Math.max(15, (xFor(hoverIndex) / WIDTH) * 100))}%`, transform: "translateX(-50%)" }}
              >
                <p className="mb-1 font-medium text-ink-500">
                  {grana === "settimana" ? `Settimana del ${attivo.etichetta}` : attivo.etichetta}
                </p>
                {serie.map((s) => (
                  <p key={s.id} className="flex items-center gap-1.5 whitespace-nowrap text-ink-900">
                    <span aria-hidden="true" className="inline-block h-0.5 w-2.5" style={{ background: s.colore }} />
                    <strong>{formatMisura(misura, valore(hoverIndex, s.id))}</strong> <span className="text-ink-500">{s.nome}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {statoGrafico === "ok" && haDati && (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs font-semibold text-ink-700 hover:text-brand">Numeri del grafico</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[360px] border-collapse text-sm">
              <caption className="sr-only">
                {misuraAttiva.label} per {unita} e per venditore
              </caption>
              <thead>
                <tr className="border-b border-linea text-left text-xs font-bold text-ink-700">
                  <th scope="col" className="py-1.5 pr-3">
                    {grana === "settimana" ? "Settimana del" : "Mese"}
                  </th>
                  {serie.map((s) => (
                    <th key={s.id} scope="col" className="px-3 py-1.5 text-right">
                      {s.nome}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {punti.map((p, i) => (
                  <tr key={p.chiave} className="border-b border-linea last:border-b-0">
                    <th scope="row" className="py-1.5 pr-3 text-left font-normal text-ink-700">
                      {p.etichetta}
                    </th>
                    {serie.map((s) => (
                      <td key={s.id} className="px-3 py-1.5 text-right tabular-nums text-ink-900">
                        {formatMisura(misura, valore(i, s.id))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      </div>

      <div className="space-y-1 text-xs text-ink-500">
        {righe.some((r) => r.fonte === "ghl") && (
          <p>
            {perimetroGhl === "campagne-scelte"
              ? "Da GHL: gli appuntamenti e le vendite assegnati al venditore nel periodo, solo per i contatti arrivati dalle campagne scelte in alto. Restano fuori anche i contatti senza campagna (passaparola, non tracciati): per contarli scegli tutte le campagne."
              : perimetroGhl === "tutti"
                ? "Da GHL: ogni appuntamento e ogni vendita assegnati al venditore nel periodo, qualunque sia la campagna."
                : "Da GHL: ogni appuntamento e ogni vendita assegnati al venditore nel periodo."}{" "}
            Contano anche gli appuntamenti successivi con lo stesso contatto, quindi la somma può superare gli appuntamenti delle tessere in alto, che contano solo il primo.
          </p>
        )}
        {righe.some((r) => r.fonte === "manuale") && (
          <p>
            Inseriti a mano: sono mensili, e contano solo i mesi che stanno per intero nel periodo scelto.
            {manualiNonDivisi && " Non si possono dividere per campagna: restano quelli inseriti, anche col filtro campagne."}
          </p>
        )}
        {nomiFuori.length > 0 && (
          <p>
            Non {nomiFuori.length === 1 ? "è nel grafico" : "sono nel grafico"}: {nomiFuori.join(", ")}
            {andamento.fuoriDalGrafico.length > 0 ? " — il grafico è per settimana, i risultati inseriti a mano sono per mese." : "."}
          </p>
        )}
      </div>
    </div>
  );
}
