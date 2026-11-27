import Image from "next/image";

export function BrandLogo({ className = "", priority = false }: { className?: string; priority?: boolean }) {
  return <Image alt="UNO RALLY" className={`h-auto w-28 object-contain ${className}`} src="/uno-rally-logo-new.png" width={1228} height={773} priority={priority} sizes="(max-width: 640px) 100px, 140px" />;
}
