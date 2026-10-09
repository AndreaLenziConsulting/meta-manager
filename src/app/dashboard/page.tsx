import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessione } from "@/lib/auth";
import { getAttivitaCliente, getCampagne, getClienti, getConsulenti, getMeetingCliente, getMetaDaily, getSedi } from "@/lib/archivio";
import { clientiVisibili } from "@/lib/authz";
import { calcolaRiepilogo, ordinaPerPriorita } from "@/lib/dashboardAdmin";
import { GIORNI_FINESTRA_SALUTE, costruisciSaluteClienti, finestraSalute } from "@/lib/saluteClienti";
import { DashboardClienti } from "@/components/DashboardClienti";
import { RiepilogoAllarmiAdmin } from "@/components/RiepilogoAllarmiAdmin";
import { AvvisoSincronizzazioneMeta, type ProblemaSincronizzazioneVista } from "@/components/AvvisoSincronizzazioneMeta";
import { diagnosticaDatiFermi, sediConDatiMetaFermi } from "@/lib/sincronizzazioneMeta";
import { fetchSpesaCampagne } from "@/lib/meta";
import { etichettaIntervallo } from "@/lib/periodo";
import { Intestazione } from "@/components/ui/Intestazione";
import { Nota } from "@/components/ui/Nota";
import { CLASSE_PULSANTE, DIMENSIONE_PULSANTE, VARIANTE_PULSANTE } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Clienti" };

const GIORNI_FINESTRA = GIORNI_FINESTRA_SALUTE;

/**
 * Pagina Clienti unificata — sostituisce sia la vecchia "Dashboard Amministratore" (admin-only)
 * sia la vecchia pagina "Clienti" (dashboard/clienti/page.tsx, ora un redirect qui): richiesta
 * esplicita dell'utente, che considerava inutile avere entrambe. Stessa vista priorità/salute per
 * tutti, ma scoped da clientiVisibili — admin vede tutti i clienti attivi, consulente solo i
 * propri (già filtrati attivi da clientiVisibili stessa). Il consulente non viene più rediretto
 * dritto sul suo unico cliente come prima: vede questa dashboard anche con un solo cliente, per
 * gli stessi segnali (ads/attività/sentiment) che prima erano riservati all'admin.
 */
export default async function DashboardHomePage() {
  const sessione = await getSessione();

  if (!sessione) {
    redirect("/login");
  }

  if (sessione.ruolo === "commerciale") {
    redirect("/dashboard/commerciale");
  }

  const isAdmin = sessione.ruolo === "admin";
  const { da: daData, a: aData } = finestraSalute();

  const [clienti, metaDaily, campagne, attivitaTutte, consulenti, sedi, meetingTutti] = await Promise.all([
    getClienti(),
    getMetaDaily(),
    getCampagne(),
    getAttivitaCliente(),
    getConsulenti(),
    getSedi(),
    getMeetingCliente(),
  ]);
  const visibili = clientiVisibili(sessione, clienti);

  if (visibili.length === 0) {
    return (
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        <Intestazione titolo="Clienti." />
        <Nota etichetta="Nessun cliente">
          <p>Non hai ancora clienti assegnati. Quando un amministratore te ne assegna uno, lo trovi qui.</p>
        </Nota>
      </div>
    );
  }

  // I segnali di ogni cliente (salute ads, attività in ritardo, clima): lo stesso calcolo del
  // riepilogo via email per l'amministrazione, vedi src/lib/saluteClienti.ts.
  const items = costruisciSaluteClienti({ clienti: visibili, sedi, campagne, metaDaily, attivita: attivitaTutte, meeting: meetingTutti, da: daData, a: aData });
  const itemsOrdinati = ordinaPerPriorita(items);
  const riepilogo = calcolaRiepilogo(itemsOrdinati);

  // Avviso "Dati Meta non aggiornati" (01/10/2026, vedi lib/sincronizzazioneMeta.ts): prima il
  // controllo puro sui dati già letti sopra, poi una verifica dal vivo su Meta SOLO per le sedi
  // candidate — in condizioni normali nessuna, quindi nessuna chiamata Meta in più. Limitato ai
  // clienti che questa sessione può vedere. Mai un errore che rompe la pagina: se la diagnosi
  // stessa fallisce in modo imprevisto, semplicemente nessun banner.
  let problemiSincronizzazione: ProblemaSincronizzazioneVista[] = [];
  try {
    const idVisibili = new Set(visibili.map((c) => c.clienteId));
    const sediVisibili = sedi.filter((s) => idVisibili.has(s.clienteId));
    const ferme = sediConDatiMetaFermi({ sedi: sediVisibili, campagne, metaDaily, oggi: aData });
    const problemi = await diagnosticaDatiFermi(ferme, aData, fetchSpesaCampagne);
    problemiSincronizzazione = problemi.map((p) => ({
      ...p,
      nomeCliente: visibili.find((c) => c.clienteId === p.clienteId)?.nome ?? p.clienteId,
      nomeSede:
        sediVisibili.filter((s) => s.clienteId === p.clienteId && s.attivo).length > 1
          ? (sediVisibili.find((s) => s.sedeId === p.sedeId)?.nome ?? null)
          : null,
    }));
  } catch {
    problemiSincronizzazione = [];
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      <Intestazione
        sopratitolo={`Ultimi ${GIORNI_FINESTRA} giorni · ${etichettaIntervallo(daData, aData)}`}
        titolo="Clienti."
        sottotitolo={`Costo per lead contro il target e stato dei lavori, ${isAdmin ? "cliente per cliente" : "sui tuoi clienti"}.`}
        azioni={
          isAdmin && (
            <a href="/dashboard/nuovo-cliente" className={cn(CLASSE_PULSANTE, VARIANTE_PULSANTE.crea, DIMENSIONE_PULSANTE.md)}>
              + Nuovo cliente
            </a>
          )
        }
      />
      <AvvisoSincronizzazioneMeta problemi={problemiSincronizzazione} />
      <RiepilogoAllarmiAdmin riepilogo={riepilogo} />
      <DashboardClienti items={itemsOrdinati} consulenti={consulenti} mostraToggle={isAdmin} />
    </div>
  );
}
