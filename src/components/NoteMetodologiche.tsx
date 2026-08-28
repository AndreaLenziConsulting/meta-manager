import { Card } from "@/components/ui/Card";

/**
 * Blocco informativo statico per la tab "KPI (nuovo)" — documenta le regole di fallback GIA
 * ESISTENTI in ghl.ts/kpiGhlOverlay.ts (vedi i commenti su riepilogoAppuntamenti e
 * applicaOverlayGhl), non ne introduce di nuove. Il testo si adatta a ghlConnesso/calendariConfigurati
 * cosi da non menzionare regole che per questa sede non si applicano.
 */
export function NoteMetodologiche({ ghlConnesso, calendariConfigurati }: { ghlConnesso: boolean; calendariConfigurati: boolean }) {
  return (
    <Card padding="md" className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded-full bg-brand" />
        <h3 className="font-heading font-bold text-ink-900 text-[15px]">Come sono letti i dati</h3>
      </div>

      <ul className="space-y-2.5 text-[13px] text-ink-500 leading-relaxed list-disc pl-5">
        <li>
          Il Funnel (dati inseriti a mano) è mensile: quando compare in una vista settimanale, il valore del mese si ripete
          identico su ogni settimana di quel mese — non è un vero andamento settimana per settimana.
        </li>

        {ghlConnesso ? (
          <>
            <li>
              Questa sede è connessa a GHL: quando nessun filtro campagne è attivo, Fatturato, Vendite, ROAS e CPA vengono
              letti in diretta da GHL al posto del Funnel.
            </li>
            {calendariConfigurati ? (
              <li>
                Anche Appuntamenti fissati/effettuati vengono letti da GHL, perché i calendari sono configurati sulla
                connessione.
              </li>
            ) : (
              <li>
                Appuntamenti fissati/effettuati restano invece dal Funnel: i calendari GHL non sono ancora configurati su
                questa connessione (senza calendari configurati l&apos;API restituirebbe sempre 0, un dato non vero).
              </li>
            )}
            <li>
              &quot;Appuntamento effettuato&quot; è uno standard operativo, non un vero segnale di presenza in
              negozio/showroom: un appuntamento con orario già passato e mai annullato attivamente su GHL conta come
              effettuato. I commerciali devono annullare chi non si presenta, altrimenti resta conteggiato come avvenuto.
            </li>
          </>
        ) : (
          <li>
            Questa sede non è connessa a GHL: tutti i dati (Fatturato, Vendite, ROAS, CPA, Appuntamenti) provengono dal
            Funnel inserito a mano.
          </li>
        )}
      </ul>
    </Card>
  );
}
