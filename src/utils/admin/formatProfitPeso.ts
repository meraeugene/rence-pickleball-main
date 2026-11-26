export function formatPeso(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    currency: "PHP",
    maximumFractionDigits: 2,
    minimumFractionDigits: amount % 1 ? 2 : 0,
    style: "currency",
  }).format(amount);
}

export function formatCompactPeso(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    compactDisplay: "short",
    currency: "PHP",
    maximumFractionDigits: Math.abs(amount) >= 1000 ? 1 : 0,
    notation: "compact",
    style: "currency",
  }).format(amount);
}
