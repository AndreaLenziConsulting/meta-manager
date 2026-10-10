import type { ReactNode } from "react";

/**
 * Mattoni con cui si disegnano gli schemi della sezione "Processi": elementi SVG nello stile del
 * Design System ALC (Montserrat ereditato dalla pagina, colori dai token di globals.css). Uno schema
 * è un file in `schemi/` che li compone a coordinate fisse dentro il suo foglio.
 *
 * I colori sono quelli di ALC, non l'accento del cliente (`--brand-primary`): gli schemi raccontano
 * il metodo di lavoro dell'agenzia e sono uguali per tutti.
 */
export const COLORE = {
  blu: "var(--blu)",
  bluTenue: "var(--accento-tenue)",
  blu20: "var(--blu-20)",
  inchiostro: "var(--inchiostro)",
  testo: "var(--testo)",
  secondario: "var(--testo-secondario)",
  linea: "var(--linea)",
  grigio: "var(--grigio)",
  sfondo: "var(--sfondo)",
  superficie: "var(--superficie)",
  ok: "var(--ok)",
  okTenue: "var(--ok-tenue)",
  critico: "var(--critico)",
  criticoTenue: "var(--critico-tenue)",
  attenzione: "var(--attenzione)",
  attenzioneTenue: "var(--attenzione-tenue)",
  /** Linee di collegamento e contorni che devono vedersi: più scuro di `linea`, che è decorativa. */
  bordo: "var(--bordo-campo)",
  /** Testo sopra un fondo pieno (blu, verde, rosso). */
  suPieno: "var(--su-accento)",
} as const;

/** I quattro tipi di comunicazione, ciascuno col suo colore: lo stesso nei riquadri e nella legenda. */
export const TONO = {
  chiamata: { fondo: COLORE.bluTenue, bordo: COLORE.blu },
  whatsapp: { fondo: COLORE.okTenue, bordo: COLORE.ok },
  emailAutomatica: { fondo: COLORE.sfondo, bordo: COLORE.grigio },
  emailManuale: { fondo: COLORE.superficie, bordo: COLORE.inchiostro },
} as const;

export type TonoRiquadro = keyof typeof TONO;

type Ancora = "start" | "middle" | "end";

/** Una riga di testo. `spaziata` = maiuscoletto dei sopratitoli del sistema (.12em). */
export function Testo({
  x,
  y,
  misura = 13,
  peso = 500,
  colore = COLORE.testo,
  ancora = "start",
  corsivo = false,
  spaziata = false,
  sottolineato = false,
  children,
}: {
  x: number;
  y: number;
  misura?: number;
  peso?: number;
  colore?: string;
  ancora?: Ancora;
  corsivo?: boolean;
  spaziata?: boolean;
  sottolineato?: boolean;
  children: ReactNode;
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={misura}
      fontWeight={peso}
      fill={colore}
      textAnchor={ancora}
      fontStyle={corsivo ? "italic" : undefined}
      letterSpacing={spaziata ? "0.12em" : undefined}
      textDecoration={sottolineato ? "underline" : undefined}
    >
      {children}
    </text>
  );
}

/** Altezza di un riquadro con il solo titolo, e di uno con due righe di esempio sotto. */
export const ALTEZZA_RIQUADRO = 38;
export const ALTEZZA_RIQUADRO_CON_ESEMPIO = 68;

/** Un passo del processo: riquadro col titolo al centro e, se serve, le parole d'esempio sotto. */
export function Riquadro({
  x,
  y,
  larghezza,
  tono,
  titolo,
  esempio,
}: {
  x: number;
  y: number;
  larghezza: number;
  tono: TonoRiquadro;
  titolo: string;
  /** Al massimo due righe: quello che si dice o si scrive in quel passo. */
  esempio?: string[];
}) {
  const altezza = esempio ? ALTEZZA_RIQUADRO_CON_ESEMPIO : ALTEZZA_RIQUADRO;
  const centro = x + larghezza / 2;
  return (
    <g>
      <rect x={x} y={y} width={larghezza} height={altezza} rx={6} fill={TONO[tono].fondo} stroke={TONO[tono].bordo} strokeWidth={1.5} />
      <Testo x={centro} y={y + (esempio ? 23 : 24)} misura={13.5} peso={700} colore={COLORE.inchiostro} ancora="middle">
        {titolo}
      </Testo>
      {esempio?.map((riga, i) => (
        <Testo key={riga} x={centro} y={y + 40 + i * 14} misura={10} peso={400} colore={COLORE.secondario} ancora="middle" corsivo>
          {riga}
        </Testo>
      ))}
    </g>
  );
}

