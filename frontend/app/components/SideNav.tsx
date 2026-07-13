"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Transcribe", icon: "mic" },
  { href: "/history", label: "History", icon: "history" },
];

/** Navigation latérale partagée entre les 3 écrans (Upload/Job/Historique).
 * Composant non listé explicitement dans docs/architecture.md mais requis
 * pour éviter la duplication du chrome présent sur toutes les maquettes. */
export default function SideNav() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col h-screen p-stack-md bg-surface border-r border-outline-variant w-64 shrink-0 relative">
      <div className="flex items-center gap-3 px-3 py-4 mb-stack-md">
        <div className="w-8 h-8 rounded bg-primary-container flex items-center justify-center text-on-primary-container">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            graphic_eq
          </span>
        </div>
        <div>
          <h1 className="font-headline-sm text-headline-sm font-bold text-primary tracking-tight">WhisperLocal</h1>
          <p className="font-label-sm text-label-sm text-on-surface-variant">Local Transcription</p>
        </div>
      </div>

      <Link
        href="/"
        className="w-full bg-primary-container text-on-primary-container py-3 px-4 rounded-lg font-label-md text-label-md font-medium mb-stack-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
      >
        <span className="material-symbols-outlined">add</span>
        New Transcription
      </Link>

      <nav className="flex-1 space-y-2">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-label-md text-label-md ${
                isActive
                  ? "bg-secondary-container text-on-secondary-container scale-95"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              <span className="material-symbols-outlined" style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-2 pt-4 border-t border-surface-elevated">
        <span className="flex items-center gap-3 px-4 py-3 text-on-surface-variant/50 rounded-xl font-label-md text-label-md cursor-not-allowed">
          <span className="material-symbols-outlined">settings</span>
          Settings
        </span>
      </div>
    </aside>
  );
}
