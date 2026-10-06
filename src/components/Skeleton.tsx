type DivProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className = "", style, ...rest }: DivProps) {
  return (
    <div
      className={`animate-pulse ${className}`}
      style={{
        background: "linear-gradient(90deg, var(--surface-200) 0%, var(--surface-100) 50%, var(--surface-200) 100%)",
        borderRadius: "var(--radius-md)",
        ...style,
      }}
      {...rest}
    />
  );
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          style={{ height: 12, width: `${90 - i * 12}%` }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`rw-card ${className}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <Skeleton style={{ width: 40, height: 40, borderRadius: "var(--radius-full)" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton style={{ height: 12, width: "75%" }} />
          <Skeleton style={{ height: 10, width: "50%" }} />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
}

export function SkeletonBoard() {
  return (
    <div style={{ height: "100%", overflow: "hidden", padding: "20px 12px", display: "flex", alignItems: "flex-start", gap: 16 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          style={{
            flexShrink: 0,
            width: 288,
            background: "var(--surface-100)",
            borderRadius: "var(--radius-xl)",
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow-sm)",
            overflow: "hidden",
          }}
        >
          <div style={{ height: 4, background: "var(--surface-300)" }} />
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
            <Skeleton style={{ height: 16, width: 80 }} />
            <Skeleton style={{ height: 16, width: 24, borderRadius: "var(--radius-full)" }} />
          </div>
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {Array.from({ length: 2 + (i % 2) }).map((_, j) => (
              <div
                key={j}
                style={{
                  background: "var(--surface-200)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--line)",
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <Skeleton style={{ height: 4, width: 40, borderRadius: "var(--radius-full)" }} />
                <Skeleton style={{ height: 14, width: "100%" }} />
                <Skeleton style={{ height: 12, width: "66%" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Skeleton style={{ height: 20, width: 48, borderRadius: "var(--radius-full)" }} />
                  <Skeleton style={{ height: 20, width: 56, borderRadius: "var(--radius-full)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonStatCard({ className = "" }: { className?: string }) {
  return (
    <div className={`rw-card ${className}`}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Skeleton style={{ height: 12, width: 80 }} />
        <Skeleton style={{ width: 32, height: 32, borderRadius: "var(--radius-md)" }} />
      </div>
      <Skeleton style={{ height: 32, width: 96, marginBottom: 4 }} />
      <Skeleton style={{ height: 10, width: 64 }} />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="rw-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: 12 }}>
      <Skeleton style={{ width: 44, height: 44, borderRadius: "var(--radius-full)" }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <Skeleton style={{ height: 14, width: "33%" }} />
        <Skeleton style={{ height: 12, width: "50%" }} />
      </div>
      <Skeleton style={{ height: 24, width: 56, borderRadius: "var(--radius-full)" }} />
    </div>
  );
}
