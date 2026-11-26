import type { ExpenseCategory } from "@/types/admin/expense";

export const expenseCategories: ReadonlyArray<{
  value: ExpenseCategory;
  label: string;
  colorClass: string;
}> = [
  { value: "UTILITIES", label: "Utilities", colorClass: "bg-cyan-300" },
  { value: "RENT", label: "Rent", colorClass: "bg-violet-300" },
  { value: "STAFF", label: "Staff / Salaries", colorClass: "bg-amber-300" },
  { value: "EQUIPMENT", label: "Equipment", colorClass: "bg-sky-300" },
  { value: "MAINTENANCE", label: "Maintenance", colorClass: "bg-orange-300" },
  { value: "SUPPLIES", label: "Supplies", colorClass: "bg-emerald-300" },
  { value: "MARKETING", label: "Marketing", colorClass: "bg-pink-300" },
  { value: "OTHER", label: "Other", colorClass: "bg-zinc-400" },
];

export const expenseCategoryValues = expenseCategories.map(
  (category) => category.value,
) as [ExpenseCategory, ...ExpenseCategory[]];

export function getExpenseCategoryLabel(value: ExpenseCategory) {
  return expenseCategories.find((category) => category.value === value)?.label || value;
}
