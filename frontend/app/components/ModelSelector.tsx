import type { ModelSize } from "@/app/types/job";

interface ModelSelectorProps {
  value: ModelSize;
  onChange: (value: ModelSize) => void;
  disabled?: boolean;
}

const MODEL_OPTIONS: { value: ModelSize; label: string }[] = [
  { value: "large", label: "Large (Meilleure précision)" },
  { value: "medium", label: "Medium (Équilibré)" },
  { value: "small", label: "Small (Rapide)" },
  { value: "base", label: "Base (Très rapide)" },
];

/** Sélecteur du modèle Whisper (base/small/medium/large — medium par défaut côté backend). */
export default function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="model-selector" className="font-label-sm text-label-sm text-on-surface-variant">
        Taille du Modèle
      </label>
      <select
        id="model-selector"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as ModelSize)}
        className="bg-bg-base border border-surface-elevated text-on-surface font-body-sm text-body-sm rounded-lg p-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none disabled:opacity-50"
      >
        {MODEL_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
