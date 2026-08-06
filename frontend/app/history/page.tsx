import HistoryList from "@/app/components/HistoryList";

export const metadata = {
  title: "Historique - WhisperLocal",
};

export default function HistoryPage() {
  return (
    <main className="flex-1 flex flex-col overflow-y-auto p-margin relative bg-waveform">
      <header className="w-full max-w-container-max mx-auto mb-stack-lg flex items-end justify-between">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Historique</h2>
          <p className="text-on-surface-variant mt-1">Gérez vos transcriptions locales terminées et en cours.</p>
        </div>
      </header>

      <HistoryList />
    </main>
  );
}
