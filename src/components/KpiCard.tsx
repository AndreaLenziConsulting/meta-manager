import { Card } from "@/components/ui/Card";

type KpiCardProps = {
  label: string;
  value: string;
};

export function KpiCard({ label, value }: KpiCardProps) {
  return (
    <Card padding="sm">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-brand">{label}</p>
      <p className="mt-1.5 text-2xl font-bold text-ink-900">{value}</p>
    </Card>
  );
}
