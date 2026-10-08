"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { chiama, type PersonaSquadra } from "@/components/impostazioni/tipi";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfermaEliminazioneModal } from "@/components/ui/ConfermaEliminazioneModal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { CLASSE_TITOLO_SEZIONE } from "@/components/ui/Intestazione";
import { Modal } from "@/components/ui/Modal";
import { Nota } from "@/components/ui/Nota";
import { erroreAnagraficaPersona, errorePasswordNuova, LUNGHEZZA_MINIMA_PASSWORD } from "@/lib/impostazioni";
import type { RuoloSquadra } from "@/types/kpi";

const RUOLI: Record<RuoloSquadra, { titolo: string; singolare: string; descrizione: string; assegnati: (n: number) => string; vuoto: string }> = {
  consulente: {
    titolo: "Consulenti",
    singolare: "consulente",
    descrizione: "Seguono i clienti. Ognuno entra con la propria password e vede solo i clienti che gli sono assegnati.",
    assegnati: (n) => (n === 1 ? "1 cliente" : `${n} clienti`),
    vuoto: "Nessun consulente. I clienti si assegnano a un consulente: aggiungine uno per cominciare.",
  },
  commerciale: {
    titolo: "Commerciali",
    singolare: "commerciale",
    descrizione: "Seguono i prospect e i report delle chiamate di vendita. Vedono solo i propri.",
    assegnati: (n) => (n === 1 ? "1 prospect" : `${n} prospect`),
    vuoto: "Nessun commerciale.",
  },
};

// Senza i caratteri che si confondono leggendoli o dettandoli (0/O, 1/l/I).
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Una password casuale in quattro gruppi da quattro ("kV7m-Rp2x-9TqA-hN4c"): lunga, ma si detta al telefono. */
function generaPassword(): string {
  const limite = Math.floor(0x100000000 / ALFABETO.length) * ALFABETO.length;
  const caratteri: string[] = [];
  const casuale = new Uint32Array(1);
  while (caratteri.length < 16) {
    crypto.getRandomValues(casuale);
    // Si scartano i valori oltre l'ultimo multiplo: altrimenti le prime lettere uscirebbero un po' più spesso.
    if (casuale[0] < limite) caratteri.push(ALFABETO[casuale[0] % ALFABETO.length]);
  }
  return [0, 4, 8, 12].map((i) => caratteri.slice(i, i + 4).join("")).join("-");
}

type Aperta = { tipo: "nuova"; ruolo: RuoloSquadra } | { tipo: "modifica"; ruolo: RuoloSquadra; id: string };

/**
 * Sezione "Squadra" delle Impostazioni: consulenti e commerciali, con ciò che serve per farli
 * entrare (password, attivo o no). Le password non si leggono mai: si impostano, e in quel momento
 * la finestra le mostra una volta perché l'amministratore le possa comunicare.
 */
