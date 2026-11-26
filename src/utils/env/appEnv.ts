import {
  BOOKING_NOTIFICATION_OWNER_EMAIL,
  DEFAULT_ADMIN_EMAILS,
  DEFAULT_APP_URL,
  LIMIT_BOOKING_NOTIFICATION_EMAILS_TO_OWNER,
} from "@/data/app/appConfig";

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL;
}

export function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function hasBookingConfig() {
  return hasSupabaseConfig() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Admin access is locked to the fixed allowlist in appConfig.
 * ADMIN_EMAILS is intentionally ignored so a stray environment value
 * cannot grant admin access to anyone else.
 */
export function getAdminEmails(): string[] {
  return DEFAULT_ADMIN_EMAILS.map((email) => email.toLowerCase());
}

export function getBookingNotificationEmails() {
  return LIMIT_BOOKING_NOTIFICATION_EMAILS_TO_OWNER
    ? [BOOKING_NOTIFICATION_OWNER_EMAIL]
    : getAdminEmails();
}

export function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
