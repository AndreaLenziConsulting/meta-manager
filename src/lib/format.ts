export function formatEuro(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

export function formatNumero(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 }).format(value);
}

export function formatPercentuale(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("it-IT", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

export function formatRoas(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}x`;
}

export function formatMese(mese: string): string {
  const [anno, m] = mese.split("-");
  const nomi = [
    "Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic",
  ];
  const idx = Number(m) - 1;
  return `${nomi[idx] ?? m} ${anno.slice(2)}`;
}
