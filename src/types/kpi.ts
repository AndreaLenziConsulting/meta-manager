export type Cliente = {
  clienteId: string;
  nome: string;
  adAccountId: string;
  accessCode: string;
  attivo: boolean;
  consulenteId: string;
  targetCpa: number | null;
  targetCpl: number | null;
  mostraTabExtra: boolean;
};

export type Consulente = {
  consulenteId: string;
  nome: string;
  password: string;
  attivo: boolean;
};

export type Ruolo = "admin" | "consulente";

export type Sessione = {
  ruolo: Ruolo;
  consulenteId?: string;
};

export type Salute = "scala" | "mantieni" | "interveni" | "dati-insufficienti" | "no-target";

export type Campagna = {
  campaignId: string;
  clienteId: string;
  nomeCampagna: string;
  tipoCampagna: string;
};

export type MetaDailyRow = {
  data: string; // YYYY-MM-DD
  clienteId: string;
  campaignId: string;
  spesa: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  lead: number;
};

export type FunnelRow = {
  mese: string; // YYYY-MM
  clienteId: string;
  tipoCampagna: string;
  richieste: number;
  appuntamentiFissati: number;
  appuntamentiEffettuati: number;
  vendite: number;
  fatturato: number;
};

export type KpiGroup = {
  tipoCampagna: string;
  investimento: number;
  numeroLead: number;
  costoPerLead: number | null;
  numeroRichieste: number;
  costoPerRichiesta: number | null;
  appuntamentiFissati: number;
  appuntamentiEffettuati: number;
  percentualeEffettuatiSuFissati: number | null;
  costoPerAppuntamentoEffettuato: number | null;
  numeroVendite: number;
  tassoDiChiusura: number | null;
  fatturato: number;
  roas: number | null;
  cpa: number | null;
};

export type KpiResponse = {
  cliente: { clienteId: string; nome: string };
  periodo: { da: string; a: string };
  gruppi: KpiGroup[];
  totale: KpiGroup;
  trend: { mese: string; investimento: number; fatturato: number }[];
};
