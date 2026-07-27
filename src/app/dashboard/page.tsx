import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { isValidSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/auth";
import { DashboardClient } from "@/components/DashboardClient";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!isValidSessionCookieValue(session)) {
    redirect("/login");
  }

  return <DashboardClient />;
}
