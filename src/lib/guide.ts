/**
 * Registro delle guide della macro-sezione "Guida" (tutorial su come usare la piattaforma, vedi
 * dashboard/guida/) — un array statico in codice, non una tab del foglio: il contenuto lo scrive
 * lo sviluppatore (testo strutturato/eventuali screenshot), non è un dato che il team modifica a
 * mano come Prodotti/TemplateAttivita. Aggiungere una guida: nuova riga qui + nuovo componente
 * contenuto in src/components/guide/, nessun'altra modifica (l'indice e il routing sono già
 * generici sullo slug).
 */
export type GuidaMeta = {
  slug: string;
  titolo: string;
  descrizione: string;
};

export const GUIDE: GuidaMeta[] = [
  {
    slug: "collegare-ghl",
    titolo: "Come collegare Go High Level",
    descrizione: "Come creare il token in GHL e collegarlo a una sede, per portare appuntamenti e vendite in diretta nel tab KPI.",
  },
];

export function trovaGuida(slug: string): GuidaMeta | undefined {
  return GUIDE.find((g) => g.slug === slug);
}
