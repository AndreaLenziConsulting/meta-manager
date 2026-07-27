type ClienteOption = { clienteId: string; nome: string };

export function ClientSwitcher({
  clienti,
  value,
  onChange,
}: {
  clienti: ClienteOption[];
  value: string;
  onChange: (clienteId: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border px-3 py-2 text-sm bg-transparent"
      style={{ borderColor: "var(--border-hairline)", color: "var(--text-primary)" }}
    >
      {clienti.map((c) => (
        <option key={c.clienteId} value={c.clienteId}>
          {c.nome}
        </option>
      ))}
    </select>
  );
}
