"use client";

import { DatabaseError } from "@/components/system/DatabaseError";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <DatabaseError reset={reset} />;
}
