import type { BookingStep } from "@/types/bookingWidget";

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export const stepMeta: Record<BookingStep, { count: string; title: string }> = {
  schedule: { count: "1 / 2", title: "Pick day & time" },
  payment: { count: "2 / 2", title: "Payment" },
  submitted: { count: "Done", title: "All set" },
};
