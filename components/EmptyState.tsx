export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center sm:py-16">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10.125 11.25h3.75M4.875 7.5h14.25a1.125 1.125 0 001.125-1.125V5.625a1.125 1.125 0 00-1.125-1.125H4.875a1.125 1.125 0 00-1.125 1.125v.75A1.125 1.125 0 004.875 7.5z"
          />
        </svg>
      </div>
      <p className="font-medium text-slate-900">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm leading-relaxed text-slate-500">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
