"use client";

import { useEffect, useRef } from "react";

/**
 * Textarea che si auto-espande in altezza col contenuto, statica (paragrafo) o editabile a
 * seconda di `editable` — estratta da MeetingReportView.tsx, dove era l'unico consumer.
 */
export function EditableTextarea({
  value,
  onChange,
  editable,
  className,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  editable: boolean;
  className?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }, [value]);

  if (!editable) {
    if (!value) return null;
    return <p className={`${className ?? ""} whitespace-pre-wrap`}>{value}</p>;
  }
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${className ?? ""} w-full resize-none rounded-md border border-transparent hover:border-gray-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 px-2 -mx-2 py-1 outline-none transition-colors`}
      rows={1}
    />
  );
}
