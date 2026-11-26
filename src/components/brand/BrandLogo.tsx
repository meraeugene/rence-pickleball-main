import Image from "next/image";

export function BrandLogo({ className = "", priority = false }: { className?: string; priority?: boolean }) {
  return <Image alt="UNO RALLY" className={`h-auto w-28 object-contain ${className}`} src="/uno-rally-logo.png" width={1635} height={962} priority={priority} sizes="(max-width: 640px) 100px, 140px" />;
}
