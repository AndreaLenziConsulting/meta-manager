"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <main className="flex-1 flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-black/10 dark:border-white/10 p-6"
      >
        <h1 className="text-lg font-semibold">Meta Manager ALC</h1>
        <p className="text-sm text-black/60 dark:text-white/60">Accesso team interno</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className="w-full rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 outline-none focus:border-brand"
        />
        {errore && <p className="text-sm text-red-600">{errore}</p>}
        <button
          type="submit"
          disabled={caricamento || !password}
          className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium py-2 transition-colors"
        >
          {caricamento ? "Accesso…" : "Entra"}
        </button>
      </form>
    </main>
  );
}
