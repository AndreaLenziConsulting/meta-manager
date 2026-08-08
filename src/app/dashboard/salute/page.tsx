import { redirect } from "next/navigation";

// La panoramica salute clienti è ora la home dell'area team (vedi src/app/dashboard/page.tsx).
export default function SaluteRedirectPage() {
  redirect("/dashboard");
}
