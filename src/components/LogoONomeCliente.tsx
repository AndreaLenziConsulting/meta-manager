/**
 * Header identità cliente: se il cliente ha un logo (vedi Cliente.logoUrl in temaCliente.ts)
 * lo mostra al posto del nome testuale, altrimenti resta il solo nome — stesso comportamento di
 * sempre per ogni cliente senza personalizzazione. Un <img> normale, non next/image: l'url arriva
 * da dati per qualunque cliente futuro, whitelistare un hostname per volta in next.config.ts non
 * scalerebbe (vedi commento sul campo logoUrl in types/kpi.ts).
 *
 * Il nome resta sempre presente come testo alternativo/accessibile (alt sull'immagine) anche
 * quando il logo la sostituisce visivamente — mai perdere l'informazione per chi usa uno screen
 * reader o se l'immagine non carica.
 */
export function LogoONomeCliente({ nome, logoUrl, className }: { nome: string; logoUrl?: string; className?: string }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- url esterno arbitrario da dati, vedi commento sopra
    return <img src={logoUrl} alt={nome} className={className ?? "h-10 w-auto object-contain"} />;
  }
  return <span className={className}>{nome}</span>;
}
