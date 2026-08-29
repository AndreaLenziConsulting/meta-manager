import { redirect } from "next/navigation";
import { getSessione } from "@/lib/auth";
import { getConsulenti, getProdotti } from "@/lib/sheets";
import { NuovoClienteForm } from "@/components/NuovoClienteForm";

export default async function NuovoClientePage() {
  const sessione = await getSessione();
  if (!sessione) {
    redirect("/login");
  }
  if (sessione.ruolo !== "admin") {
    redirect("/dashboard");
  }

  const [consulenti, prodotti] = await Promise.all([getConsulenti(), getProdotti()]);

  return (
    <div className="max-w-2xl mx-auto px-6 sm:px-8 py-8 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Nuovo cliente</h2>
        <p className="text-sm text-gray-500 mt-1">
          Crea la scheda cliente e, se scegli un prodotto, genera subito la roadmap di attività.
        </p>
      </div>
      <NuovoClienteForm
        consulenti={consulenti.filter((c) => c.attivo).map((c) => ({ consulenteId: c.consulenteId, nome: c.nome }))}
        prodotti={prodotti.filter((p) => p.attivo).map((p) => ({ prodottoId: p.prodottoId, nome: p.nome }))}
      />
    </div>
  );
}
