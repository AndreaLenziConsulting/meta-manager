import type { CSSProperties } from "react";
import { isHexValido, schiarisci, scurisci } from "@/lib/colore";
import type { Cliente } from "@/types/kpi";

/** Font aggiuntivi caricati staticamente in layout.tsx (next/font/google richiede un import fisso
 * per font — non può caricare a runtime un nome font arbitrario da un campo di testo libero).
 * Aggiungere un nuovo font: import in layout.tsx + nuovo case qui, mai un valore libero. */
export const FONT_CLIENTE_DISPONIBILI = ["poppins"] as const;
export type FontCliente = (typeof FONT_CLIENTE_DISPONIBILI)[number];

export function isFontClienteValido(v: string): v is FontCliente {
  return (FONT_CLIENTE_DISPONIBILI as readonly string[]).includes(v);
}

type CampiTema = Pick<Cliente, "colorePrimario" | "coloreSecondario" | "fontPersonalizzato">;

/**
 * Custom properties CSS da iniettare (via style inline) sul contenitore che avvolge le schermate
 * di un cliente, per sovrascrivere il brand ALC di default con quello del cliente — mai un tema
 * fisso in globals.css (i colori arrivano da dati, uno per cliente, non da un set enumerato).
 *
 * Da 2 soli colori forniti (primario + secondario) derivo le stesse 3 varianti che il brand ALC ha
 * in globals.css (primary/dark/light): il secondario diventa la tinta chiara di sfondo (schiarito
 * verso il bianco — un colore chiaro come #D6DE3F letto direttamente avrebbe contrasto pessimo come
 * testo, ma è perfetto come tint di sfondo con testo scuro sopra), il primario resta la tinta
 * principale e genera anche una variante più scura scurendolo (oggi --brand-primary-dark non è
 * consumato da nessun componente, ma il token esiste per coerenza col sistema ALC).
 *
 * Mai i colori di STATO (successo/attenzione/critico, vedi statusStyles.ts) o --cta-*: quelli
 * restano identici per ogni cliente — sono semantica applicativa (verde = successo ovunque), non
 * identità di brand, personalizzarli confonderebbe la lettura degli stati.
 *
 * Per il font, sovrascrivo `--font-league-spartan`/`--font-roboto` (i nomi REALI generati da
 * next/font in layout.tsx) e non `--font-heading`/`--font-sans` (l'alias semantico intermedio
 * definito in `@theme inline` di globals.css) — `@theme inline` fa risolvere a Tailwind le utility
 * `font-heading`/`font-sans` fino al valore FOGLIA già al momento della build, saltando quell'alias
 * intermedio: sovrascriverlo a runtime non avrebbe alcun effetto sulle classi già generate.
 * Stesso motivo per cui i colori funzionano invece sovrascrivendo `--brand-primary` (già la foglia,
 * nessun alias in mezzo da saltare) — qui il livello scelto deve essere lo stesso, quello foglia.
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

  if (isHexValido(cliente.colorePrimario)) {
    style["--brand-primary"] = cliente.colorePrimario;
    style["--brand-primary-dark"] = scurisci(cliente.colorePrimario, 0.35);
  }
  if (isHexValido(cliente.coloreSecondario)) {
    style["--brand-primary-light"] = schiarisci(cliente.coloreSecondario, 0.85);
  }
  if (isFontClienteValido(cliente.fontPersonalizzato)) {
    style["--font-league-spartan"] = `var(--font-${cliente.fontPersonalizzato})`;
    style["--font-roboto"] = `var(--font-${cliente.fontPersonalizzato})`;
  }

  if (Object.keys(style).length === 0) return undefined;
  return style as CSSProperties;
}
