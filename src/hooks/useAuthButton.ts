"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/browser";

export function useAuthButton() {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"bookings" | "notifications">("bookings");
  const [pendingAction, setPendingAction] = useState<
    "signin" | "signout" | null
  >(null);

  async function signIn() {
    setPendingAction("signin");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setPendingAction(null);
      return "Unable to continue with Google. Please try again.";
    }
    return null;
  }

  // The header updates from the shared session listener the moment these
  // resolve; no page reload or server round-trip is needed.
  async function signInAsGuest() {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) return error;
    setOpen(false);
    return null;
  }

  async function signOut() {
    setPendingAction("signout");
    const { error } = await supabase.auth.signOut();
    setPendingAction(null);
    if (error) {
      return "Unable to end this session. Please try again.";
    }
    setOpen(false);
    return null;
  }

  return {
    open,
    pendingAction,
    setOpen,
    setTab,
    signIn,
    signInAsGuest,
    signOut,
    tab,
  };
}
