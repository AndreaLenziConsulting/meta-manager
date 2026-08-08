export function PlaceholderTab({ titolo, descrizione }: { titolo: string; descrizione: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-8 sm:p-12 flex items-center justify-center min-h-[240px]">
      <div className="text-center max-w-xs">
        <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4 bg-brand-light">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="16" y1="2" x2="16" y2="6" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-gray-900">{titolo}</h3>
        <p className="text-sm text-gray-500 mt-1.5">{descrizione}</p>
      </div>
    </div>
  );
}
