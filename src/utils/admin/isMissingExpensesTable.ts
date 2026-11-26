type DatabaseError = { code?: string; message?: string } | null | undefined;

/** True when the expenses migration has not been applied to the database yet. */
export function isMissingExpensesTable(error: DatabaseError) {
  if (!error) return false;
  const message = (error.message || "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (message.includes("expenses") &&
      (message.includes("does not exist") || message.includes("could not find")))
  );
}
