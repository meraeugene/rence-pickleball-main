"use client";

import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/browser";

export function useAuthButton(serverSignedIn: boolean) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"bookings" | "notifications">("bookings");
  const [pendingAction, setPendingAction] = useState<
    "signin" | "signout" | null
  >(null);
  // undefined = browser session not read yet, so fall back to the server value.
  // Reading it here lets the header switch the moment Supabase signs in/out,
  // instead of waiting for the server to re-render the page.
  const [clientUser, setClientUser] = useState<User | null | undefined>(
    undefined,
  );

  useEffect(() => {
    const syncSession = (user: User | null) => {
      setClientUser(user);
      if (Boolean(user) !== serverSignedIn) {
        router.refresh();
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      syncSession(session?.user ?? null);
    });

    const syncRestoredPage = () => {
      void supabase.auth.getSession().then(({ data }) => {
        syncSession(data.session?.user ?? null);
      });
    };

    window.addEventListener("pageshow", syncRestoredPage);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("pageshow", syncRestoredPage);
    };
  }, [router, serverSignedIn, supabase]);

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

  async function signInAsGuest() {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) return error;
    setOpen(false);
    router.refresh();
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
    router.refresh();
    return null;
  }

  return {
    clientUser,
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
