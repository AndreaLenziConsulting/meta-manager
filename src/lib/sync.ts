import { aggiornaStatoCampagne, ensureCampagneMappate, upsertMetaDailyRows } from "@/lib/sheets";
import { fetchCampaignInsights, fetchStatoCampagne } from "@/lib/meta";
import type { Sede } from "@/types/kpi";

// Finestra rolling: rilegge gli ultimi giorni per catturare aggiornamenti tardivi di attribuzione Meta.
const GIORNI_ROLLING = 3;

function formatData(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Corpo comune di syncSede/backfillSede sotto — la sola differenza tra i due è l'ampiezza della
 * finestra `since`/`until`, tutto il resto (scrittura Campagne/MetaDaily, stato campagne) è
 * identico. Una sede senza ad account collegato (opzionale alla creazione, vedi /api/clienti e
 * /api/sedi) non ha nulla da sincronizzare — niente da chiamare su Meta, non un errore: senza
 * questo controllo fetchCampaignInsights("", ...) costruirebbe un URL malformato e fallirebbe,
 * interrompendo anche il sync delle altre sedi del cliente nel ciclo di syncCliente sotto.
 */
async function syncSedeFinestra(sede: Sede, since: string, until: string): Promise<{ righe: number }> {
  if (!sede.adAccountId) {
    return { righe: 0 };
  }

  const { rows, campagne } = await fetchCampaignInsights(
    sede.adAccountId,
    sede.clienteId,
    since,
    until,
    sede.tipoConversioneLead || undefined
  );
  await ensureCampagneMappate(
    campagne.map((c) => ({
      campaignId: c.campaignId,
      clienteId: sede.clienteId,
      sedeId: sede.sedeId,
      nomeCampagna: c.nomeCampagna,
      canale: "meta",
    }))
  );
  await upsertMetaDailyRows(rows);

  try {
    const stati = await fetchStatoCampagne(sede.adAccountId);
    await aggiornaStatoCampagne(stati);
  } catch {
    // Lo stato campagne è un'informazione accessoria: se la chiamata fallisce non deve
    // bloccare il sync di spesa/lead, che resta il dato principale.
  }

  return { righe: rows.length };
}

/** Sincronizza spesa/lead e stato campagne da Meta Ads per una singola sede sulla finestra rolling
 * di default (ultimi GIORNI_ROLLING giorni) — il percorso "normale", chiamato dal pulsante
 * "Aggiorna KPI" e dal cron giornaliero. */
export async function syncSede(sede: Sede): Promise<{ righe: number }> {
  const oggi = new Date();
  const inizio = new Date(oggi);
  inizio.setDate(inizio.getDate() - GIORNI_ROLLING);
  return syncSedeFinestra(sede, formatData(inizio), formatData(oggi));
}

/**
 * Recupero storico, ambito diverso da syncSede sopra (20/09/2026, segnalato dall'utente: campagne
 * reali mancanti nel pannello per il cliente Serveco). fetchCampaignInsights(level=campaign) di
 * Meta restituisce SOLO le campagne con attività nella finestra since/until richiesta — la
 * sincronizzazione ordinaria guarda sempre e solo gli ultimi GIORNI_ROLLING giorni, quindi una
 * campagna mai attiva in una di quelle finestre (es. messa in pausa prima che esistesse una sync
 * quotidiana per quella sede) non viene MAI scritta in Campagne/MetaDaily, per nessun periodo —
 * verificato dal vivo: un account con 96 campagne reali ne aveva solo 2 salvate, le uniche ancora
 * attive. `ensureCampagneMappate`/`upsertMetaDailyRows` sono entrambe upsert idempotenti (stesso
 * schema di syncSede), sicure da richiamare più volte sulla stessa finestra. `since` è scelto
 * dall'admin per sede (vedi BackfillCampagneBlock in ModificaClienteModal.tsx): niente default
 * silenzioso qui, un backfill "da sempre" su un account con anni di storico può includere molto
 * rumore (vecchi post sponsorizzati di brand ormai chiusi) che l'admin potrebbe non volere.
 */
export async function backfillSede(sede: Sede, since: string): Promise<{ righe: number }> {
  return syncSedeFinestra(sede, since, formatData(new Date()));
}

/** Sincronizza tutte le sedi attive di un cliente, una dopo l'altra — usata sia dal pulsante
 * "Aggiorna KPI" sia dal cron: un solo punto d'ingresso, il chiamante non deve sapere quante sedi
 * ha il cliente. Un fallimento su una sede non blocca le altre. */
export async function syncCliente(clienteId: string, sedi: Sede[]): Promise<{ righe: number }> {
  let righe = 0;
  for (const sede of sedi.filter((s) => s.clienteId === clienteId && s.attivo)) {
    const risultato = await syncSede(sede);
    righe += risultato.righe;
  }
  return { righe };
}
