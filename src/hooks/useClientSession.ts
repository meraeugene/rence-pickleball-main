"use client";

import type { User } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import useSWR from "swr";
import { createClient } from "@/utils/supabase/browser";

// The homepage is served as a cached static page, so who is signed in is
// worked out here in the browser instead of on the server for every visit.
// One shared listener feeds every component that needs it.

type SessionSnapshot = { ready: boolean; user: User | null };

const SERVER_SNAPSHOT: SessionSnapshot = { ready: false, user: null };
let snapshot: SessionSnapshot = SERVER_SNAPSHOT;
let started = false;
const listeners = new Set<() => void>();

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  createClient().auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null;
    if (snapshot.ready && snapshot.user?.id === user?.id && snapshot.user?.updated_at === user?.updated_at) {
      return;
    }
    snapshot = { ready: true, user };
    listeners.forEach((listener) => listener());
  });
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function fetchSessionInfo(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return { isAdmin: false };
  return (await response.json()) as { isAdmin: boolean };
}

export function useClientSession() {
  const { ready, user } = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => SERVER_SNAPSHOT,
  );

  // Admin status is decided by the server (the admin list is never sent to
  // the browser). It only controls what the menu shows; /admin and every
  // admin API still check on the server.
  const canBeAdmin = Boolean(user && !user.is_anonymous && user.email);
  const { data } = useSWR(
    canBeAdmin ? `/api/session?u=${user!.id}` : null,
    fetchSessionInfo,
    { revalidateOnFocus: false },
  );

  return {
    ready,
    user,
    signedIn: Boolean(user),
    isGuest: Boolean(user?.is_anonymous),
    isAdmin: canBeAdmin && Boolean(data?.isAdmin),
  };
}