/** Scheda di una tappa (un giorno, una fase): superficie bianca con la barra di colore in alto. */
export function Scheda({
  x,
  y,
  larghezza,
  altezza,
  colore = COLORE.blu,
  tratteggiata = false,
  children,
}: {
  x: number;
  y: number;
  larghezza: number;
  altezza: number;
  colore?: string;
  /** Bordo tratteggiato: una tappa che non ha passi fissi. */
  tratteggiata?: boolean;
  children?: ReactNode;
}) {
  const r = 8;
  // Barra di 4px in alto: la parte della scheda sopra quella quota, angoli arrotondati compresi.
  const barra = 4;
  const rientro = r - Math.sqrt(r * r - (r - barra) * (r - barra));
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={larghezza}
        height={altezza}
        rx={r}
        fill={COLORE.superficie}
        stroke={tratteggiata ? COLORE.grigio : COLORE.linea}
        strokeWidth={1.25}
        strokeDasharray={tratteggiata ? "4 3" : undefined}
      />
      <path
        d={`M${x + rientro},${y + barra} A${r},${r} 0 0 1 ${x + r},${y} H${x + larghezza - r} A${r},${r} 0 0 1 ${x + larghezza - rientro},${y + barra} Z`}
        fill={colore}
      />
      {children}
    </g>
  );
}

/** Freccia dritta da un punto a un altro, con la punta sull'arrivo. */
export function Freccia({ da, a, colore, spessore = 1.75 }: { da: [number, number]; a: [number, number]; colore: string; spessore?: number }) {
  const dx = a[0] - da[0];
  const dy = a[1] - da[1];
  const lunga = Math.hypot(dx, dy) || 1;
  const ux = dx / lunga;
  const uy = dy / lunga;
  const punta = 10;
  const mezza = 4.5;
  // La linea si ferma alla base della punta: così la punta resta aguzza.
  const base: [number, number] = [a[0] - ux * punta, a[1] - uy * punta];
  return (
    <g>
      <line x1={da[0]} y1={da[1]} x2={base[0]} y2={base[1]} stroke={colore} strokeWidth={spessore} strokeLinecap="round" />
      <polygon points={`${a[0]},${a[1]} ${base[0] - uy * mezza},${base[1] + ux * mezza} ${base[0] + uy * mezza},${base[1] - ux * mezza}`} fill={colore} />
    </g>
  );
}

/** Freccia che gira su se stessa, con una parola al centro ("ripeti"): un giro che ricomincia. */
export function FrecciaCircolare({ cx, cy, raggio = 30, colore = COLORE.blu, children }: { cx: number; cy: number; raggio?: number; colore?: string; children?: ReactNode }) {
  // Parte in alto a destra, gira in senso orario e si ferma in alto a sinistra: la punta chiude il giro.
  const inizio = (-55 * Math.PI) / 180;
  const fine = (235 * Math.PI) / 180;
  const da = [cx + raggio * Math.cos(inizio), cy + raggio * Math.sin(inizio)];
  const a = [cx + raggio * Math.cos(fine), cy + raggio * Math.sin(fine)];
  const tx = -Math.sin(fine);
  const ty = Math.cos(fine);
  const punta = 9;
  const mezza = 5;
  return (
    <g>
      <path d={`M${da[0]},${da[1]} A${raggio},${raggio} 0 1 1 ${a[0]},${a[1]}`} fill="none" stroke={colore} strokeWidth={2} strokeLinecap="round" />
      <polygon points={`${a[0] + tx * punta},${a[1] + ty * punta} ${a[0] - ty * mezza},${a[1] + tx * mezza} ${a[0] + ty * mezza},${a[1] - tx * mezza}`} fill={colore} />
      {children && (
        <Testo x={cx} y={cy + 4} misura={12} peso={700} colore={colore} ancora="middle">
          {children}
        </Testo>
      )}
    </g>
  );
}

