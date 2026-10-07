import type { Metadata } from "next";

// La pagina di accesso è un componente client (non può esportare `metadata`): il titolo della
// scheda del browser sta qui.
export const metadata: Metadata = { title: "Accesso" };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
