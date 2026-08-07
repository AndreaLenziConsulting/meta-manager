import type { Cliente, Sessione } from "@/types/kpi";

/** Clienti attivi visibili per la sessione corrente: tutti per l'admin, solo gli assegnati per il consulente. */
export function clientiVisibili(sessione: Sessione, tuttiClienti: Cliente[]): Cliente[] {
  const attivi = tuttiClienti.filter((c) => c.attivo);
  if (sessione.ruolo === "admin") return attivi;
  return attivi.filter((c) => c.consulenteId === sessione.consulenteId);
}

/** True se la sessione corrente può vedere/agire sul cliente indicato. */
export function puoVedereCliente(sessione: Sessione, clienteId: string, tuttiClienti: Cliente[]): boolean {
  return clientiVisibili(sessione, tuttiClienti).some((c) => c.clienteId === clienteId);
}
