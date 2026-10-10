import type { ReactNode } from "react";
import { ALTEZZA_LEAD_VENDITA, DalLeadAllaVendita, LARGHEZZA_LEAD_VENDITA } from "@/components/processi/schemi/DalLeadAllaVendita";
import { ALTEZZA_PUBBLICITA_VENDITA, DallaPubblicitaAllaVendita, LARGHEZZA_PUBBLICITA_VENDITA } from "@/components/processi/schemi/DallaPubblicitaAllaVendita";
import { ALTEZZA_EDUCAZIONE, LARGHEZZA_EDUCAZIONE, MomentiEducazioneLead } from "@/components/processi/schemi/MomentiEducazioneLead";
import { ALTEZZA_PIRAMIDE, LARGHEZZA_PIRAMIDE, PiramideRovesciataVendita } from "@/components/processi/schemi/PiramideRovesciataVendita";
import { ALTEZZA_SETTING, LARGHEZZA_SETTING, SettingPrimi7Giorni } from "@/components/processi/schemi/SettingPrimi7Giorni";
import { ALTEZZA_ACQUISIZIONE, LARGHEZZA_ACQUISIZIONE, SistemaAcquisizione } from "@/components/processi/schemi/SistemaAcquisizione";

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
 *
 * L'ordine segue il percorso del cliente: il quadro d'insieme (i tre schemi del funnel, dalla
 * pubblicità alla vendita), il marketing, il setting, la vendita.
 * Gli originali dell'utente stanno su Google Drive, nelle cartelle cliente, come `<CLIENTE>_Schema…png`.
 */
export const PROCESSI: Processo[] = [
  {
    id: "sistema-acquisizione",
    nome: "Sistema di acquisizione",
    titolo: "Il sistema di acquisizione",
    descrizione: "Dalla pubblicità al fatturato: le fasi, i tempi, gli scarti fisiologici e i numeri da misurare.",
    larghezza: LARGHEZZA_ACQUISIZIONE,
    altezza: ALTEZZA_ACQUISIZIONE,
    schema: <SistemaAcquisizione />,
  },
  {
    id: "dalla-pubblicita-alla-vendita",
    nome: "Dalla pubblicità alla vendita",
    titolo: "Dalla pubblicità alla vendita del progetto",
    descrizione: "Quanti lead entrano nel processo commerciale e in quanto tempo diventano vendita.",
    larghezza: LARGHEZZA_PUBBLICITA_VENDITA,
    altezza: ALTEZZA_PUBBLICITA_VENDITA,
    schema: <DallaPubblicitaAllaVendita />,
  },
  {
    id: "dal-lead-alla-vendita",
    nome: "Dal lead alla vendita",
    titolo: "Dal lead alla vendita",
    descrizione: "Marketing genera e qualifica, il setting fissa e prepara, il commerciale chiude e fa follow-up.",
    larghezza: LARGHEZZA_LEAD_VENDITA,
    altezza: ALTEZZA_LEAD_VENDITA,
    schema: <DalLeadAllaVendita />,
  },
  {
    id: "momenti-educazione-lead",
    nome: "Educazione del lead",
    titolo: "I momenti di educazione del lead",
    descrizione: "Dove si educa il cliente: attrazione prima, abilità consulenziale poi.",
    larghezza: LARGHEZZA_EDUCAZIONE,
    altezza: ALTEZZA_EDUCAZIONE,
    schema: <MomentiEducazioneLead />,
  },
  {
    id: "setting-primi-7-giorni",
    nome: "Appointment setting",
    titolo: "Appointment setting: i primi 7 giorni",
    descrizione: "Cosa fa il commerciale da quando entra il lead, giorno per giorno.",
    larghezza: LARGHEZZA_SETTING,
    altezza: ALTEZZA_SETTING,
    schema: <SettingPrimi7Giorni />,
  },
  {
    id: "piramide-rovesciata-vendita",
    nome: "Piramide della vendita",
    titolo: "La piramide rovesciata della vendita",
    descrizione: "Sei fasi in sequenza: la stimolazione è quella che trasforma una vendita tecnica in una decisione.",
    larghezza: LARGHEZZA_PIRAMIDE,
    altezza: ALTEZZA_PIRAMIDE,
    schema: <PiramideRovesciataVendita />,
  },
];
