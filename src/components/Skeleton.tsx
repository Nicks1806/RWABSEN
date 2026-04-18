/**
 * Reusable skeleton primitives for loading states.
 * Keep lightweight — uses Tailwind `animate-pulse` only.
 */
type DivProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className = "", ...rest }: DivProps) {
  return (
    <div
      className={`animate-pulse bg-gradient-to-r from-gray-200/70 via-gray-100 to-gray-200/70 rounded-md ${className}`}
      {...rest}
    />
  );
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3"
          style={{ width: `${90 - i * 12}%` }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 p-4 shadow-sm ${className}`}>
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-2.5 w-1/2" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
}

/** Kanban-style column skeleton for /tasks loading state */
export function SkeletonBoard() {
  return (
    <div className="h-full overflow-hidden px-3 md:px-6 py-5 flex items-start gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="shrink-0 w-72 md:w-80 bg-white/90 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1 bg-gray-200" />
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-6 rounded-full" />
          </div>
          <div className="p-3 space-y-2">
            {Array.from({ length: 2 + (i % 2) }).map((_, j) => (
              <div key={j} className="bg-white rounded-xl border border-gray-100 p-3 space-y-2">
                <Skeleton className="h-1 w-10 rounded-full" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-12 rounded-full" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Dashboard stat card skeleton */
export function SkeletonStatCard({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 p-4 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="w-8 h-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-24 mb-1" />
      <Skeleton className="h-2.5 w-16" />
    </div>
  );
}

/** Row in a list (used for employees, leaves, etc.) */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100">
      <Skeleton className="w-11 h-11 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-6 w-14 rounded-full" />
    </div>
  );
}
