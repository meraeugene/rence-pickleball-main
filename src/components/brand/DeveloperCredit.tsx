import { brandConfig } from "@/data/brand/brandConfig";

export function DeveloperCredit({
  className = "",
  compact = false,
  stacked = false,
}: {
  className?: string;
  compact?: boolean;
  stacked?: boolean;
}) {
  const linkClass = "cursor-pointer font-semibold text-zinc-300 no-underline transition hover:text-white";

  if (compact) {
    return (
      <p className={className}>
        Developed by{" "}
        <span className="font-semibold text-zinc-300">DEV_AV</span>
      </p>
    );
  }

  if (stacked) {
    return (
      <div className={className}>
        <p>
          Developed by{" "}
          <span className="font-semibold text-zinc-300">DEV_AV</span>
        </p>
        <p className="mt-1">Ready to build your Online Booking? 🚀</p>
        <p className="mt-1">
          <a className={`${linkClass} underline underline-offset-2`} href={brandConfig.socialUrl} rel="noreferrer" target="_blank">
            Contact our page
          </a>{" "}
          for pricing and details!
        </p>
      </div>
    );
  }

  return (
    <p className={className}>
      Developed by{" "}
      <span className="font-semibold text-zinc-300">DEV_AV</span>{" "}
      - Ready to build your Online Booking? 🚀{" "}
      <a className={`${linkClass} underline underline-offset-2`} href={brandConfig.socialUrl} rel="noreferrer" target="_blank">
        Contact our page
      </a>{" "}
      for pricing and details!
    </p>
  );
}
