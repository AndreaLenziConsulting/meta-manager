import type { RiepilogoDashboard } from "@/lib/dashboardAdmin";
import { Kpi } from "@/components/ui/Kpi";
import { Nota } from "@/components/ui/Nota";

/**
 * Colpo d'occhio in cima alla pagina Clienti: chi apre deve capire subito se c'è qualcosa da
 * controllare, prima di scorrere le schede. Tre tessere numero del Design System ALC ("Kpi"): la
 * barra a sinistra prende il colore di stato solo quando il numero è sopra zero, altrimenti resta
 * verde — il colore non è mai l'unico segnale, la didascalia dice sempre di cosa si tratta.
 */
export function RiepilogoAllarmiAdmin({ riepilogo }: { riepilogo: RiepilogoDashboard }) {
  const { clientiAdsCritici, clientiConAttivitaInRitardo, totaleAttivitaInRitardo, clientiSentimentNegativo } = riepilogo;
  const nessunProblema = clientiAdsCritici === 0 && clientiConAttivitaInRitardo === 0 && clientiSentimentNegativo === 0;

  if (nessunProblema) {
    return (
      <Nota tono="ok" etichetta="Tutto sotto controllo">
        <p>Nessun cliente da segnalare.</p>
      </Nota>
    );
  }

  return (
    <section aria-label="Da controllare" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Kpi
        variante={clientiAdsCritici > 0 ? "critico" : "ok"}
        valore={clientiAdsCritici}
        etichetta={clientiAdsCritici === 1 ? "cliente con ads da intervenire" : "clienti con ads da intervenire"}
      />
      <Kpi
        variante={clientiConAttivitaInRitardo > 0 ? "attenzione" : "ok"}
        valore={clientiConAttivitaInRitardo}
        etichetta={`${clientiConAttivitaInRitardo === 1 ? "cliente con attività in ritardo" : "clienti con attività in ritardo"} · ${totaleAttivitaInRitardo} attività in totale`}
      />
      <Kpi
        variante={clientiSentimentNegativo > 0 ? "critico" : "ok"}
        valore={clientiSentimentNegativo}
        etichetta={clientiSentimentNegativo === 1 ? "cliente con sentiment negativo di recente" : "clienti con sentiment negativo di recente"}
      />
    </section>
  );
}
