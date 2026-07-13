import type { JobLanguage } from "@/app/types/job";

interface LanguageSelectorProps {
  value: JobLanguage;
  onChange: (value: JobLanguage) => void;
  disabled?: boolean;
}

const LANGUAGE_OPTIONS: { value: JobLanguage; label: string }[] = [
  { value: "auto", label: "Détection Automatique" },
  { value: "fr", label: "Français" },
  { value: "en", label: "Anglais" },
  { value: "es", label: "Espagnol" },
];

/** Sélecteur de langue audio (auto/fr/en/es). */
export default function LanguageSelector({ value, onChange, disabled }: LanguageSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="language-selector" className="font-label-sm text-label-sm text-on-surface-variant">
        Langue de l&apos;audio
      </label>
      <select
        id="language-selector"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as JobLanguage)}
        className="bg-bg-base border border-surface-elevated text-on-surface font-body-sm text-body-sm rounded-lg p-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none disabled:opacity-50"
      >
        {LANGUAGE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
