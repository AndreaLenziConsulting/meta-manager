import type { Sede } from "@/types/kpi";

/** Sotto questa lunghezza il nome di una sede è troppo generico per cercarlo dentro il nome di una
 * campagna (una sede "A" o "IT" combacerebbe con quasi qualunque nome). */
const LUNGHEZZA_MINIMA_NOME_SEDE = 3;

/**
 * A quale sede assegnare una campagna NUOVA quando più sedi dello stesso cliente condividono lo
 * stesso ad account (Agricobots Italia/Spagna, Niteko — 01/10/2026). Prima la campagna finiva alla
 * sede che per caso la sincronizzava per prima; ora la regola è la stessa qualunque sede stia
 * sincronizzando:
 * - se il nome della campagna contiene il nome di UNA sola delle sedi che condividono l'account
 *   (senza distinzione maiuscole/minuscole — "Agricobots (Spagna) - Dal 7 Luglio" -> sede "Spagna"),
 *   va a quella sede;
 * - altrimenti (nessun nome riconosciuto, o più di uno) va alla PRIMA sede dell'account nell'ordine
 *   del foglio, la sede "di default" — mai una scelta a caso, e sempre correggibile spostando la
 *   campagna a mano.
 * Con una sola sede sull'account torna semplicemente quella: comportamento identico a prima per
 * tutti gli altri clienti. Riguarda solo le campagne non ancora mappate (ensureCampagneMappate non
 * riassegna mai una campagna esistente).
 *
 * `sediCliente` = tutte le sedi del cliente nell'ordine del foglio; `sedeCorrente` = quella che sta
 * sincronizzando.
 */
export function sedePerNuovaCampagna(nomeCampagna: string, sedeCorrente: Sede, sediCliente: Sede[]): string {
  const stessoAccount = sediCliente.filter(
    (s) => s.clienteId === sedeCorrente.clienteId && s.attivo && s.adAccountId && s.adAccountId === sedeCorrente.adAccountId
  );
  if (stessoAccount.length <= 1) return sedeCorrente.sedeId;

  const nome = nomeCampagna.toLowerCase();
  const riconosciute = stessoAccount.filter((s) => {
    const nomeSede = s.nome.trim().toLowerCase();
    return nomeSede.length >= LUNGHEZZA_MINIMA_NOME_SEDE && nome.includes(nomeSede);
  });
  return riconosciute.length === 1 ? riconosciute[0].sedeId : stessoAccount[0].sedeId;
}
