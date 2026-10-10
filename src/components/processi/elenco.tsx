import type { ReactNode } from "react";
import { ALTEZZA_SETTING, LARGHEZZA_SETTING, SettingPrimi7Giorni } from "@/components/processi/schemi/SettingPrimi7Giorni";

export type Processo = {
  /** Stabile: un domani potrà finire in un indirizzo o in una scelta per cliente. */
  id: string;
  /** Nome breve, quello sulla linguetta quando gli schemi sono più di uno. */
  nome: string;
  titolo: string;
  descrizione: string;
  /** Misure del foglio su cui lo schema è disegnato. */
  larghezza: number;
  altezza: number;
  /** Il disegno: elementi SVG nelle coordinate del foglio. */
  schema: ReactNode;
};

/**
 * Gli schemi della sezione "Processi" della scheda cliente, nell'ordine in cui compaiono. Sono i
 * metodi di lavoro dell'agenzia: uguali per tutti i clienti, visibili solo al team.
 *
 * Per aggiungerne uno: un file in `schemi/` che disegna coi mattoni di `primitive.tsx`, e una voce qui.
 * Il foglio di uno schema comincia dal contenuto: niente logo, titolo, descrizione o piè di pagina disegnati dentro
 * (l'utente li ha fatti togliere il 10/10/2026, "sono ridondanti"). `titolo` e `descrizione` di qui
 * sotto compaiono già nella barra del visualizzatore.
 */
export const PROCESSI: Processo[] = [
  {
    id: "setting-primi-7-giorni",
    nome: "Appointment setting",
    titolo: "Appointment setting: i primi 7 giorni",
    descrizione: "Cosa fa il commerciale da quando entra il lead, giorno per giorno.",
    larghezza: LARGHEZZA_SETTING,
    altezza: ALTEZZA_SETTING,
    schema: <SettingPrimi7Giorni />,
  },
];
