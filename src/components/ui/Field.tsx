import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

/**
 * Wrapper etichetta + campo + aiuto/errore. L'etichetta è collegata al campo (`htmlFor`/`id`) e
 * l'aiuto o l'errore con `aria-describedby`: cliccare l'etichetta porta il focus nel campo e uno
 * screen reader legge il nome e la spiegazione. Il campo va passato come unico figlio (Input/Select/
 * Textarea di questa cartella); con un figlio diverso (un gruppo di caselle, un componente su
 * misura) l'etichetta resta visiva, come prima.
 */
export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  const idGenerato = useId();
  const figlio = isValidElement(children) ? (children as ReactElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean }>) : null;
  // Un componente (Input/Select/Textarea), non un tag HTML: un <div> non può ricevere il focus dell'etichetta.
  const eCampo = figlio !== null && typeof figlio.type !== "string";
  const idCampo = eCampo ? (figlio.props.id ?? idGenerato) : undefined;
  const idAiuto = hint || error ? `${idGenerato}-aiuto` : undefined;
  return (
    <div className={className}>
      <label htmlFor={idCampo} className="text-xs font-semibold text-ink-700 mb-1 block">
        {label}
      </label>
      {eCampo && figlio ? cloneElement(figlio, { id: idCampo, "aria-describedby": idAiuto, "aria-invalid": error ? true : undefined }) : children}
      {hint && !error && (
        <p id={idAiuto} className="text-xs text-ink-500 mt-1">
          {hint}
        </p>
      )}
      {error && (
        <p id={idAiuto} role="alert" className="text-xs mt-1 text-critico">
          {error}
        </p>
      )}
    </div>
  );
}
