interface AvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-base",
};

// Color palette - deterministic by name
const colors = [
  "bg-rose-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-indigo-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-orange-500",
  "bg-red-600",
];

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export default function Avatar({ name, photoUrl, size = "md", className = "" }: AvatarProps) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const colorClass = colors[hashCode(name) % colors.length];

  if (photoUrl) {
    return (
      <div
        className={`${sizeMap[size]} rounded-full overflow-hidden shrink-0 ring-2 ring-white shadow-sm ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl} alt={name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
      </div>
    );
  }

  return (
    <div
      className={`${sizeMap[size]} ${colorClass} rounded-full flex items-center justify-center text-white font-bold shrink-0 ring-2 ring-white shadow-sm ${className}`}
    >
      {initial}
    </div>
  );
}
