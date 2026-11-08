export default function AdminDashboardLoading() {
  return (
    <section aria-label="Loading Admin page" className="space-y-5">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-slate-100" />
      <div className="h-4 w-96 max-w-full animate-pulse rounded bg-slate-100" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            className="h-24 animate-pulse rounded-2xl bg-slate-100"
            key={index}
          />
        ))}
      </div>
      <div className="space-y-3 rounded-2xl border border-line bg-white p-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            className="h-14 animate-pulse rounded-lg bg-slate-100"
            key={index}
          />
        ))}
      </div>
    </section>
  );
}
