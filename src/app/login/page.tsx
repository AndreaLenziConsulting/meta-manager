"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PulsanteIcona } from "@/components/ui/PulsanteIcona";
import { CLASSE_SOPRATITOLO } from "@/components/ui/Intestazione";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(false);
  const [mostraPassword, setMostraPassword] = useState(false);

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
    // Fondo `notte` sfumato del Design System ALC (scelta dell'utente, 10/10/2026: "proviamo tutti").
    // Il logo è la versione bianca ufficiale, sopra la card; la card resta chiara, perché dentro c'è
    // un campo da compilare.
    <div className="alc-notte-fondo min-h-screen flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center gap-8 px-4 py-10">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG del logo, nulla da ottimizzare */}
        <img src="/alc-logo-verticale-bianco.svg" alt="Andrea Lenzi Consulting" width={214} height={140} className="h-[140px] w-auto" />
        <Card padding="lg" evidenza className="w-full max-w-sm shadow-[var(--shadow-riquadro-notte)]">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <p className={CLASSE_SOPRATITOLO}>Meta Manager ALC</p>
              <h1 className="font-heading text-[28px] leading-[34px] font-extrabold text-ink-900">Accesso team.</h1>
              <p className="text-sm leading-[22px] text-ink-500">Inserisci la password che ti è stata assegnata.</p>
            </div>
            {/* Etichetta vera (prima c'era solo il segnaposto, che sparisce appena si scrive) e
                `current-password`: il gestore di password del browser la riconosce e la compila. */}
            <Field label="Password" error={errore ?? undefined}>
              <PasswordInput value={password} onChange={setPassword} visibile={mostraPassword} onToggle={() => setMostraPassword((v) => !v)} />
            </Field>
            <Button type="submit" disabled={caricamento || !password} className="w-full">
              {caricamento ? "Accesso…" : "Entra"}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}

/** Campo password con il pulsante "mostra/nascondi" dentro il bordo. Riceve `id` e gli attributi
 * `aria-*` da <Field> (che li inietta nel suo unico figlio) e li passa all'<input>. */
function PasswordInput({
  value,
  onChange,
  visibile,
  onToggle,
  ...campo
}: {
  value: string;
  onChange: (v: string) => void;
  visibile: boolean;
  onToggle: () => void;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  return (
    <div className="relative">
      <Input
        {...campo}
        type={visibile ? "text" : "password"}
        name="password"
        autoComplete="current-password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus
        className="pr-12"
      />
      <PulsanteIcona
        etichetta={visibile ? "Nascondi la password" : "Mostra la password"}
        aria-pressed={visibile}
        onClick={onToggle}
        className="absolute right-0.5 top-0.5"
      >
        {visibile ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </PulsanteIcona>
    </div>
  );
}
