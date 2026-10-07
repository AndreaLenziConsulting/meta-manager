import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessione } from "@/lib/auth";
import { getConsulenti, getProdotti } from "@/lib/archivio";
import { NuovoClienteForm } from "@/components/NuovoClienteForm";
import { Intestazione } from "@/components/ui/Intestazione";

export const metadata: Metadata = { title: "Nuovo cliente" };

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
    <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      <Intestazione
        titolo="Nuovo cliente."
        sottotitolo="Crea la scheda e, se scegli un prodotto, la sua roadmap di attività nasce subito."
      />
      <NuovoClienteForm
        consulenti={consulenti.filter((c) => c.attivo).map((c) => ({ consulenteId: c.consulenteId, nome: c.nome }))}
        prodotti={prodotti.filter((p) => p.attivo).map((p) => ({ prodottoId: p.prodottoId, nome: p.nome }))}
      />
    </div>
  );
}
