

export function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.035] p-2.5">
      <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">
        {label}
      </p>
      <p className="mt-1 break-words text-xs font-semibold text-zinc-200 sm:truncate">
        {value}
      </p>
    </div>
  );
}
