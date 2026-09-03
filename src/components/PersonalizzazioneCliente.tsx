"use client";

import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import { isHexValido } from "@/lib/colore";
import { FONT_CLIENTE_DISPONIBILI } from "@/lib/temaCliente";

const LABEL_FONT: Record<(typeof FONT_CLIENTE_DISPONIBILI)[number], string> = {
  poppins: "Poppins",
};

type Props = {
  logoUrl: string;
  onLogoUrlChange: (v: string) => void;
  colorePrimario: string;
  onColorePrimarioChange: (v: string) => void;
  coloreSecondario: string;
  onColoreSecondarioChange: (v: string) => void;
  fontPersonalizzato: string;
  onFontPersonalizzatoChange: (v: string) => void;
};

/**
 * I 4 campi di personalizzazione visiva del cliente (logo, 2 colori, font) — stesso set usato sia
 * in NuovoClienteForm.tsx sia in ModificaClienteModal.tsx, estratto qui per non duplicarlo.
 * Nessun campo è obbligatorio: vuoto = brand ALC standard su quel cliente (vedi temaCliente.ts).
 */
export function PersonalizzazioneCliente({
  logoUrl,
  onLogoUrlChange,
  colorePrimario,
  onColorePrimarioChange,
  coloreSecondario,
  onColoreSecondarioChange,
  fontPersonalizzato,
  onFontPersonalizzatoChange,
}: Props) {
  return (
    <div className="space-y-3">
      <Field label="URL logo (opzionale)" hint="Sostituisce il nome testuale del cliente nell'header, dove possibile">
        <Input type="url" value={logoUrl} onChange={(e) => onLogoUrlChange(e.target.value)} placeholder="https://…/logo.png" />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Colore primario (opzionale)" hint={colorePrimario && !isHexValido(colorePrimario) ? "Formato atteso #RRGGBB" : undefined}>
          <div className="flex items-center gap-2">
            <Input
              value={colorePrimario}
              onChange={(e) => onColorePrimarioChange(e.target.value)}
              placeholder="#RRGGBB"
              className="font-mono"
            />
            <span
              className="w-8 h-8 rounded-lg border border-ink-300 flex-shrink-0"
              style={{ background: isHexValido(colorePrimario) ? colorePrimario : "transparent" }}
              aria-hidden="true"
            />
          </div>
        </Field>
        <Field label="Colore secondario (opzionale)" hint={coloreSecondario && !isHexValido(coloreSecondario) ? "Formato atteso #RRGGBB" : undefined}>
          <div className="flex items-center gap-2">
            <Input
              value={coloreSecondario}
              onChange={(e) => onColoreSecondarioChange(e.target.value)}
              placeholder="#RRGGBB"
              className="font-mono"
            />
            <span
              className="w-8 h-8 rounded-lg border border-ink-300 flex-shrink-0"
              style={{ background: isHexValido(coloreSecondario) ? coloreSecondario : "transparent" }}
              aria-hidden="true"
            />
          </div>
        </Field>
      </div>

      <Field label="Font (opzionale)">
        <Select value={fontPersonalizzato} onChange={(e) => onFontPersonalizzatoChange(e.target.value)}>
          <option value="">Default (League Spartan / Roboto)</option>
          {FONT_CLIENTE_DISPONIBILI.map((f) => (
            <option key={f} value={f}>
              {LABEL_FONT[f]}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
