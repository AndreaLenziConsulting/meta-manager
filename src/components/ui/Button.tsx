import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Classi del pulsante del Design System ALC ("Pulsante"), definite una volta sola in globals.css
 * (`alc-btn` e varianti): a pillola, grassetto, bordo di 2px sempre presente (così le varianti piene
 * e quella a contorno hanno la stessa altezza). Esportate perché servono anche a un `<a>` che deve
 * sembrare un pulsante (es. "+ Nuovo cliente"), dove il componente `Button` qui sotto non si può
 * usare. */
export const CLASSE_PULSANTE = "alc-btn";

export const VARIANTE_PULSANTE = {
  // Azione principale della vista: blu di accento. Una sola per vista.
  primary: "",
  // Solo le azioni che CREANO qualcosa ("+ Nuovo cliente", "+ Nuova attività"): verde `crea`. È la
  // regola del sistema — mai per salvare o per un'azione che non crea nulla.
  crea: "alc-btn--crea",
  // Azione alternativa accanto alla principale: contorno blu.
  secondary: "alc-btn--secondario",
  // Annulla e azioni terziarie: contorno neutro.
  ghost: "alc-btn--neutro",
  // Azione distruttiva, mai per qualcosa di reversibile: `critico` pieno.
  danger: "alc-btn--critico",
} as const;

export const DIMENSIONE_PULSANTE = {
  // Dentro card e tabelle: 32px di altezza, sopra il minimo di 24px per un bersaglio.
  sm: "alc-btn--piccolo",
  // Azioni di pagina: 44px di altezza, il minimo comodo anche al tocco.
  md: "",
} as const;

/**
 * Pulsante standard dell'app, nello stile del Design System ALC. `primary` è blu: il verde è
 * riservato a `crea` (prima era il colore di ogni azione principale).
 */
export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTE_PULSANTE; size?: keyof typeof DIMENSIONE_PULSANTE }) {
  return <button type="button" className={cn(CLASSE_PULSANTE, VARIANTE_PULSANTE[variant], DIMENSIONE_PULSANTE[size], className)} {...props} />;
}
