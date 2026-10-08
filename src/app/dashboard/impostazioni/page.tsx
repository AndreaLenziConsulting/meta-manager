import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessione } from "@/lib/auth";
import {
  archivioAttivo,
  getClienti,
  getCommerciali,
  getConsulenti,
  getCredenzialiAccesso,
  getProdotti,
  getProspect,
  getTemplateAttivita,
} from "@/lib/archivio";
import { Impostazioni } from "@/components/impostazioni/Impostazioni";
import type { PersonaSquadra, ProdottoConModello } from "@/components/impostazioni/tipi";
import { Intestazione } from "@/components/ui/Intestazione";
import { Nota } from "@/components/ui/Nota";

export const metadata: Metadata = { title: "Impostazioni" };

/**
 * Ciò che vale per tutta l'app e non per un cliente solo: chi fa parte della squadra e come entra, i
 * prodotti, il modello di attività di ogni prodotto. Solo amministratore.
 *
 * Fino al 07/10/2026 erano schede del foglio Google compilate a mano; col passaggio al database
 * l'unico modo di cambiarle era l'editor di tabelle di Supabase.
 */
export default async function ImpostazioniPage({ searchParams }: { searchParams: Promise<{ sezione?: string | string[] }> }) {
  const { sezione } = await searchParams;
  const sessione = await getSessione();
  if (!sessione) {
    redirect("/login");
  }
  if (sessione.ruolo !== "admin") {
    redirect("/dashboard");
  }

  const [consulenti, commerciali, credenziali, clienti, prospect, prodotti, modello] = await Promise.all([
    getConsulenti(),
    getCommerciali(),
    getCredenzialiAccesso(),
    getClienti(),
    getProspect(),
    getProdotti(),
    getTemplateAttivita(),
  ]);

  // Della password al browser arriva solo se c'è: né lei né la sua impronta escono da qui.
  const conPassword = new Set(credenziali.filter((c) => c.password !== "").map((c) => `${c.ruolo}/${c.id}`));
  const squadra: PersonaSquadra[] = [
    ...consulenti.map((c) => ({
      ruolo: "consulente" as const,
      id: c.consulenteId,
      nome: c.nome,
      email: c.email,
      attivo: c.attivo,
      haPassword: conPassword.has(`consulente/${c.consulenteId}`),
      assegnati: clienti.filter((cl) => cl.attivo && cl.consulenteId === c.consulenteId).length,
    })),
    ...commerciali.map((c) => ({
      ruolo: "commerciale" as const,
      id: c.commercialeId,
      nome: c.nome,
      email: c.email,
      attivo: c.attivo,
      haPassword: conPassword.has(`commerciale/${c.commercialeId}`),
      assegnati: prospect.filter((p) => p.attivo && p.commercialeId === c.commercialeId).length,
    })),
  ];

  const prodottiConModello: ProdottoConModello[] = prodotti.map((p) => ({
    ...p,
    clienti: clienti.filter((c) => c.prodottoId === p.prodottoId).length,
    modello: modello.filter((t) => t.prodottoId === p.prodottoId).sort((a, b) => a.ordine - b.ordine),
  }));

  return (
    <div className="max-w-screen-xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      <Intestazione
        sopratitolo="Amministrazione"
        titolo="Impostazioni."
        sottotitolo="La squadra, i prodotti e le attività da cui parte la roadmap di ogni nuovo cliente."
      />
      {archivioAttivo() === "foglio" && (
        <Nota tono="attenzione" etichetta="Solo consultazione">
          <p>Questa copia dell&apos;app sta leggendo il foglio Google, non il database: qui le modifiche non si possono salvare.</p>
        </Nota>
      )}
      <Impostazioni squadra={squadra} prodotti={prodottiConModello} sezioneIniziale={typeof sezione === "string" ? sezione : undefined} />
    </div>
  );
}
