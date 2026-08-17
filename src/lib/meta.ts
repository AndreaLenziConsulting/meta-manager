import type { MetaDailyRow } from "@/types/kpi";

// Rappresentazioni alternative dello STESSO evento lead (mai da sommare tra loro):
// "onsite_conversion.lead_grouped" e "lead" compaiono entrambi, con lo stesso valore,
// per i lead raccolti con Instant Form su Meta. "offsite_conversion.fb_pixel_lead" copre
// invece i lead da pixel su siti esterni. Si prende il primo match in ordine di priorità.
const LEAD_ACTION_PRIORITY = [
  "onsite_conversion.lead_grouped",
  "lead",
  "offsite_conversion.fb_pixel_lead",
];

export type MetaAction = { action_type: string; value: string };

type MetaInsightRow = {
  campaign_id: string;
  campaign_name: string;
  date_start: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: MetaAction[];
};

// `tipoConversioneLead` (colonna `tipo_conversione_lead` in Clienti) copre i clienti il cui
// funnel non usa Lead Ads/Instant Form ma un altro evento di conversione (es. "Completamento
// registrazione" per webinar/eventi dal vivo — action_type tipo
// "offsite_conversion.fb_pixel_complete_registration", diverso da qualunque variante di "lead").
// Se impostato, è l'UNICO criterio usato (non un ulteriore fallback): un cliente con un funnel a
// registrazione non deve rischiare di sommare per errore anche eventuali "lead" incidentali da
// altre campagne, con semantica ambigua giorno per giorno.
export function extractLeads(actions: MetaAction[] | undefined, tipoConversioneLead?: string): number {
  if (!actions) return 0;
  const tipi = tipoConversioneLead ? [tipoConversioneLead] : LEAD_ACTION_PRIORITY;
  for (const type of tipi) {
    const match = actions.find((a) => a.action_type === type);
    if (match) return Number(match.value || 0);
  }
  return 0;
}

function metaToken(): string {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN non configurato");
  return token;
}

function metaApiVersion(): string {
  return process.env.META_API_VERSION || "v21.0";
}

/** Segue `paging.next` fino in fondo e accoda tutti gli elementi di `data`. Stessa gestione errori per ogni endpoint Meta. */
async function fetchTutteLePagine<T>(url: URL): Promise<T[]> {
  const risultati: T[] = [];
  let nextUrl: string | null = url.toString();

  while (nextUrl) {
    const res: Response = await fetch(nextUrl);
    const json: { data?: T[]; paging?: { next?: string }; error?: { message: string } } = await res.json();

    if (!res.ok || json.error) {
      throw new Error(`Meta API error: ${json.error?.message || res.statusText}`);
    }

    risultati.push(...(json.data ?? []));
    nextUrl = json.paging?.next ?? null;
  }

  return risultati;
}

/**
 * Legge le insight giornaliere a livello campagna per un ad account, sulla finestra di date indicata.
 * `since`/`until` in formato YYYY-MM-DD.
 */
export async function fetchCampaignInsights(
  adAccountId: string,
  clienteId: string,
  since: string,
  until: string,
  tipoConversioneLead?: string
): Promise<{ rows: MetaDailyRow[]; campagne: { campaignId: string; nomeCampagna: string }[] }> {
  const fields = "campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,cpm,actions";
  const url = new URL(`https://graph.facebook.com/${metaApiVersion()}/act_${adAccountId}/insights`);
  url.searchParams.set("level", "campaign");
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("fields", fields);
  url.searchParams.set("time_range", JSON.stringify({ since, until }));
  url.searchParams.set("access_token", metaToken());
  url.searchParams.set("limit", "500");

  const items = await fetchTutteLePagine<MetaInsightRow>(url);

  const rows: MetaDailyRow[] = [];
  const campagneVisteMap = new Map<string, string>();
  for (const item of items) {
    campagneVisteMap.set(item.campaign_id, item.campaign_name);
    rows.push({
      data: item.date_start,
      clienteId,
      campaignId: item.campaign_id,
      spesa: Number(item.spend || 0),
      impressions: Number(item.impressions || 0),
      clicks: Number(item.clicks || 0),
      ctr: Number(item.ctr || 0),
      cpc: Number(item.cpc || 0),
      cpm: Number(item.cpm || 0),
      lead: extractLeads(item.actions, tipoConversioneLead),
    });
  }

  const campagne = Array.from(campagneVisteMap.entries()).map(([campaignId, nomeCampagna]) => ({
    campaignId,
    nomeCampagna,
  }));

  return { rows, campagne };
}

type MetaCampaignStatus = { id: string; effective_status?: string };

/** Stato corrente (ACTIVE/PAUSED/...) di tutte le campagne di un ad account, per campaign_id. */
export async function fetchStatoCampagne(adAccountId: string): Promise<Map<string, string>> {
  const url = new URL(`https://graph.facebook.com/${metaApiVersion()}/act_${adAccountId}/campaigns`);
  url.searchParams.set("fields", "id,effective_status");
  url.searchParams.set("access_token", metaToken());
  url.searchParams.set("limit", "500");

  const items = await fetchTutteLePagine<MetaCampaignStatus>(url);

  const stati = new Map<string, string>();
  for (const item of items) {
    if (item.effective_status) stati.set(item.id, item.effective_status);
  }
  return stati;
}
