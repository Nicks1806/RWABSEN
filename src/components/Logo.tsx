import Image from "next/image";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

// Logo is 707 x 353 (2:1 aspect ratio)
const sizeMap = {
  sm: { w: 90, h: 45 },
  md: { w: 140, h: 70 },
  lg: { w: 220, h: 110 },
  xl: { w: 280, h: 140 },
};

export default function Logo({ size = "md", className = "" }: LogoProps) {
  const { w, h } = sizeMap[size];
  return (
    <div className={`inline-flex items-center ${className}`}>
      <Image
        src="/logo.png"
        alt="RedWine Shoes & Bags"
        width={w}
        height={h}
        priority
        className="object-contain"
      />
    </div>
  );
}
