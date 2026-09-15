import { generaProspectId } from "@/lib/accessCode";
import { aggiornaProspect, creaProspect, getProspect } from "@/lib/sheets";
import { assicuraCartelleProspect } from "@/lib/drive";
import { condividiCartellaConConsulente, prospectDaCondividere } from "@/lib/driveAccesso";
import type { Commerciale } from "@/types/prospect";

export type CreaProspectInput = {
  ragioneSociale: string;
  nomeContatto?: string;
  tipoBusiness?: string;
  fatturato?: string;
  sedi?: string;
  email?: string;
  commercialeId: string;
};

/**
 * Crea un prospect end-to-end — id, riga Sheets, cartella Drive (con eventuale copia dei materiali
 * modello, vedi assicuraCartelleProspect in drive.ts) e condivisione della cartella con l'email del
 * commerciale assegnato: stessa identica sequenza sia che il prospect nasca dal form (POST
 * /api/prospect) sia dal webhook GHL (POST /api/ghl/webhook/prospect, 11/2026) — un solo punto di
 * manutenzione invece di due copie della stessa logica che rischiano di divergere. Best-effort su
 * Drive (mai bloccante, stesso principio dei due chiamanti originali): un prospect creato con
 * successo resta creato anche se Drive non è raggiungibile.
 */
export async function creaProspectConCartellaDrive(
  input: CreaProspectInput,
  commerciali: Pick<Commerciale, "commercialeId" | "email">[]
): Promise<string> {
  const esistenti = await getProspect();
  const prospectId = generaProspectId(input.ragioneSociale, new Set(esistenti.map((p) => p.prospectId)));

  await creaProspect({
    prospectId,
    ragioneSociale: input.ragioneSociale,
    tipoBusiness: input.tipoBusiness,
    fatturato: input.fatturato,
    sedi: input.sedi,
    email: input.email,
    commercialeId: input.commercialeId,
    creatoIl: new Date().toISOString(),
  });

  // Update mirato su una riga già esistente (mai in append, vedi il commento su creaProspect in
  // sheets.ts) — indipendente dal blocco Drive sotto: nomeContatto va impostato anche se Drive non
  // è raggiungibile.
  if (input.nomeContatto) {
    await aggiornaProspect({ prospectId, nomeContatto: input.nomeContatto }).catch((err) => {
      console.error("Impostazione nomeContatto alla creazione fallita (non bloccante):", err);
    });
  }

  try {
    const cartelle = await assicuraCartelleProspect(input.ragioneSociale);
    await aggiornaProspect({ prospectId, driveFolderUrl: cartelle.principaleUrl });

    const emailPerCommerciale = new Map(commerciali.map((c) => [c.commercialeId, c.email]));
    const decisione = prospectDaCondividere({ driveFolderUrl: cartelle.principaleUrl, commercialeId: input.commercialeId }, emailPerCommerciale);
    if (decisione) {
      await condividiCartellaConConsulente(cartelle.principaleUrl, decisione.emailCommerciale).catch(() => {});
    }
  } catch (err) {
    console.error("Creazione cartella Drive del prospect fallita (non bloccante):", err);
  }

  return prospectId;
}
