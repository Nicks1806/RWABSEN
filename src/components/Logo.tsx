interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showSubtitle?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { text: "text-lg", sub: "text-[8px]", line: "w-8 h-[1.5px] mt-1" },
  md: { text: "text-2xl", sub: "text-[10px]", line: "w-12 h-[2px] mt-2" },
  lg: { text: "text-4xl", sub: "text-xs", line: "w-16 h-[2px] mt-3" },
  xl: { text: "text-5xl", sub: "text-sm", line: "w-20 h-[2px] mt-3" },
};

export default function Logo({ size = "md", showSubtitle = true, className = "" }: LogoProps) {
  const s = sizeMap[size];
  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <div
        className={`${s.text} font-bold leading-none tracking-tight`}
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
      >
        <span className="text-primary italic">Red</span>
        <span className="text-gray-900">Wine</span>
      </div>
      {showSubtitle && (
        <>
          <div className={`${s.line} bg-primary`} />
          <div
            className={`${s.sub} text-primary tracking-[0.35em] font-medium mt-1`}
            style={{ fontFamily: "Georgia, serif" }}
          >
            SHOES &amp; BAGS
          </div>
        </>
      )}
    </div>
  );
}
