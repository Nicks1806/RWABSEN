interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showSubtitle?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { text: "text-xl", sub: "text-[8px]", lineW: "w-10", lineH: "h-[1px]", gap: "mt-0.5", subMt: "mt-0.5" },
  md: { text: "text-3xl", sub: "text-[10px]", lineW: "w-14", lineH: "h-[1.5px]", gap: "mt-1", subMt: "mt-1" },
  lg: { text: "text-5xl", sub: "text-xs", lineW: "w-20", lineH: "h-[2px]", gap: "mt-1.5", subMt: "mt-1.5" },
  xl: { text: "text-6xl", sub: "text-sm", lineW: "w-24", lineH: "h-[2px]", gap: "mt-2", subMt: "mt-2" },
};

export default function Logo({ size = "md", showSubtitle, className = "" }: LogoProps) {
  const s = sizeMap[size];
  // showSubtitle defaults: false for sm, true for others
  const withSub = showSubtitle !== undefined ? showSubtitle : size !== "sm";

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <div
        className={`${s.text} font-bold leading-none tracking-tight`}
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
      >
        <span className="text-primary italic">Red</span>
        <span className="text-gray-900">Wine</span>
      </div>
      {withSub && (
        <>
          <div className={`${s.lineW} ${s.lineH} bg-primary ${s.gap}`} />
          <div
            className={`${s.sub} text-primary tracking-[0.4em] font-semibold ${s.subMt}`}
            style={{ fontFamily: "Georgia, serif" }}
          >
            SHOES &amp; BAGS
          </div>
        </>
      )}
    </div>
  );
}
