export function LoadingPage({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6">
      <div className="flex w-full max-w-sm flex-col gap-3">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-3/4" />
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div className="skeleton h-24 rounded-xl" />
          <div className="skeleton h-24 rounded-xl" />
        </div>
      </div>
      <p className="text-sm text-slate-500" role="status" aria-live="polite">
        {label}
      </p>
    </div>
  );
}
