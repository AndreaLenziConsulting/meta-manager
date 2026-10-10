import type { CSSProperties } from "react";
import { isHexValido } from "@/lib/colore";
import { palettaCliente } from "@/lib/palettaCliente";
import type { Cliente } from "@/types/kpi";

/** Font aggiuntivi caricati staticamente in layout.tsx (next/font/google richiede un import fisso
 * per font — non può caricare a runtime un nome font arbitrario da un campo di testo libero).
 * Aggiungere un nuovo font: import in layout.tsx + nuovo case qui, mai un valore libero. */
export const FONT_CLIENTE_DISPONIBILI = ["poppins", "dm-sans"] as const;
export type FontCliente = (typeof FONT_CLIENTE_DISPONIBILI)[number];

export function isFontClienteValido(v: string): v is FontCliente {
  return (FONT_CLIENTE_DISPONIBILI as readonly string[]).includes(v);
}

export type CampiTema = Pick<Cliente, "colorePrimario" | "coloreSecondario" | "fontPersonalizzato">;

/**
 * Custom properties CSS da iniettare (via style inline) sul contenitore che avvolge le schermate
 * di un cliente, per sovrascrivere il brand ALC di default con quello del cliente — mai un tema
 * fisso in globals.css (i colori arrivano da dati, uno per cliente, non da un set enumerato).
 *
 * Dal 10/10/2026 i due colori del cliente sovrascrivono TUTTI i colori di marca di ALC, non più il
 * solo accento (richiesta dell'utente): titoli, testi, bordi, fondi, ombre e sfumature. Il calcolo
 * sta in palettaCliente.ts, che garantisce anche il contrasto di ogni testo sul suo fondo. Con un
 * colore solo si usa quello per entrambi i ruoli.
 *
 * Mai i colori di STATO (successo/attenzione/critico, vedi statusStyles.ts) o il verde `crea`: quelli
 * restano identici per ogni cliente — sono semantica applicativa (verde = successo ovunque), non
 * identità di brand, personalizzarli confonderebbe la lettura degli stati.
 *
 * Perché la tavolozza scrive anche gli alias (`--brand-primary`, `--ink-900`…) e non solo i token di
 * base: un alias dichiarato sulla radice come `var(--inchiostro)` viene risolto LÌ, e i discendenti
 * ereditano il valore già calcolato; cambiare `--inchiostro` più in basso non lo ricalcola.
 *
 * Per il font, sovrascrivo `--font-montserrat` (il nome REALE generato da next/font in layout.tsx,
 * l'unica famiglia del Design System ALC) e non `--font-heading`/`--font-sans` (l'alias semantico intermedio
 * definito in `@theme inline` di globals.css) — `@theme inline` fa risolvere a Tailwind le utility
 * `font-heading`/`font-sans` fino al valore FOGLIA già al momento della build, saltando quell'alias
 * intermedio: sovrascriverlo a runtime non avrebbe alcun effetto sulle classi già generate.
 *
 * `undefined` se il cliente non ha alcuna personalizzazione — il chiamante può fare
 * `style={styleTemaCliente(cliente)}` senza controlli, uno style vuoto/undefined non ha effetto.
 * Il chiamante deve comunque aggiungere `font-sans` alla className del contenitore che riceve
 * questo style (vedi dashboard/cliente/[clienteId]/page.tsx): `font-family` è dichiarato sul
 * `<body>`, più in alto nell'albero — una proprietà CSS ereditata si "congela" al valore già
 * calcolato dall'antenato più vicino che la dichiara esplicitamente, non ri-valuta var() per conto
 * dei discendenti, quindi va ridichiarata qui sotto perché il nuovo valore prenda effetto.
 */
export function styleTemaCliente(cliente: CampiTema): CSSProperties | undefined {
  const style: Record<string, string> = {};

  const primario = isHexValido(cliente.colorePrimario) ? cliente.colorePrimario : null;
  const secondario = isHexValido(cliente.coloreSecondario) ? cliente.coloreSecondario : null;
  if (primario || secondario) {
    Object.assign(style, palettaCliente((primario ?? secondario)!, (secondario ?? primario)!));
  }
  if (isFontClienteValido(cliente.fontPersonalizzato)) {
    style["--font-montserrat"] = `var(--font-${cliente.fontPersonalizzato})`;
  }

  if (Object.keys(style).length === 0) return undefined;
  return style as CSSProperties;
}
