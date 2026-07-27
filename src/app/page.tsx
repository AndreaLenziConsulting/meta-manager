import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { isValidSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/auth";

export default async function RootPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (isValidSessionCookieValue(session)) {
    redirect("/dashboard");
  }
  redirect("/login");
}