/** Pallino vuoto della legenda: il colore del bordo dice di che tipo di passo si parla. */
export function Anello({ x, y, colore }: { x: number; y: number; colore: string }) {
  return <circle cx={x} cy={y} r={5} fill={COLORE.superficie} stroke={colore} strokeWidth={2} />;
}

/** Barra di colore in cima a un rettangolo arrotondato: la parte sopra quella quota, angoli compresi. */
function BarraInCima({ x, y, larghezza, raggio, spessore, colore }: { x: number; y: number; larghezza: number; raggio: number; spessore: number; colore: string }) {
  const s = Math.min(spessore, raggio);
  const rientro = raggio - Math.sqrt(raggio * raggio - (raggio - s) * (raggio - s));
  return (
    <path
      d={`M${x + rientro},${y + s} A${raggio},${raggio} 0 0 1 ${x + raggio},${y} H${x + larghezza - raggio} A${raggio},${raggio} 0 0 1 ${x + larghezza - rientro},${y + s} Z`}
      fill={colore}
    />
  );
}

/**
 * Casella di uno schema: un titolo (anche su due righe) e, sotto, qualche riga di spiegazione, il
 * tutto centrato. Può avere un fondo pieno (allora i testi vanno in `suPieno`) o la barra di colore
 * in alto.
 */
export function Casella({
  x,
  y,
  larghezza,
  altezza,
  titolo,
  righe = [],
  fondo = COLORE.superficie,
  bordo = COLORE.linea,
  spessoreBordo = 1.5,
  tratteggiata = false,
  barra,
  coloreTitolo = COLORE.inchiostro,
  coloreRighe = COLORE.testo,
  misuraTitolo = 22,
  pesoTitolo = 700,
  misuraRighe = 16.5,
  raggio = 12,
  titoloSottolineato = false,
}: {
  x: number;
  y: number;
  larghezza: number;
  altezza: number;
  titolo: string | string[];
  righe?: string[];
  fondo?: string;
  bordo?: string;
  spessoreBordo?: number;
  tratteggiata?: boolean;
  /** Colore della barra in alto, se c'è. */
  barra?: string;
  coloreTitolo?: string;
  coloreRighe?: string;
  misuraTitolo?: number;
  pesoTitolo?: number;
  misuraRighe?: number;
  raggio?: number;
  titoloSottolineato?: boolean;
}) {
  const titoli = Array.isArray(titolo) ? titolo : [titolo];
  const passoTitolo = misuraTitolo * 1.2;
  const passoRiga = misuraRighe * 1.3;
  const stacco = righe.length ? misuraRighe * 0.3 : 0;
  const blocco = titoli.length * passoTitolo + stacco + righe.length * passoRiga;
  const cima = y + (altezza - blocco) / 2 + (barra ? 3 : 0);
  const centro = x + larghezza / 2;
  return (
    <g>
      <rect x={x} y={y} width={larghezza} height={altezza} rx={raggio} fill={fondo} stroke={bordo} strokeWidth={spessoreBordo} strokeDasharray={tratteggiata ? "6 4" : undefined} />
      {barra && <BarraInCima x={x} y={y} larghezza={larghezza} raggio={raggio} spessore={6} colore={barra} />}
      {titoli.map((riga, i) => (
        <Testo key={riga} x={centro} y={cima + i * passoTitolo + misuraTitolo * 0.84} misura={misuraTitolo} peso={pesoTitolo} colore={coloreTitolo} ancora="middle" sottolineato={titoloSottolineato}>
          {riga}
        </Testo>
      ))}
      {righe.map((riga, i) => (
        <Testo key={riga} x={centro} y={cima + titoli.length * passoTitolo + stacco + i * passoRiga + misuraRighe * 0.8} misura={misuraRighe} colore={coloreRighe} ancora="middle">
          {riga}
        </Testo>
      ))}
    </g>
  );
}

