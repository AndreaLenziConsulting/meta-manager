import { redirect } from "next/navigation";

/**
 * Pagina "Clienti" unificata nella dashboard (vedi dashboard/page.tsx — richiesta esplicita
 * dell'utente, che considerava inutile avere una pagina Dashboard e una pagina Clienti separate).
 * Redirect, non eliminazione totale della route: qualche link/segnalibro esistente può ancora
 * puntare qui (ClienteHeader.tsx la usava come fallback prima di questo cambio).
 */
export default function ClientiListaPage() {
  redirect("/dashboard");
}
