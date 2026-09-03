import { AlertCircle, CheckCircle2 } from "lucide-react";

/**
 * Contenuto della guida "Come collegare Go High Level" — vedi src/lib/guide.ts. Passi verificati
 * contro ciò che il codice richiede davvero (GhlConnessioneBlock in ModificaClienteModal.tsx,
 * endpoint GHL usati in src/lib/ghl.ts: /calendars, /calendars/events, /opportunities/search —
 * tutti in sola lettura, mai una scrittura verso GHL), non solo dalla documentazione pubblica GHL.
 *
 * Attenzione scrivendo qui: un tag inline chiuso (es. </strong>) seguito da testo che continua su
 * più righe nel codice perde lo spazio subito dopo il tag — JSX trimma il whitespace iniziale di
 * ogni "blocco" di testo quando quel blocco si estende su più righe, non solo agli a-capo veri.
 * Va sempre isolato con un {" "} esplicito subito dopo il tag in quel caso (mai un problema quando
 * tag+testo restano sulla stessa riga fisica, o quando il testo lungo non segue direttamente un tag).
 */
export function GuidaCollegareGhl() {
  return (
    <div className="space-y-7 text-sm text-ink-700 leading-relaxed">
      <section className="space-y-2">
        <p>
          Collegare Go High Level (GHL/Squadd) a una sede permette al tab <strong>KPI</strong>{" "}
          di leggere in diretta appuntamenti fissati/effettuati e vendite direttamente dal calendario e dalla
          pipeline del cliente su GHL, invece di doverli inserire a mano ogni mese nel foglio Funnel.
        </p>
        <p className="text-ink-500">
          Il collegamento è <strong>di sola lettura</strong>: l&apos;app legge calendari, eventi e opportunità, non
          scrive né modifica mai nulla dentro GHL.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="font-heading font-bold text-ink-900 text-base">1. Crea il token in GHL (Private Integration)</h3>
        <ol className="list-decimal list-inside space-y-2 marker:font-semibold marker:text-brand">
          <li>Entra nel sub-account GHL del cliente (non nell&apos;agenzia/agency view — deve essere la location specifica).</li>
          <li>
            Vai su <strong>Settings → Private Integrations</strong> (nel menù impostazioni della location).
          </li>
          <li>
            Clicca <strong>Create new integration</strong>, dai un nome riconoscibile (es. &ldquo;Meta Manager ALC&rdquo;).
          </li>
          <li>
            Seleziona questi permessi, tutti in <strong>sola lettura</strong>{" "}
            (&ldquo;View&rdquo;/&ldquo;read&rdquo;, mai &ldquo;write&rdquo;/&ldquo;edit&rdquo;):
            <ul className="list-disc list-inside mt-1.5 ml-2 space-y-0.5 text-ink-700">
              <li>Calendars</li>
              <li>Calendar Events / Appointments</li>
              <li>Opportunities</li>
            </ul>
          </li>
          <li>Salva e genera il token.</li>
        </ol>

        <div className="rounded-xl bg-yellow-50 border border-yellow-100 text-yellow-800 p-3 flex items-start gap-2 text-xs">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          <p>
            GHL mostra il token <strong>una sola volta</strong>, subito dopo averlo generato — copialo immediatamente.
            Se lo perdi, non c&apos;è modo di recuperarlo: bisogna generarne un altro e ripetere il collegamento
            nell&apos;app.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-heading font-bold text-ink-900 text-base">2. Trova il Location ID</h3>
        <p>
          È l&apos;identificativo della location (sub-account) su GHL — lo trovi in{" "}
          <strong>Settings → Business Profile</strong>{" "}
          di quella location, oppure nell&apos;URL del pannello GHL quando sei dentro quella location (il segmento
          dopo{" "}
          <code className="text-xs bg-surface px-1 py-0.5 rounded">/location/</code>).
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="font-heading font-bold text-ink-900 text-base">3. Collegalo nell&apos;app</h3>
        <ol className="list-decimal list-inside space-y-2 marker:font-semibold marker:text-brand">
          <li>
            Apri <strong>Clienti</strong> → il cliente → icona di modifica (matita), oppure dalla Dashboard Amministratore.
          </li>
          <li>
            Nella modale &ldquo;Modifica cliente&rdquo;, scorri fino alla sezione <strong>Sedi</strong>{" "}
            e trova la sede giusta (un cliente con più sedi ha una connessione GHL separata per ciascuna).
          </li>
          <li>
            Clicca <strong>+ Collega GHL</strong>, incolla <strong>Location ID</strong> e{" "}
            <strong>Private Integration Token</strong>, poi <strong>Collega</strong>.
          </li>
        </ol>
      </section>

      <section className="space-y-3">
        <h3 className="font-heading font-bold text-ink-900 text-base">4. Scegli i calendari da contare</h3>
        <p>
          Subito dopo il collegamento riuscito, l&apos;app mostra l&apos;elenco dei calendari trovati su quella
          location — spunta quelli che sono davvero pagine di prenotazione per i clienti (una location porta spesso
          anche calendari personali dei singoli commerciali, che non vanno contati come appuntamenti generati dal
          marketing). Preseleziona già i calendari non &ldquo;personal&rdquo;, ma va sempre controllato a mano prima
          di salvare.
        </p>
      </section>

      <div className="rounded-xl bg-green-50 border border-green-100 text-green-700 p-3 flex items-start gap-2 text-xs">
        <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
        <p>
          Fatto: da qui in avanti il tab KPI di quella sede mostra appuntamenti e vendite in diretta da GHL. Il token
          non viene più mostrato per intero nella modale (solo mascherato, es. &ldquo;••••3f9a&rdquo;) — per
          sostituirlo basta incollarne uno nuovo, il campo vuoto lascia quello attuale invariato.
        </p>
      </div>
    </div>
  );
}
