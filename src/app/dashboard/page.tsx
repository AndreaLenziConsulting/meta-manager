import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessione } from "@/lib/auth";
import { getAttivitaCliente, getCampagne, getClienti, getConsulenti, getMeetingCliente, getMetaDaily, getSedi } from "@/lib/archivio";
import { clientiVisibili } from "@/lib/authz";
import { computeSpesaLeadPeriodo } from "@/lib/kpi";
import { campagnePredefinite } from "@/lib/campagneAlc";
import { aggregaValutazioniSedi, calcolaSalute } from "@/lib/salute";
import { attivitaInRitardo, raggruppaAttivitaPerCliente } from "@/lib/roadmap";
import { andamentoSentiment, raggruppaMeetingPerCliente } from "@/lib/sentimentCliente";
import {
  calcolaRiepilogo,
  ordinaPerPriorita,
  type SaluteClienteItem,
  type SaluteSedeValutazione,
} from "@/lib/dashboardAdmin";
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

const GIORNI_FINESTRA = 7;

function formatData(d: Date): string {
  return d.toISOString().slice(0, 10);
}

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
  const oggi = new Date();
  const inizio = new Date(oggi);
  inizio.setDate(inizio.getDate() - (GIORNI_FINESTRA - 1));
  const daData = formatData(inizio);
  const aData = formatData(oggi);

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

  const attivitaPerCliente = raggruppaAttivitaPerCliente(attivitaTutte);
  // Solo i meeting con un sentiment davvero compilato: un meeting recente a volte non è ancora
  // stato revisionato (sentiment vuoto) e non deve interrompere una serie di segnali precedenti
  // ancora validi — vedi caso reale osservato: ultimo meeting vuoto, penultimo "Negativo".
  const meetingConSentimentPerCliente = raggruppaMeetingPerCliente(meetingTutti.filter((m) => m.sentiment.trim() !== ""));

  const items: SaluteClienteItem[] = visibili.map((cliente) => {
    const sediValutate: SaluteSedeValutazione[] = sedi
      .filter((s) => s.clienteId === cliente.clienteId && s.attivo)
      .map((sede) => {
        // Stesso filtro predefinito della pagina cliente (06/10/2026, vedi src/lib/campagneAlc.ts): se
        // la sede ha campagne con ALC nel nome, spesa e lead della scheda contano solo quelle.
        const predefinite = campagnePredefinite(sede, campagne);
        const { investimento, numeroLead, costoPerLead } = computeSpesaLeadPeriodo(
          cliente.clienteId,
          sede.sedeId,
          daData,
          aData,
          metaDaily,
          predefinite ? campagne.filter((c) => predefinite.has(c.campaignId)) : campagne
        );
        const valutazione = calcolaSalute(
          { investimento, numeroVendite: 0, cpa: null, costoPerLead },
          sede.targetCpa,
          sede.targetCpl
        );
        return { sede, investimento, numeroLead, valutazione };
      });
    // "Il peggio vince" tra le sedi decide lo stato della card — vedi aggregaValutazioniSedi.
    // Un cliente senza nessuna sede attiva (caso limite, es. subito dopo la creazione) non ha
    // nulla da aggregare: resta "no-target" come farebbe calcolaSalute senza target impostato.
    const valutazione =
      sediValutate.length > 0
        ? aggregaValutazioniSedi(sediValutate.map((s) => s.valutazione))
        : { stato: "no-target" as const, metricaUsata: null, valoreAttuale: null, targetUsato: null };
    return {
      cliente,
      sedi: sediValutate,
      valutazione,
      investimento: sediValutate.reduce((somma, s) => somma + s.investimento, 0),
      numeroLead: sediValutate.reduce((somma, s) => somma + s.numeroLead, 0),
      attivitaInRitardo: attivitaInRitardo(attivitaPerCliente.get(cliente.clienteId) ?? []),
      sentimentCritico: andamentoSentiment(meetingConSentimentPerCliente.get(cliente.clienteId) ?? []).aRischio,
    };
  });
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
