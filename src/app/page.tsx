import { redirect } from "next/navigation";
import { getSessione } from "@/lib/auth";

export default async function RootPage() {
  if (await getSessione()) {
    redirect("/dashboard");
  }
  redirect("/login");
}
