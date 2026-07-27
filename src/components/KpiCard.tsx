type KpiCardProps = {
  label: string;
  value: string;
};

export function KpiCard({ label, value }: KpiCardProps) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--border-hairline)", background: "var(--surface-1)" }}
    >
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}
