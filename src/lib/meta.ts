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

type MetaAction = { action_type: string; value: string };

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

function extractLeads(actions: MetaAction[] | undefined): number {
  if (!actions) return 0;
  for (const type of LEAD_ACTION_PRIORITY) {
    const match = actions.find((a) => a.action_type === type);
    if (match) return Number(match.value || 0);
  }
  return 0;
}

/**
 * Legge le insight giornaliere a livello campagna per un ad account, sulla finestra di date indicata.
 * `since`/`until` in formato YYYY-MM-DD.
 */
export async function fetchCampaignInsights(
  adAccountId: string,
  clienteId: string,
  since: string,
  until: string
): Promise<{ rows: MetaDailyRow[]; campagne: { campaignId: string; nomeCampagna: string }[] }> {
  const token = process.env.META_ACCESS_TOKEN;
  const apiVersion = process.env.META_API_VERSION || "v21.0";
  if (!token) {
    throw new Error("META_ACCESS_TOKEN non configurato");
  }

  const fields = "campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,cpm,actions";
  const url = new URL(`https://graph.facebook.com/${apiVersion}/act_${adAccountId}/insights`);
  url.searchParams.set("level", "campaign");
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("fields", fields);
  url.searchParams.set(
    "time_range",
    JSON.stringify({ since, until })
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("limit", "500");

  const rows: MetaDailyRow[] = [];
  const campagneVisteMap = new Map<string, string>();
  let nextUrl: string | null = url.toString();

  while (nextUrl) {
    const res: Response = await fetch(nextUrl);
    const json: {
      data?: MetaInsightRow[];
      paging?: { next?: string };
      error?: { message: string };
    } = await res.json();

    if (!res.ok || json.error) {
      throw new Error(`Meta API error: ${json.error?.message || res.statusText}`);
    }

    for (const item of json.data ?? []) {
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
        lead: extractLeads(item.actions),
      });
    }

    nextUrl = json.paging?.next ?? null;
  }

  const campagne = Array.from(campagneVisteMap.entries()).map(([campaignId, nomeCampagna]) => ({
    campaignId,
    nomeCampagna,
  }));

  return { rows, campagne };
}
