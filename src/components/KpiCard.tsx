type KpiCardProps = {
  label: string;
  value: string;
};

export function KpiCard({ label, value }: KpiCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-brand">{label}</p>
      <p className="mt-1.5 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
