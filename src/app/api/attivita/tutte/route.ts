import { NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { getAttivitaCliente, getClienti } from "@/lib/sheets";
import { clientiVisibili } from "@/lib/authz";

export const runtime = "nodejs";

/**
 * Attività di TUTTI i clienti visibili alla sessione corrente (tutti per l'admin, solo i propri
 * per il consulente) — a differenza di GET /api/attivita (un cliente alla volta, raggruppato per
 * fase per il Gantt), qui niente clienteId in query: alimenta la vista aggregata "Attività" nel
 * menù laterale. Nessun accesso pubblico, stesso motivo di /api/attivita.
 *
 * `clienti` include TUTTI i visibili, anche quelli senza nessuna riga in `attivita` (roadmap non
 * ancora generata) — serve alla UI per distinguere "0 clienti assegnati" da "clienti assegnati ma
 * senza attività", e per risolvere il badge nome-cliente per id su ogni riga.
 */
export async function GET() {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const tuttiClienti = await getClienti();
  const visibili = clientiVisibili(sessione, tuttiClienti);
  const idVisibili = new Set(visibili.map((c) => c.clienteId));

  const tutteAttivita = await getAttivitaCliente();
  const attivita = tutteAttivita.filter((a) => idVisibili.has(a.clienteId));

  return NextResponse.json({
    clienti: visibili.map((c) => ({ clienteId: c.clienteId, nome: c.nome })),
    attivita,
  });
}