export function SquadraImpostazioni({ squadra }: { squadra: PersonaSquadra[] }) {
  const [aperta, setAperta] = useState<Aperta | null>(null);
  const persona = aperta?.tipo === "modifica" ? squadra.find((p) => p.ruolo === aperta.ruolo && p.id === aperta.id) : undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      {(["consulente", "commerciale"] as const).map((ruolo) => {
        const info = RUOLI[ruolo];
        const persone = squadra.filter((p) => p.ruolo === ruolo);
        return (
          <Card key={ruolo} padding="lg" className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <h2 className={CLASSE_TITOLO_SEZIONE}>{info.titolo}</h2>
                <p className="text-sm text-ink-500">{info.descrizione}</p>
              </div>
              <Button variant="crea" size="sm" onClick={() => setAperta({ tipo: "nuova", ruolo })}>
                + Aggiungi {info.singolare}
              </Button>
            </div>
            {persone.length === 0 ? (
              <p className="text-sm text-ink-500">{info.vuoto}</p>
            ) : (
              <ul className="divide-y divide-linea border-t border-linea">
                {persone.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                    <div className="min-w-0 flex-1 basis-40">
                      <p className={`truncate text-sm font-bold ${p.attivo ? "text-ink-900" : "text-ink-500"}`}>{p.nome}</p>
                      <p className="truncate text-xs text-ink-500">{p.email || "Nessuna email"}</p>
                    </div>
                    <span className="text-xs text-ink-500 tabular-nums">{info.assegnati(p.assegnati)}</span>
                    {!p.haPassword && <Badge tono="attenzione">senza password</Badge>}
                    <Badge tono={p.attivo ? "successo" : "neutro"}>{p.attivo ? "attivo" : "non attivo"}</Badge>
                    <Button variant="secondary" size="sm" onClick={() => setAperta({ tipo: "modifica", ruolo, id: p.id })} aria-label={`Modifica ${p.nome}`}>
                      Modifica
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}

      {aperta?.tipo === "nuova" && <NuovaPersonaModal key={aperta.ruolo} ruolo={aperta.ruolo} onClose={() => setAperta(null)} />}
      {aperta?.tipo === "modifica" && persona && <ModificaPersonaModal key={`${persona.ruolo}/${persona.id}`} persona={persona} onClose={() => setAperta(null)} />}
    </div>
  );
}

/** Campo password in chiaro (chi la imposta la deve poter leggere e comunicare) con il pulsante che ne genera una. */
function CampoPassword({ valore, onChange, errore }: { valore: string; onChange: (v: string) => void; errore?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-end gap-2">
        <Field label="Password" error={errore} className="min-w-0 flex-1">
          <Input type="text" value={valore} onChange={(e) => onChange(e.target.value)} autoComplete="off" spellCheck={false} className="font-mono" />
        </Field>
        <Button variant="secondary" onClick={() => onChange(generaPassword())} className={errore ? "mb-5" : undefined}>
          Genera
        </Button>
      </div>
      <p className="text-xs text-ink-500">Almeno {LUNGHEZZA_MINIMA_PASSWORD} caratteri. Per entrare serve solo questa: non c&apos;è un nome utente.</p>
    </div>
  );
}

/** Dopo aver impostato una password: l'unica occasione per leggerla. */
function ConsegnaPassword({ nome, password, premessa, onClose }: { nome: string; password: string; premessa?: string; onClose: () => void }) {
  const [copiata, setCopiata] = useState(false);

  async function copia() {
    try {
      await navigator.clipboard.writeText(password);
      setCopiata(true);
    } catch {
      // Appunti non disponibili (permesso negato): la password resta leggibile qui sopra.
    }
  }

  return (
    <div className="space-y-4">
      <Nota tono="ok" etichetta="Password impostata" role="status">
        <p>
          {premessa ? `${premessa} ` : ""}Comunica la password a {nome}: chiusa questa finestra non si potrà più rileggere, solo sostituire con una nuova.
        </p>
      </Nota>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-lg border border-linea bg-surface px-3 py-2.5 font-mono text-sm text-ink-900">{password}</code>
        <Button variant="secondary" onClick={copia}>
          {copiata ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          {copiata ? "Copiata" : "Copia"}
        </Button>
      </div>
      <div className="flex justify-end border-t border-linea pt-4">
        <Button onClick={onClose}>Fatto</Button>
      </div>
    </div>
  );
}

function NuovaPersonaModal({ ruolo, onClose }: { ruolo: RuoloSquadra; onClose: () => void }) {
  const router = useRouter();
  const info = RUOLI[ruolo];
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [creata, setCreata] = useState(false);

  async function salva(e: FormEvent) {
    e.preventDefault();
    const problema = erroreAnagraficaPersona({ nome, email }) ?? errorePasswordNuova(password);
    if (problema) {
      setErrore(problema);
      return;
    }
    setSalvando(true);
    setErrore(null);
    try {
      await chiama("/api/impostazioni/squadra", "POST", { ruolo, nome, email, password });
      setCreata(true);
      router.refresh();
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSalvando(false);
    }
  }

  if (creata) {
    return (
      <Modal title={nome.trim()} onClose={onClose}>
        <ConsegnaPassword nome={nome.trim()} password={password} premessa={`${nome.trim()} ora fa parte della squadra.`} onClose={onClose} />
      </Modal>
    );
  }

  return (
    <Modal title={`Nuovo ${info.singolare}`} onClose={onClose}>
      <form onSubmit={salva} noValidate className="space-y-4">
        <Field label="Nome e cognome">
          <Input
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
              setErrore(null);
            }}
            autoFocus
            autoComplete="off"
          />
        </Field>
        <Field label="Email" hint="Da questa casella partono le email automatiche, e con questa si condividono le cartelle Drive.">
          <Input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrore(null);
            }}
            autoComplete="off"
          />
        </Field>
        <CampoPassword
          valore={password}
          onChange={(v) => {
            setPassword(v);
            setErrore(null);
          }}
        />
        {errore && (
          <p role="alert" className="text-sm font-semibold text-critico">
            {errore}
          </p>
        )}
        <div className="flex flex-wrap gap-2 border-t border-linea pt-4">
          <Button type="submit" variant="crea" disabled={salvando}>
            {salvando ? "Salvataggio…" : `Aggiungi ${info.singolare}`}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={salvando}>
            Annulla
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ModificaPersonaModal({ persona, onClose }: { persona: PersonaSquadra; onClose: () => void }) {
  const router = useRouter();
  const info = RUOLI[persona.ruolo];
  const [nome, setNome] = useState(persona.nome);
  const [email, setEmail] = useState(persona.email);
  const [occupato, setOccupato] = useState<"dati" | "accesso" | "password" | null>(null);
  const [errore, setErrore] = useState<{ dove: "dati" | "accesso" | "password"; testo: string } | null>(null);
  const [datiSalvati, setDatiSalvati] = useState(false);
  const [passwordAperta, setPasswordAperta] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordImpostata, setPasswordImpostata] = useState<string | null>(null);
  const [confermaEliminazione, setConfermaEliminazione] = useState(false);

  const riferimento = { ruolo: persona.ruolo, id: persona.id };
  const datiCambiati = nome.trim() !== persona.nome || email.trim() !== persona.email;

  async function esegui(dove: "dati" | "accesso" | "password", corpo: Record<string, unknown>): Promise<boolean> {
    setOccupato(dove);
    setErrore(null);
    try {
      await chiama("/api/impostazioni/squadra", "PATCH", { ...riferimento, ...corpo });
      router.refresh();
      return true;
    } catch (err) {
      setErrore({ dove, testo: err instanceof Error ? err.message : "Errore sconosciuto" });
      return false;
    } finally {
      setOccupato(null);
    }
  }

  async function salvaDati(e: FormEvent) {
    e.preventDefault();
    setDatiSalvati(false);
    const problema = erroreAnagraficaPersona({ nome, email });
    if (problema) {
      setErrore({ dove: "dati", testo: problema });
      return;
    }
    if (await esegui("dati", { nome, email })) setDatiSalvati(true);
  }

  async function impostaPassword() {
    const problema = errorePasswordNuova(password);
    if (problema) {
      setErrore({ dove: "password", testo: problema });
      return;
    }
    if (await esegui("password", { password })) setPasswordImpostata(password);
  }

  async function elimina() {
    await chiama(`/api/impostazioni/squadra?ruolo=${persona.ruolo}&id=${encodeURIComponent(persona.id)}`, "DELETE");
    router.refresh();
    onClose();
  }

  if (passwordImpostata) {
    return (
      <Modal title={persona.nome} onClose={onClose}>
        <ConsegnaPassword nome={persona.nome} password={passwordImpostata} onClose={onClose} />
      </Modal>
    );
  }

  if (confermaEliminazione) {
    return (
      <ConfermaEliminazioneModal
        titolo={`Eliminare ${persona.nome}?`}
        messaggio={
          <p>
            {persona.nome} viene tolto dalla squadra e non potrà più entrare. Si può eliminare solo chi non ha{" "}
            {persona.ruolo === "consulente" ? "clienti" : "prospect"} assegnati: altrimenti disattivalo.
          </p>
        }
        labelConferma={`Elimina ${info.singolare}`}
        onConferma={elimina}
        onClose={() => setConfermaEliminazione(false)}
      />
    );
  }

  return (
    <Modal title={persona.nome} onClose={onClose}>
      <form onSubmit={salvaDati} noValidate className="space-y-4">
        <Field label="Nome e cognome">
          <Input
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
              setDatiSalvati(false);
            }}
            autoComplete="off"
          />
        </Field>
        <Field label="Email" hint="Da questa casella partono le email automatiche, e con questa si condividono le cartelle Drive.">
          <Input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setDatiSalvati(false);
            }}
            autoComplete="off"
          />
        </Field>
        {errore?.dove === "dati" && (
          <p role="alert" className="text-sm font-semibold text-critico">
            {errore.testo}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!datiCambiati || occupato !== null}>
            {occupato === "dati" ? "Salvataggio…" : "Salva"}
          </Button>
          {datiSalvati && !datiCambiati && (
            <span role="status" className="text-sm font-semibold text-ok">
              Salvato
            </span>
          )}
        </div>
      </form>

      <section className="space-y-3 border-t border-linea pt-4">
        <h4 className="text-sm font-bold text-ink-900">Accesso</h4>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 flex-1 basis-56 text-sm text-ink-700">
            {persona.attivo
              ? "Può entrare nell'app. Disattivandolo non entra più, e se aveva già fatto l'accesso viene scollegato entro mezzo minuto; ciò che gli è assegnato resta suo."
              : "Non può entrare nell'app. Ciò che gli era assegnato è rimasto suo."}
          </p>
          <Button variant="secondary" onClick={() => esegui("accesso", { attivo: !persona.attivo })} disabled={occupato !== null}>
            {occupato === "accesso" ? "Salvataggio…" : persona.attivo ? "Disattiva" : "Riattiva"}
          </Button>
        </div>
        {errore?.dove === "accesso" && (
          <p role="alert" className="text-sm font-semibold text-critico">
            {errore.testo}
          </p>
        )}

        {passwordAperta ? (
          <div className="space-y-3 rounded-lg border border-linea bg-surface p-3">
            <CampoPassword
              valore={password}
              onChange={(v) => {
                setPassword(v);
                setErrore(null);
              }}
              errore={errore?.dove === "password" ? errore.testo : undefined}
            />
            <p className="text-xs text-ink-500">La password di prima smette di valere. Chi ha già fatto l&apos;accesso resta collegato: per toglierglielo subito usa Disattiva.</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={impostaPassword} disabled={occupato !== null}>
                {occupato === "password" ? "Salvataggio…" : "Imposta password"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setPasswordAperta(false);
                  setPassword("");
                  setErrore(null);
                }}
                disabled={occupato !== null}
              >
                Annulla
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 flex-1 basis-56 text-sm text-ink-700">
              {persona.haPassword
                ? "Ha una password. Non si può rileggere: se l'ha dimenticata, impostane una nuova."
                : "Non ha una password: finché non gliene imposti una non può entrare."}
            </p>
            <Button variant="secondary" onClick={() => setPasswordAperta(true)} disabled={occupato !== null}>
              Imposta nuova password
            </Button>
          </div>
        )}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 border-t border-linea pt-4">
        <p className="min-w-0 flex-1 basis-56 text-sm text-ink-500">Per chi è stato aggiunto per errore. Chi ha lavorato su clienti o prospect si disattiva, non si elimina.</p>
        <Button variant="danger" onClick={() => setConfermaEliminazione(true)} disabled={occupato !== null}>
          Elimina {info.singolare}
        </Button>
      </section>
    </Modal>
  );
}