/** Pillola fra due caselle: il passaggio che porta dall'una all'altra ("Prima chiamata", "Closing"). */
export function Pillola({ x, y, larghezza, altezza, righe, nota }: { x: number; y: number; larghezza: number; altezza: number; righe: string[]; /** Riga piccola sotto. */ nota?: string }) {
  const misura = 15.5;
  const passo = misura * 1.22;
  const blocco = righe.length * passo + (nota ? 17 : 0);
  const cima = y + (altezza - blocco) / 2;
  const centro = x + larghezza / 2;
  return (
    <g>
      <rect x={x} y={y} width={larghezza} height={altezza} rx={Math.min(altezza / 2, 34)} fill={COLORE.sfondo} stroke={COLORE.linea} strokeWidth={1.5} />
      {righe.map((riga, i) => (
        <Testo key={riga} x={centro} y={cima + i * passo + misura * 0.84} misura={misura} peso={700} colore={COLORE.inchiostro} ancora="middle">
          {riga}
        </Testo>
      ))}
      {nota && (
        <Testo x={centro} y={cima + righe.length * passo + 13} misura={13} colore={COLORE.secondario} ancora="middle">
          {nota}
        </Testo>
      )}
    </g>
  );
}

/** Rombo: un momento o una decisione. */
export function Rombo({
  cx,
  cy,
  mezzaLarghezza,
  mezzaAltezza,
  righe,
  misura = 24,
  nota,
}: {
  cx: number;
  cy: number;
  mezzaLarghezza: number;
  mezzaAltezza: number;
  righe: string[];
  misura?: number;
  /** Riga più leggera sotto il nome. */
  nota?: string;
}) {
  const passo = misura * 1.25;
  const passoNota = nota ? misura * 1.1 : 0;
  const cima = cy - (righe.length * passo + passoNota) / 2;
  return (
    <g>
      <polygon
        points={`${cx},${cy - mezzaAltezza} ${cx + mezzaLarghezza},${cy} ${cx},${cy + mezzaAltezza} ${cx - mezzaLarghezza},${cy}`}
        fill={COLORE.superficie}
        stroke={COLORE.bordo}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      {righe.map((riga, i) => (
        <Testo key={riga} x={cx} y={cima + i * passo + misura * 0.84} misura={misura} peso={800} colore={COLORE.inchiostro} ancora="middle">
          {riga}
        </Testo>
      ))}
      {nota && (
        <Testo x={cx} y={cima + righe.length * passo + misura * 0.74} misura={misura * 0.88} colore={COLORE.testo} ancora="middle">
          {nota}
        </Testo>
      )}
    </g>
  );
}

/**
 * Collegamento che passa per più punti, ad angoli retti o no, con la punta sull'ultimo. Senza punta
 * (`punta={false}`) è una semplice linea spezzata: serve per le graffe e i richiami tratteggiati.
 */
export function FrecciaSpezzata({
  punti,
  colore = COLORE.bordo,
  spessore = 2,
  tratteggiata = false,
  punta = true,
  misuraPunta = 9,
}: {
  punti: [number, number][];
  colore?: string;
  spessore?: number;
  tratteggiata?: boolean;
  punta?: boolean;
  misuraPunta?: number;
}) {
  const ultimo = punti[punti.length - 1];
  const penultimo = punti[punti.length - 2];
  const dx = ultimo[0] - penultimo[0];
  const dy = ultimo[1] - penultimo[1];
  const lunga = Math.hypot(dx, dy) || 1;
  const ux = dx / lunga;
  const uy = dy / lunga;
  const mezza = misuraPunta * 0.5;
  // Con la punta, la linea si ferma alla sua base.
  const fine: [number, number] = punta ? [ultimo[0] - ux * misuraPunta, ultimo[1] - uy * misuraPunta] : ultimo;
  const tracciato = [...punti.slice(0, -1), fine].map(([px, py]) => `${px},${py}`).join(" ");
  return (
    <g>
      <polyline points={tracciato} fill="none" stroke={colore} strokeWidth={spessore} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={tratteggiata ? "6 5" : undefined} />
      {punta && <polygon points={`${ultimo[0]},${ultimo[1]} ${fine[0] - uy * mezza},${fine[1] + ux * mezza} ${fine[0] + uy * mezza},${fine[1] - ux * mezza}`} fill={colore} />}
    </g>
  );
}
