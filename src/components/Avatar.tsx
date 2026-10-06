interface AvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  style?: React.CSSProperties;
}

const sizeMap = {
  xs: { wh: 24, fs: 10 },
  sm: { wh: 32, fs: 12 },
  md: { wh: 40, fs: 14 },
  lg: { wh: 56, fs: 16 },
};

const colors = [
  "var(--wine)",
  "var(--sand)",
  "var(--gold)",
  "var(--success)",
  "var(--warning)",
  "var(--danger)",
  "#7c5e3c",
  "#8b6b4a",
  "#a0522d",
  "var(--wine-deep)",
];

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export default function Avatar({ name, photoUrl, size = "md", className = "", style }: AvatarProps) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const bg = colors[hashCode(name) % colors.length];
  const s = sizeMap[size];

  const base: React.CSSProperties = {
    width: s.wh,
    height: s.wh,
    borderRadius: "var(--radius-full)",
    flexShrink: 0,
    boxShadow: "0 0 0 2px #fff, var(--shadow-sm)",
    overflow: "hidden",
  };

  if (photoUrl) {
    return (
      <div className={className} style={{ ...base, ...style }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" decoding="async" />
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        ...base,
        ...style,
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 700,
        fontSize: s.fs,
      }}
    >
      {initial}
    </div>
  );
}
