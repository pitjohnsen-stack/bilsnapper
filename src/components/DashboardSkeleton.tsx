export default function DashboardSkeleton({ isDarkMode }: { isDarkMode: boolean }) {
  const card = isDarkMode ? 'rounded-2xl bg-slate-800/50 p-6' : 'rounded-2xl bg-white p-6 shadow-sm';
  const pulse = 'animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700';
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className={`h-8 w-48 ${pulse}`} />
          <div className={`h-4 w-64 ${pulse}`} />
        </div>
        <div className="flex gap-2">
          <div className={`h-10 w-32 ${pulse}`} />
          <div className={`h-10 w-24 ${pulse}`} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className={card}>
            <div className={`mb-4 h-4 w-24 ${pulse}`} />
            <div className={`h-10 w-20 ${pulse}`} />
            <div className={`mt-3 h-3 w-32 ${pulse}`} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`h-64 ${card}`}>
            <div className={`h-full w-full ${pulse}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
