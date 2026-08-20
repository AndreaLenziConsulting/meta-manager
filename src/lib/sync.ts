import { aggiornaStatoCampagne, ensureCampagneMappate, upsertMetaDailyRows } from "@/lib/sheets";
import { fetchCampaignInsights, fetchStatoCampagne } from "@/lib/meta";
import type { Sede } from "@/types/kpi";

// Finestra rolling: rilegge gli ultimi giorni per catturare aggiornamenti tardivi di attribuzione Meta.
const GIORNI_ROLLING = 3;

function formatData(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Sincronizza spesa/lead e stato campagne da Meta Ads per una singola sede sulla finestra rolling di default. */
export async function syncSede(sede: Sede): Promise<{ righe: number }> {
  const oggi = new Date();
  const inizio = new Date(oggi);
  inizio.setDate(inizio.getDate() - GIORNI_ROLLING);
  const since = formatData(inizio);
  const until = formatData(oggi);

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
