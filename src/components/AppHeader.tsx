import Image from "next/image";

export function AppHeader({ subtitle }: { subtitle?: string }) {
  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
        <Image
          src="/lenzi.webp"
          alt="Andrea Lenzi Consulting"
          width={120}
          height={40}
          priority
          className="object-contain h-8 w-auto"
        />
        <div className="hidden sm:block w-px h-7 bg-gray-200" />
        <div className="hidden sm:block min-w-0">
          <h1 className="text-sm font-semibold text-gray-900 leading-tight truncate">Meta Manager ALC</h1>
          <p className="text-[11px] text-gray-400 leading-tight truncate">
            {subtitle || "Dashboard KPI automatizzata da Meta Ads"}
          </p>
        </div>
      </div>
    </header>
  );
}
