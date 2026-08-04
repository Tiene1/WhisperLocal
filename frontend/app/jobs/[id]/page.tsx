import JobStatusPoller from "@/app/components/JobStatusPoller";

export const metadata = {
  title: "Job - Speech To Text Local",
};

interface JobPageProps {
  params: Promise<{ id: string }>;
}

export default async function JobPage({ params }: JobPageProps) {
  const { id } = await params;

  return (
    <main className="flex-1 flex flex-col items-center justify-center relative p-margin">
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(#dae2fd 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <JobStatusPoller jobId={id} />
    </main>
  );
}
