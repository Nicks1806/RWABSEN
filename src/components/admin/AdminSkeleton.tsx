"use client";

function SkelBar({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-md ${className}`}
      style={{ background: "var(--surface-300)", ...style }}
    />
  );
}

export default function AdminSkeleton() {
  return (
    <div className="min-h-screen" style={{ background: "var(--surface-100)" }}>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-2">
            <SkelBar className="h-6 w-48" />
            <SkelBar className="h-3 w-32" />
          </div>
          <SkelBar className="h-9 w-24" style={{ borderRadius: "var(--radius-md)" } as React.CSSProperties} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rw-card">
              <SkelBar className="h-3 w-20 mb-3" />
              <SkelBar className="h-8 w-24 mb-1" />
              <SkelBar className="h-2.5 w-16" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rw-card space-y-3">
            <SkelBar className="h-4 w-32" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <SkelBar className="w-10 h-10 rounded-full" />
                <SkelBar className="h-3 flex-1" />
                <SkelBar className="h-5 w-14 rounded-full" />
              </div>
            ))}
          </div>
          <div className="rw-card">
            <SkelBar className="h-4 w-40 mb-3" />
            <SkelBar className="h-48 w-full" style={{ borderRadius: "var(--radius-md)" } as React.CSSProperties} />
          </div>
        </div>
      </div>
    </div>
  );
}
