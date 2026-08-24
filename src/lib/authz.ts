import type { Cliente, Sessione } from "@/types/kpi";
import type { Prospect } from "@/types/prospect";

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

/** Prospect attivi visibili: tutti per l'admin, solo i propri per il commerciale. Stesso pattern di clientiVisibili. */
export function prospectVisibili(sessione: Sessione, tuttiProspect: Prospect[]): Prospect[] {
  const attivi = tuttiProspect.filter((p) => p.attivo);
  if (sessione.ruolo === "admin") return attivi;
  return attivi.filter((p) => p.commercialeId === sessione.commercialeId);
}

/** True se la sessione corrente può vedere/agire sul prospect indicato. */
export function puoVedereProspect(sessione: Sessione, prospectId: string, tuttiProspect: Prospect[]): boolean {
  return prospectVisibili(sessione, tuttiProspect).some((p) => p.prospectId === prospectId);
}
