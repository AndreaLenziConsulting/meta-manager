import type { Campagna, FunnelRow, MetaDailyRow } from "@/types/kpi";

export type MeseSenzaFunnel = { mese: string; investimento: number };

/**
 * Mesi in cui una sede ha speso su Meta Ads ma non ha nessuna riga Funnel corrispondente (nemmeno
 * a zero) — segnala un gap di compilazione, non un mese realmente senza appuntamenti/vendite.
 * Stessa attribuzione MetaDaily -> sede di computeKpi in kpi.ts: MetaDaily non porta sedeId, si passa
 * dalle campagne della sede (clienteId + sedeId -> campaignId).
 */
export function mesiConSpesaSenzaFunnel(
  clienteId: string,
  sedeId: string,
  metaDaily: MetaDailyRow[],
  campagne: Campagna[],
  funnel: FunnelRow[]
): MeseSenzaFunnel[] {
  const campaignIdsSede = new Set(
    campagne.filter((c) => c.clienteId === clienteId && c.sedeId === sedeId).map((c) => c.campaignId)
  );

  const spesaPerMese = new Map<string, number>();
  for (const row of metaDaily) {
    if (row.clienteId !== clienteId) continue;
    if (!campaignIdsSede.has(row.campaignId)) continue;
    const mese = row.data.slice(0, 7);
    spesaPerMese.set(mese, (spesaPerMese.get(mese) ?? 0) + row.spesa);
  }

  // Un mese con ALMENO una riga Funnel (anche con tutti i campi a 0) non è un gap: il team ha
  // compilato il dato, semplicemente non è successo nulla. Solo l'assenza totale di righe conta.
  const mesiConFunnel = new Set(
    funnel.filter((r) => r.clienteId === clienteId && r.sedeId === sedeId).map((r) => r.mese)
  );

  const risultato: MeseSenzaFunnel[] = [];
  for (const [mese, investimento] of spesaPerMese) {
    if (investimento <= 0) continue;
    if (mesiConFunnel.has(mese)) continue;
    risultato.push({ mese, investimento });
  }

  return risultato.sort((a, b) => a.mese.localeCompare(b.mese));
}
