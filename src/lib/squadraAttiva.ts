import type { Sessione } from "@/types/kpi";

/**
 * Chi è stato disattivato (o eliminato) dalle Impostazioni non deve poter continuare a usare l'app
 * con l'accesso che aveva già fatto: il cookie di sessione vale 30 giorni e dice solo "sono il
 * consulente X", non se X è ancora attivo. Questo controllo lo verifica a ogni richiesta.
 *
 * Per non rileggere la squadra a ogni richiesta (una pagina ne fa una decina), l'elenco degli attivi
 * si tiene per `validitaMs`: una disattivazione ha effetto subito sull'istanza che l'ha fatta
 * (`dimentica`) e al più tardi dopo quel tempo sulle altre. Una lettura fallita non viene tenuta.
 */
export function creaControlloSquadra(leggiAttivi: () => Promise<Set<string>>, validitaMs = 30_000, adesso: () => number = Date.now) {
  let memoria: { scade: number; attivi: Promise<Set<string>> } | null = null;

  function attivi(): Promise<Set<string>> {
    if (!memoria || memoria.scade <= adesso()) {
      const lettura = leggiAttivi();
      const questa = { scade: adesso() + validitaMs, attivi: lettura };
      memoria = questa;
      lettura.catch(() => {
        if (memoria === questa) memoria = null;
      });
    }
    return memoria.attivi;
  }

  return {
    /** L'amministratore entra con la password del team e non è nell'elenco: per lui è sempre vero. */
    async ancoraAttiva(sessione: Sessione): Promise<boolean> {
      if (sessione.ruolo === "admin") return true;
      const id = sessione.ruolo === "consulente" ? sessione.consulenteId : sessione.commercialeId;
      return (await attivi()).has(chiaveSquadra(sessione.ruolo, id ?? ""));
    },
    dimentica(): void {
      memoria = null;
    },
  };
}

export function chiaveSquadra(ruolo: "consulente" | "commerciale", id: string): string {
  return `${ruolo}/${id}`;
}
