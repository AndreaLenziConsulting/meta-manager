"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setCaricamento(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrore(data.error || "Accesso non riuscito");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setCaricamento(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader subtitle="Accesso team interno" />
      <main className="flex-1 flex items-center justify-center px-4">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm space-y-4 rounded-2xl border border-gray-200 bg-white shadow-sm p-6"
        >
          <div>
            <h2 className="text-base font-semibold text-gray-900">Accesso team</h2>
            <p className="text-sm text-gray-500 mt-0.5">Inserisci la password per continuare.</p>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition"
          />
          {errore && (
            <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-100 text-red-700 text-xs">
              {errore}
            </div>
          )}
          <button
            type="submit"
            disabled={caricamento || !password}
            className="w-full rounded-xl bg-cta hover:bg-cta-dark disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 transition active:scale-[.98]"
          >
            {caricamento ? "Accesso…" : "Entra"}
          </button>
        </form>
      </main>
    </div>
  );
}
