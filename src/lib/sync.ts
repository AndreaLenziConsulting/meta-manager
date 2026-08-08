import { aggiornaStatoCampagne, ensureCampagnaMapped, upsertMetaDailyRows } from "@/lib/sheets";
import { fetchCampaignInsights, fetchStatoCampagne } from "@/lib/meta";
import type { Cliente } from "@/types/kpi";

// Finestra rolling: rilegge gli ultimi giorni per catturare aggiornamenti tardivi di attribuzione Meta.
const GIORNI_ROLLING = 3;

function formatData(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Sincronizza spesa/lead e stato campagne da Meta Ads per un singolo cliente sulla finestra rolling di default. */
export async function syncCliente(cliente: Cliente): Promise<{ righe: number }> {
  const oggi = new Date();
  const inizio = new Date(oggi);
  inizio.setDate(inizio.getDate() - GIORNI_ROLLING);
  const since = formatData(inizio);
  const until = formatData(oggi);

  const { rows, campagne } = await fetchCampaignInsights(cliente.adAccountId, cliente.clienteId, since, until);
  for (const c of campagne) {
    await ensureCampagnaMapped(c.campaignId, cliente.clienteId, c.nomeCampagna);
  }
  await upsertMetaDailyRows(rows);

  try {
    const stati = await fetchStatoCampagne(cliente.adAccountId);
    await aggiornaStatoCampagne(stati);
  } catch {
    // Lo stato campagne è un'informazione accessoria: se la chiamata fallisce non deve
    // bloccare il sync di spesa/lead, che resta il dato principale.
  }

  return { righe: rows.length };
}
