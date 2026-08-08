type ClienteOption = { clienteId: string; nome: string };

export function ClientSwitcher({
  clienti,
  value,
  onChange,
  placeholder,
}: {
  clienti: ClienteOption[];
  value: string;
  onChange: (clienteId: string) => void;
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition"
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {clienti.map((c) => (
        <option key={c.clienteId} value={c.clienteId}>
          {c.nome}
        </option>
      ))}
    </select>
  );
}
